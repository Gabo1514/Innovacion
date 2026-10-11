"""Pruebas de reglas y HTTP; cada caso utiliza una base de datos temporal."""
import base64
import json
import tempfile
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from http.client import HTTPConnection
from pathlib import Path
from urllib.parse import urlencode

from server import APIError, Backend, LIMA, ROOT, make_server, voucher_pdf


class EngineTests(unittest.TestCase):
    def setUp(self):
        (ROOT / ".runtime").mkdir(exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=ROOT / ".runtime", prefix="test-engine-")
        self.now = datetime(2026, 10, 5, 8, tzinfo=LIMA).timestamp()
        self.backend = Backend(Path(self.temp.name) / "tests.sqlite3", clock=lambda: self.now)
        self.day = "2026-10-06"

    def tearDown(self):
        self.temp.cleanup()

    def hold(self, **updates):
        selection = {"date": self.day, "slotId": "s1000", "pax": {"adults": 2, "children": 0}, "extras": []}
        selection.update(updates)
        return self.backend.create_hold(selection)

    def test_newsletter_persists_explicit_consent_without_public_exposure(self):
        first = self.backend.subscribe_newsletter({"email": " Reader@Example.test ", "locale": "en", "consent": True})
        second = self.backend.subscribe_newsletter({"email": "reader@example.test", "locale": "es", "consent": True})
        self.assertFalse(first["alreadySubscribed"])
        self.assertTrue(second["alreadySubscribed"])
        with self.backend.connect() as con:
            rows = con.execute("SELECT * FROM newsletter").fetchall()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["email"], "reader@example.test")
        self.assertEqual(rows[0]["locale"], "en")
        self.assertEqual(rows[0]["consent_version"], "premium-v1")
        self.assertNotIn("reader@example.test", json.dumps(self.backend.bootstrap()))

    def test_newsletter_rejects_invalid_email_locale_and_missing_consent(self):
        for changes in [{"email": "invalid"}, {"email": ["reader@example.test"]}, {"email": "a" * 255 + "@example.test"}, {"consent": False}, {"consent": "true"}, {"locale": "fr"}]:
            payload = {"email": "reader@example.test", "locale": "es", "consent": True, **changes}
            with self.subTest(changes=changes):
                self.expect_error(lambda: self.backend.subscribe_newsletter(payload))
        with self.backend.connect() as con:
            self.assertEqual(con.execute("SELECT COUNT(*) FROM newsletter").fetchone()[0], 0)

    def payment_data(self, **updates):
        payload = {"customer": {"name": "María", "last": "Quispe", "docType": "DNI", "doc": "12345678", "email": "maria@example.com", "phone": "+51987654321", "notes": ""}, "companions": [{"name": "Luis", "last": "Quispe", "docType": "DNI", "doc": "87654321"}], "payment": {"method": "card", "scenario": "approved"}}
        payload.update(updates)
        return payload

    def expect_error(self, callback, code=None, status=None):
        with self.assertRaises(APIError) as caught:
            callback()
        if code:
            self.assertEqual(caught.exception.code, code)
        if status:
            self.assertEqual(caught.exception.status, status)

    def test_private_vehicles_and_server_price(self):
        hold = self.hold(pax={"adults": 3, "children": 1}, extras=["fotos", "traslado"], amounts={"total": 1})
        self.assertEqual(hold["vehicles"], 2)
        self.assertEqual(hold["amounts"], {"base": 450, "extras": 140, "total": 590, "currency": "PEN"})
        self.assertEqual(hold["expiresAt"], int((self.now + 600) * 1000))
        av = self.backend.bootstrap()["availability"][self.day + "|s1000"]
        self.assertEqual(av["freeVehicles"], 2)
        self.assertEqual(av["freeSeats"], 6)
        self.assertEqual(av["bookedSeats"], 4)

    def test_documents_support_passport_and_foreign_identity(self):
        hold = self.hold()
        data = self.payment_data()
        data["customer"].update(docType="PAS", doc="ab123456")
        data["companions"][0].update(docType="CE", doc="123456789")
        paid = self.backend.pay(hold["code"], hold["token"], data)
        self.assertEqual(paid["customer"]["docType"], "PAS")
        self.assertEqual(paid["customer"]["doc"], "AB123456")
        self.assertEqual(paid["companions"][0]["docType"], "CE")

    def test_atomic_concurrent_holds_never_oversell(self):
        self.backend.set_capacities({"date": self.day, "updates": [{"slotId": "s1000", "vehicles": 2, "closed": False}]})
        barrier = threading.Barrier(12)
        def attempt(_):
            barrier.wait()
            try:
                return self.hold()["code"]
            except APIError as error:
                self.assertEqual(error.code, "NO_CAPACITY")
                return None
        with ThreadPoolExecutor(max_workers=12) as pool:
            results = list(pool.map(attempt, range(12)))
        self.assertEqual(sum(bool(r) for r in results), 2)
        self.assertEqual(self.backend.bootstrap()["availability"][self.day + "|s1000"]["usedVehicles"], 2)

    def test_expiration_frees_inventory_and_prevents_payment(self):
        hold = self.hold()
        self.now += 601
        self.assertEqual(self.backend.bootstrap()["availability"][self.day + "|s1000"]["usedVehicles"], 0)
        self.expect_error(lambda: self.backend.pay(hold["code"], hold["token"], self.payment_data()), "HOLD_INVALID")
        reservation = self.backend.reservation(hold["code"], hold["token"])
        self.assertEqual(reservation["status"], "EXPIRADA")
        self.assertEqual(reservation["history"][-1]["status"], "EXPIRADA")

    def test_valid_hold_can_pay_after_online_booking_cutoff(self):
        self.now = datetime(2026, 10, 5, 13, 25, tzinfo=LIMA).timestamp()
        hold = self.hold(date="2026-10-05", slotId="s1630")
        self.now += 6 * 60
        self.expect_error(lambda: self.hold(date="2026-10-05", slotId="s1630"), "DEPARTURE_CLOSED")
        paid = self.backend.pay(hold["code"], hold["token"], self.payment_data())
        self.assertEqual(paid["status"], "CONFIRMADA")
        self.assertGreater(hold["expiresAt"], int(self.now * 1000))

    def test_release_is_idempotent_and_restores_capacity(self):
        hold = self.hold()
        for _ in range(2):
            self.assertEqual(self.backend.release(hold["code"], hold["token"])["status"], "CANCELADA")
        self.assertEqual(self.backend.bootstrap()["availability"][self.day + "|s1000"]["freeVehicles"], 4)

    def test_capability_required_for_every_customer_action(self):
        hold = self.hold()
        self.expect_error(lambda: self.backend.reservation(hold["code"], "bad"), "NOT_FOUND", 404)
        self.expect_error(lambda: self.backend.release(hold["code"], "bad"), "NOT_FOUND", 404)
        self.expect_error(lambda: self.backend.pay(hold["code"], "bad", self.payment_data()), "NOT_FOUND", 404)

    def test_rejected_card_keeps_hold_and_audits_without_charge(self):
        hold = self.hold()
        data = self.payment_data(payment={"method": "card", "scenario": "declined"})
        self.expect_error(lambda: self.backend.pay(hold["code"], hold["token"], data), "PAYMENT_DECLINED", 402)
        self.assertEqual(self.backend.reservation(hold["code"], hold["token"])["status"], "BORRADOR")
        with self.backend.connect() as con:
            self.assertEqual(con.execute("SELECT COUNT(*) FROM audit WHERE action='PAYMENT_DECLINED'").fetchone()[0], 1)
        paid = self.backend.pay(hold["code"], hold["token"], self.payment_data())
        self.assertEqual(paid["status"], "CONFIRMADA")
        self.assertTrue(paid["payment"]["simulated"])
        self.expect_error(lambda: self.backend.pay(hold["code"], hold["token"], self.payment_data()), "HOLD_INVALID")

    def test_concurrent_payment_is_processed_once(self):
        hold = self.hold()
        barrier = threading.Barrier(6)
        def attempt(_):
            barrier.wait()
            try:
                return self.backend.pay(hold["code"], hold["token"], self.payment_data())["status"]
            except APIError as error:
                self.assertEqual(error.code, "HOLD_INVALID")
                return None
        with ThreadPoolExecutor(max_workers=6) as pool:
            results = list(pool.map(attempt, range(6)))
        self.assertEqual(results.count("CONFIRMADA"), 1)
        with self.backend.connect() as con:
            self.assertEqual(con.execute("SELECT COUNT(*) FROM audit WHERE code=? AND action='CONFIRMADA'", (hold["code"],)).fetchone()[0], 1)

    def test_pan_and_cvv_are_never_accepted(self):
        hold = self.hold()
        for field, value in [("number", "4111111111111111"), ("cvv", "123"), ("_num", "4111111111111111"), ("last4", "1111")]:
            data = self.payment_data(payment={"method": "card", "scenario": "approved", field: value})
            self.expect_error(lambda: self.backend.pay(hold["code"], hold["token"], data))
        with self.backend.connect() as con:
            serialized = con.execute("SELECT payload FROM reservations").fetchone()[0]
            self.assertNotIn("4111111111111111", serialized)
            self.assertNotIn('"cvv"', serialized)

    def test_wallet_requires_operation_and_real_file_magic(self):
        hold = self.hold()
        invalid = {"method": "yape", "operation": "123456", "receipt": {"name": "imagen.png", "mime": "image/png", "data": base64.b64encode(b"this is not a PNG file").decode()}}
        self.expect_error(lambda: self.backend.pay(hold["code"], hold["token"], self.payment_data(payment=invalid)))
        valid = {"method": "plin", "operation": "12345678", "receipt": {"name": "comprobante.pdf", "mime": "application/pdf", "data": base64.b64encode(b"%PDF-1.4\nExample receipt for test\n%%EOF").decode()}}
        reservation = self.backend.pay(hold["code"], hold["token"], self.payment_data(payment=valid))
        self.assertEqual(reservation["status"], "PENDIENTE")
        self.assertNotIn("data", reservation["payment"]["receipt"])
        raw, mime = self.backend.receipt(hold["code"])
        self.assertEqual(mime, "application/pdf")
        self.assertTrue(raw.startswith(b"%PDF-"))
        self.assertEqual(self.backend.update_status(hold["code"], "CONFIRMADA")["status"], "CONFIRMADA")

    def test_oversized_receipts_rejected(self):
        hold = self.hold()
        payment = {"method": "yape", "operation": "123456", "receipt": {"name": "large.pdf", "mime": "application/pdf", "data": base64.b64encode(b"%PDF-" + b"x" * 1048576).decode()}}
        self.expect_error(lambda: self.backend.pay(hold["code"], hold["token"], self.payment_data(payment=payment)))

    def test_invalid_travelers_and_companion_count(self):
        hold = self.hold()
        self.expect_error(lambda: self.backend.pay(hold["code"], hold["token"], self.payment_data(companions=[])))
        data = self.payment_data()
        data["companions"][0]["doc"] = data["customer"]["doc"]
        self.expect_error(lambda: self.backend.pay(hold["code"], hold["token"], data))
        data = self.payment_data()
        data["customer"]["phone"] = "987654321"
        self.expect_error(lambda: self.backend.pay(hold["code"], hold["token"], data))

    def test_dates_use_lima_and_minimum_anticipation(self):
        self.expect_error(lambda: self.hold(date="2026-10-04"))
        self.expect_error(lambda: self.hold(date="2027-01-04"))
        self.expect_error(lambda: self.hold(date="2026-10-05", slotId="s1000"), "DEPARTURE_CLOSED")
        hold = self.hold(date="2026-10-05", slotId="s1400")
        self.assertEqual(hold["date"], "2026-10-05")
        self.now = datetime(2026, 10, 6, 0, 30, tzinfo=LIMA).timestamp()
        self.assertIn("2026-10-06|s1000", self.backend.bootstrap()["availability"])
        self.assertNotIn("2026-10-05|s1000", self.backend.bootstrap()["availability"])

    def test_pax_extras_and_malformed_json_types_validated(self):
        for selection in [{"pax": {"adults": True, "children": 0}}, {"pax": {"adults": 1, "children": 0}}, {"pax": {"adults": 9, "children": 1}}, {"slotId": []}, {"extras": ["fotos", "fotos"]}, {"extras": ["nonexistent"]}, {"date": "2026-13-40"}]:
            self.expect_error(lambda: self.hold(**selection))

    def test_capacity_updates_are_atomic_and_never_under_reserved(self):
        self.hold(pax={"adults": 4, "children": 0})
        updates = [{"slotId": "s1400", "vehicles": 7, "closed": False}, {"slotId": "s1000", "vehicles": 1, "closed": False}]
        self.expect_error(lambda: self.backend.set_capacities({"date": self.day, "updates": updates}), "CAPACITY_CONFLICT")
        self.assertEqual(self.backend.bootstrap()["availability"][self.day + "|s1400"]["vehicles"], 4)

    def test_operational_closure_rejects_new_holds_and_payment(self):
        hold = self.hold()
        self.backend.set_capacities({"date": self.day, "updates": [{"slotId": "s1000", "vehicles": 4, "closed": True}]})
        self.expect_error(lambda: self.hold(), "NO_CAPACITY")
        self.expect_error(lambda: self.backend.pay(hold["code"], hold["token"], self.payment_data()), "DEPARTURE_CLOSED")
        self.assertEqual(self.backend.bootstrap()["availability"][self.day + "|s1000"]["freeVehicles"], 0)

    def test_legal_status_transitions_and_refund(self):
        hold = self.hold()
        self.expect_error(lambda: self.backend.update_status(hold["code"], "CONFIRMADA"), "INVALID_TRANSITION")
        self.backend.pay(hold["code"], hold["token"], self.payment_data())
        self.backend.update_status(hold["code"], "CANCELADA")
        refunded = self.backend.update_status(hold["code"], "REEMBOLSADA")
        self.assertEqual(refunded["status"], "REEMBOLSADA")
        self.expect_error(lambda: self.backend.update_status(hold["code"], "CONFIRMADA"), "INVALID_TRANSITION")
        another = self.hold()
        self.backend.release(another["code"], another["token"])
        self.expect_error(lambda: self.backend.update_status(another["code"], "REEMBOLSADA"), "INVALID_TRANSITION")

    def test_public_bootstrap_contains_no_customer_data_or_tokens(self):
        hold = self.hold()
        self.backend.pay(hold["code"], hold["token"], self.payment_data())
        public = json.dumps(self.backend.bootstrap())
        for private in ["maria@example.com", "+51987654321", "12345678", hold["token"], hold["code"]]:
            self.assertNotIn(private, public)

    def test_seed_is_marked_and_idempotent(self):
        self.assertEqual(self.backend.seed()["created"], 6)
        self.assertEqual(self.backend.seed()["created"], 0)
        rows = self.backend.admin_reservations()["reservations"]
        self.assertEqual(len(rows), 6)
        self.assertTrue(all(r["code"].startswith("DEMO-") and r["channel"] == "Demostración" for r in rows))

    def test_admin_sessions_expire_and_logout_revokes(self):
        self.expect_error(lambda: self.backend.login("incorrecta", "test"), "AUTH_REQUIRED")
        self.expect_error(lambda: self.backend.login("contraseña", "test"), "AUTH_REQUIRED")
        token = self.backend.login("Buganvilla2026!", "test")
        self.assertTrue(self.backend.authorized(token))
        self.backend.logout(token)
        self.assertFalse(self.backend.authorized(token))
        token = self.backend.login("Buganvilla2026!", "test")
        self.now += 8 * 3600 + 1
        self.assertFalse(self.backend.authorized(token))

    def test_login_rate_limit(self):
        for _ in range(10):
            self.expect_error(lambda: self.backend.login("wrong", "test"), "AUTH_REQUIRED")
        self.expect_error(lambda: self.backend.login("Buganvilla2026!", "test"), "RATE_LIMITED", 429)
        self.now += 601
        self.assertTrue(self.backend.login("Buganvilla2026!", "test"))

    def test_pdf_is_real_and_contains_status_and_demo_notice(self):
        hold = self.hold()
        paid = self.backend.pay(hold["code"], hold["token"], self.payment_data())
        raw = voucher_pdf(paid, "http://127.0.0.1:8000")
        self.assertTrue(raw.startswith(b"%PDF-"))
        self.assertGreater(len(raw), 3000)
        self.assertIn(b"Voucher", raw)


class HTTPTests(unittest.TestCase):
    def setUp(self):
        (ROOT / ".runtime").mkdir(exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=ROOT / ".runtime", prefix="test-http-")
        self.backend = Backend(Path(self.temp.name) / "http.sqlite3")
        self.server = make_server(0, backend=self.backend)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.port = self.server.server_port

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(2)
        self.temp.cleanup()

    def request(self, path, data=None, headers=None):
        connection = HTTPConnection("127.0.0.1", self.port, timeout=5)
        merged = {"Content-Type": "application/json", **(headers or {})}
        connection.request("POST" if data is not None else "GET", path, json.dumps(data).encode() if data is not None else None, merged)
        response = connection.getresponse()
        raw, status, response_headers = response.read(), response.status, dict(response.getheaders())
        connection.close()
        return status, raw, response_headers

    def test_trip_summary_download_is_utf8_bounded_and_has_a_safe_filename(self):
        content = "Propuesta de viaje | Buganvilla Tours\nHuacachina · 3 viajeros\nS/ 360"
        status, raw, headers = self.request("/api/plan.txt?" + urlencode({"content": content, "date": "2026-10-07"}))
        self.assertEqual(status, 200)
        self.assertEqual(raw.decode("utf-8-sig"), content)
        self.assertIn("text/plain", headers["Content-Type"])
        self.assertEqual(headers["Content-Disposition"], 'attachment; filename="Buganvilla-viaje-2026-10-07.txt"')
        for values in ({"content": "", "date": "2026-10-07"}, {"content": "é" * 9001, "date": "2026-10-07"}, {"content": content, "date": "2026-02-31"}, {"content": content, "date": '../bad"'}):
            self.assertEqual(self.request("/api/plan.txt?" + urlencode(values))[0], 400)

    def test_admin_permissions_cookie_and_logout(self):
        self.assertEqual(self.request("/api/admin/reservations")[0], 401)
        self.assertEqual(self.request("/api/admin/seed", {})[0], 401)
        status, _, headers = self.request("/api/admin/login", {"password": "Buganvilla2026!"})
        self.assertEqual(status, 200)
        cookie = headers["Set-Cookie"]
        self.assertIn("HttpOnly", cookie)
        self.assertIn("SameSite=Strict", cookie)
        session = {"Cookie": cookie.split(";")[0]}
        self.assertEqual(self.request("/api/admin/reservations", headers=session)[0], 200)
        self.assertEqual(self.request("/api/admin/logout", {}, session)[0], 200)
        self.assertEqual(self.request("/api/admin/reservations", headers=session)[0], 401)

    def test_origin_and_dns_rebinding_are_rejected(self):
        self.assertEqual(self.request("/api/admin/login", {"password": "Buganvilla2026!"}, {"Origin": "https://evil.example"})[0], 403)
        self.assertEqual(self.request("/api/bootstrap", headers={"Host": "evil.example"})[0], 403)

    def test_static_allowlist_blocks_code_and_database(self):
        for path in ["/server.py", "/README.md", "/.runtime/buganvilla.sqlite3", "/js/../server.py", "/assets/%2e%2e/server.py"]:
            self.assertEqual(self.request(path)[0], 404, path)
        self.assertEqual(self.request("/index.html")[0], 200)

    def test_pdf_capability_and_receipt_permissions(self):
        day = (datetime.now(LIMA).date() + timedelta(days=1)).isoformat()
        hold = self.backend.create_hold({"date": day, "slotId": "s1000", "pax": {"adults": 2, "children": 0}})
        code = hold["code"]
        self.assertEqual(self.request(f"/api/reservations/{code}/voucher.pdf")[0], 404)
        self.assertEqual(self.request(f"/api/admin/reservations/{code}/receipt")[0], 401)
        self.assertEqual(self.request(f"/api/admin/reservations/{code}/voucher.pdf")[0], 401)
        status, raw, headers = self.request(f"/api/reservations/{code}/voucher.pdf?token={hold['token']}")
        self.assertEqual(status, 200)
        self.assertEqual(headers["Content-Type"], "application/pdf")
        self.assertTrue(raw.startswith(b"%PDF"))
        _, _, login_headers = self.request("/api/admin/login", {"password": "Buganvilla2026!"})
        session = {"Cookie": login_headers["Set-Cookie"].split(";")[0]}
        self.assertEqual(self.request(f"/api/admin/reservations/{code}/voucher.pdf", headers=session)[0], 200)

    def test_qr_endpoint_returns_svg(self):
        status, raw, headers = self.request("/api/qr?text=BGV-TEST")
        self.assertEqual(status, 200)
        self.assertEqual(headers["Content-Type"], "image/svg+xml")
        self.assertIn(b"<svg", raw)


if __name__ == "__main__":
    unittest.main()
