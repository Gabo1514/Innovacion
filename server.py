"""Servidor de demostración local Buganvilla: HTTP, SQLite y vouchers PDF."""
from __future__ import annotations

import argparse
import base64
import hashlib
import hmac
import io
import json
import math
import mimetypes
import os
import re
import secrets
import sqlite3
import threading
import time
from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit

ROOT = Path(__file__).resolve().parent
LIMA = timezone(timedelta(hours=-5))
HOLD_SECONDS = 600
MAX_RECEIPT = 1024 * 1024
MAX_BODY = 1500000
SLOTS = {
    "s1000": {"time": "10:00", "label": "Mañana", "vehicles": 4},
    "s1400": {"time": "14:00", "label": "Tarde", "vehicles": 4},
    "s1630": {"time": "16:30", "label": "Atardecer", "vehicles": 5},
}
EXTRAS = {
    "fotos": {"label": "Fotos profesionales en HD", "price": 40, "per": "booking"},
    "gopro": {"label": "Video GoPro del recorrido", "price": 60, "per": "booking"},
    "traslado": {"label": "Recojo y retorno a hotel en Ica", "price": 25, "per": "person"},
}
ACTIVE = ("BORRADOR", "PENDIENTE", "CONFIRMADA", "COMPLETADA")
TRANSITIONS = {
    "BORRADOR": {"CANCELADA", "EXPIRADA"},
    "PENDIENTE": {"CONFIRMADA", "CANCELADA"},
    "CONFIRMADA": {"COMPLETADA", "CANCELADA"},
    "CANCELADA": {"REEMBOLSADA"},
    "COMPLETADA": set(), "REEMBOLSADA": set(), "EXPIRADA": set(),
}


class APIError(Exception):
    def __init__(self, message, status=400, code="INVALID_INPUT"):
        super().__init__(message)
        self.status, self.code = status, code


class ClosingConnection(sqlite3.Connection):
    """El contexto de SQLite confirma y además libera el archivo en Windows."""
    def __exit__(self, *args):
        try:
            return super().__exit__(*args)
        finally:
            self.close()


def stamp(epoch):
    return datetime.fromtimestamp(epoch, timezone.utc).isoformat()


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def integer(value, label, minimum=0, maximum=20):
    if isinstance(value, bool) or not isinstance(value, int) or not minimum <= value <= maximum:
        raise APIError(f"{label}: valor entero entre {minimum} y {maximum} requerido.")
    return value


def text_field(obj, key, label, minimum=1, maximum=100):
    value = obj.get(key)
    if not isinstance(value, str) or not minimum <= len(value.strip()) <= maximum:
        raise APIError(f"{label}: completa un valor válido.")
    value = value.strip()
    if any(ord(c) < 32 for c in value):
        raise APIError(f"{label}: contiene caracteres inválidos.")
    return value


class Backend:
    def __init__(self, db, clock=time.time, password=None):
        self.db = str(db)
        Path(self.db).parent.mkdir(parents=True, exist_ok=True)
        self.clock = clock
        self.password = password or os.environ.get("BGV_ADMIN_PASSWORD", "Buganvilla2026!")
        self.auth_lock = threading.Lock()
        self.failures = {}
        with self.connect() as con:
            con.executescript("""
              PRAGMA journal_mode=WAL;
              CREATE TABLE IF NOT EXISTS reservations (
                code TEXT PRIMARY KEY, token_hash TEXT NOT NULL, day TEXT NOT NULL,
                slot TEXT NOT NULL, status TEXT NOT NULL, vehicles INTEGER NOT NULL,
                expires REAL, payload TEXT NOT NULL, receipt BLOB, receipt_mime TEXT
              );
              CREATE INDEX IF NOT EXISTS departure_idx ON reservations(day,slot,status);
              CREATE TABLE IF NOT EXISTS capacity (
                day TEXT NOT NULL, slot TEXT NOT NULL, vehicles INTEGER NOT NULL,
                closed INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(day,slot)
              );
              CREATE TABLE IF NOT EXISTS audit (
                id INTEGER PRIMARY KEY, code TEXT, action TEXT NOT NULL, actor TEXT NOT NULL,
                at REAL NOT NULL, detail TEXT NOT NULL
              );
              CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, expires REAL NOT NULL);
              CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
              CREATE TABLE IF NOT EXISTS newsletter (
                email TEXT PRIMARY KEY, locale TEXT NOT NULL, created REAL NOT NULL,
                consent_version TEXT NOT NULL
              );
            """)

    def connect(self):
        con = sqlite3.connect(self.db, timeout=15, factory=ClosingConnection)
        con.row_factory = sqlite3.Row
        con.execute("PRAGMA busy_timeout=15000")
        return con

    def subscribe_newsletter(self, data):
        email = data.get("email")
        locale = data.get("locale", "es")
        if data.get("consent") is not True:
            raise APIError("Acepta recibir comunicaciones antes de suscribirte.")
        if not isinstance(email, str) or len(email) > 254 or not re.fullmatch(r"[^\s@<>]+@[^\s@<>]+\.[^\s@<>.]{2,}", email.strip()):
            raise APIError("Ingresa un correo electrónico válido.")
        if not isinstance(locale, str) or locale not in {"es", "en"}:
            raise APIError("Elige un idioma disponible.")
        email = email.strip().lower()
        with self.connect() as con:
            cursor = con.execute("INSERT OR IGNORE INTO newsletter(email,locale,created,consent_version) VALUES(?,?,?,?)", (email, locale, self.clock(), "premium-v1"))
        return {"ok": True, "alreadySubscribed": cursor.rowcount == 0, "demo": True}

    @contextmanager
    def transaction(self):
        con = self.connect()
        try:
            con.execute("BEGIN IMMEDIATE")
            self.expire(con)
            yield con
            con.commit()
        except Exception:
            con.rollback()
            raise
        finally:
            con.close()

    def audit(self, con, code, action, actor, detail=""):
        con.execute("INSERT INTO audit(code,action,actor,at,detail) VALUES(?,?,?,?,?)", (code, action, actor, self.clock(), detail))

    def save(self, con, r):
        con.execute("UPDATE reservations SET status=?,payload=? WHERE code=?", (r["status"], json.dumps(r, ensure_ascii=False), r["code"]))

    def transition(self, con, r, status, actor, note):
        r["status"] = status
        r["history"].append({"status": status, "at": stamp(self.clock()), "note": note})
        self.save(con, r)
        self.audit(con, r["code"], status, actor, note)

    def expire(self, con):
        for row in con.execute("SELECT * FROM reservations WHERE status='BORRADOR' AND expires<=?", (self.clock(),)).fetchall():
            self.transition(con, json.loads(row["payload"]), "EXPIRADA", "system", "Venció la retención de diez minutos.")
        con.execute("DELETE FROM sessions WHERE expires<=?", (self.clock(),))

    def validate_date(self, value, departure=False, slot=None):
        try:
            if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
                raise ValueError()
            selected = date.fromisoformat(value)
        except (ValueError, TypeError):
            raise APIError("La fecha debe tener formato AAAA-MM-DD.")
        today = datetime.fromtimestamp(self.clock(), LIMA).date()
        if not today <= selected <= today + timedelta(days=90):
            raise APIError("La fecha debe estar dentro de los próximos 90 días.")
        if departure:
            hour, minute = map(int, SLOTS[slot]["time"].split(":"))
            when = datetime(selected.year, selected.month, selected.day, hour, minute, tzinfo=LIMA).timestamp()
            if when - self.clock() < 3 * 3600:
                raise APIError("Este turno cerró la venta online: reserva con tres horas de anticipación.", 409, "DEPARTURE_CLOSED")
        return selected

    def capacity(self, con, day, slot):
        row = con.execute("SELECT vehicles,closed FROM capacity WHERE day=? AND slot=?", (day, slot)).fetchone()
        return (row["vehicles"], bool(row["closed"])) if row else (SLOTS[slot]["vehicles"], False)

    def used(self, con, day, slot):
        rows = con.execute("SELECT vehicles,payload FROM reservations WHERE day=? AND slot=? AND status IN (?,?,?,?)", (day, slot, *ACTIVE)).fetchall()
        return sum(r["vehicles"] for r in rows), sum(json.loads(r["payload"])["pax"]["adults"] + json.loads(r["payload"])["pax"]["children"] for r in rows)

    def bootstrap(self):
        with self.transaction() as con:
            now = self.clock()
            today = datetime.fromtimestamp(now, LIMA).date()
            caps = {(r["day"], r["slot"]): (r["vehicles"], bool(r["closed"])) for r in con.execute("SELECT * FROM capacity")}
            used = {}
            for row in con.execute("SELECT day,slot,vehicles,payload FROM reservations WHERE status IN (?,?,?,?)", ACTIVE):
                key = row["day"], row["slot"]
                v, p = used.get(key, (0, 0))
                pax = json.loads(row["payload"])["pax"]
                used[key] = v + row["vehicles"], p + pax["adults"] + pax["children"]
            availability = {}
            for offset in range(91):
                day = (today + timedelta(days=offset)).isoformat()
                for slot, detail in SLOTS.items():
                    vehicles, closed = caps.get((day, slot), (detail["vehicles"], False))
                    taken, seats = used.get((day, slot), (0, 0))
                    departure = datetime.fromisoformat(f"{day}T{detail['time']}:00-05:00").timestamp()
                    expired = departure - now < 10800
                    free = 0 if closed or expired else max(0, vehicles - taken)
                    availability[f"{day}|{slot}"] = {"vehicles": vehicles, "seats": vehicles * 3, "closed": closed, "expired": expired, "usedVehicles": taken, "bookedSeats": seats, "freeVehicles": free, "freeSeats": free * 3}
            return {"serverTime": int(now * 1000), "availability": availability, "config": {"demo": True, "currency": "PEN", "exchangeRate": 3.75, "bookingWindowDays": 90, "minHoursBeforeDeparture": 3, "holdSeconds": HOLD_SECONDS, "prices": {"adult": 120, "child": 90}, "slots": [{"id": k, **v} for k, v in SLOTS.items()], "extras": [{"id": k, **v} for k, v in EXTRAS.items()]}}

    def create_hold(self, data):
        day, slot = data.get("date"), data.get("slotId")
        if not isinstance(slot, str) or slot not in SLOTS:
            raise APIError("Selecciona un turno válido.")
        self.validate_date(day, True, slot)
        pax = data.get("pax")
        if not isinstance(pax, dict):
            raise APIError("Completa el grupo de pasajeros.")
        adults = integer(pax.get("adults"), "Adultos", 1, 9)
        children = integer(pax.get("children"), "Niños", 0, 8)
        count = adults + children
        if not 2 <= count <= 9:
            raise APIError("La reserva requiere entre dos y nueve pasajeros.")
        extras = data.get("extras", [])
        if not isinstance(extras, list) or any(not isinstance(e, str) or e not in EXTRAS for e in extras) or len(set(extras)) != len(extras):
            raise APIError("Selecciona complementos válidos, sin duplicados.")
        chosen = [{"id": e, "label": EXTRAS[e]["label"], "amount": EXTRAS[e]["price"] * (count if EXTRAS[e]["per"] == "person" else 1)} for e in extras]
        base = adults * 120 + children * 90
        extra_total = sum(e["amount"] for e in chosen)
        needed = math.ceil(count / 3)
        now = self.clock()
        token = secrets.token_urlsafe(32)
        code = f"BGV-{datetime.fromtimestamp(now, LIMA).year}-{secrets.token_hex(3).upper()}"
        r = {"code": code, "tourId": "utv-huacachina", "tourTitle": "UTV en Huacachina", "date": day, "slotId": slot, "slotTime": SLOTS[slot]["time"], "slotLabel": SLOTS[slot]["label"], "pax": {"adults": adults, "children": children}, "vehicles": needed, "extras": chosen, "amounts": {"base": base, "extras": extra_total, "total": base + extra_total, "currency": "PEN"}, "status": "BORRADOR", "createdAt": stamp(now), "expiresAt": int((now + HOLD_SECONDS) * 1000), "holdExpiresAt": int((now + HOLD_SECONDS) * 1000), "customer": {}, "companions": [], "payment": {}, "channel": "Web directa", "demo": True, "history": [{"status": "BORRADOR", "at": stamp(now), "note": "Retención temporal de diez minutos."}]}
        with self.transaction() as con:
            vehicles, closed = self.capacity(con, day, slot)
            taken, _ = self.used(con, day, slot)
            if closed or taken + needed > vehicles:
                raise APIError("El turno ya no tiene suficientes vehículos. Elige otro horario.", 409, "NO_CAPACITY")
            con.execute("INSERT INTO reservations(code,token_hash,day,slot,status,vehicles,expires,payload) VALUES(?,?,?,?,?,?,?,?)", (code, digest(token), day, slot, "BORRADOR", needed, now + HOLD_SECONDS, json.dumps(r, ensure_ascii=False)))
            self.audit(con, code, "BORRADOR", "customer", "Vehículos retenidos: " + str(needed))
        return {**r, "token": token}

    def get_row(self, con, code, token=None, admin=False):
        row = con.execute("SELECT * FROM reservations WHERE code=?", (code,)).fetchone()
        if not row or (not admin and (not isinstance(token, str) or not hmac.compare_digest(row["token_hash"], digest(token)))):
            raise APIError("Reserva no encontrada o enlace de acceso inválido.", 404, "NOT_FOUND")
        return row

    def reservation(self, code, token):
        with self.transaction() as con:
            r = json.loads(self.get_row(con, code, token)["payload"])
            return {**r, "token": token}

    def release(self, code, token):
        with self.transaction() as con:
            r = json.loads(self.get_row(con, code, token)["payload"])
            if r["status"] == "BORRADOR":
                self.transition(con, r, "CANCELADA", "customer", "Selección liberada por el cliente.")
            elif r["status"] not in {"CANCELADA", "EXPIRADA"}:
                raise APIError("Una reserva pagada requiere gestión del operador.", 409, "INVALID_TRANSITION")
            return {**r, "token": token}

    def person(self, data, primary=False):
        if not isinstance(data, dict):
            raise APIError("Completa los datos de cada viajero.")
        r = {"name": text_field(data, "name", "Nombres", 2, 80), "last": text_field(data, "last", "Apellidos", 2, 80)}
        kind = data.get("docType")
        if not isinstance(kind, str) or kind not in {"DNI", "CE", "PAS", "PASAPORTE", "Pasaporte", "passport"}:
            raise APIError("Documento: selecciona DNI, Pasaporte o Carné de extranjería.")
        r["docType"] = kind if kind in {"DNI", "CE"} else "PAS"
        r["doc"] = text_field(data, "doc", "Número de documento", 6, 12).upper()
        patterns = {"DNI": r"\d{8}", "PAS": r"[A-Z0-9]{6,12}", "CE": r"[A-Z0-9]{9,12}"}
        if not re.fullmatch(patterns[r["docType"]], r["doc"]):
            raise APIError("Número de documento inválido.")
        if primary:
            r["email"] = text_field(data, "email", "Correo electrónico", 5, 150)
            if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", r["email"]):
                raise APIError("Correo electrónico inválido.")
            r["phone"] = text_field(data, "phone", "WhatsApp internacional", 8, 25)
            if not re.fullmatch(r"\+[1-9]\d{6,14}", r["phone"].replace(" ", "").replace("-", "")):
                raise APIError("WhatsApp: incluye el código de país, por ejemplo +51987654321.")
            r["notes"] = text_field(data, "notes", "Observaciones", 0, 500) if data.get("notes") else ""
        return r

    def payment(self, data):
        if not isinstance(data, dict):
            raise APIError("Selecciona un método de pago.")
        method = data.get("method")
        if not isinstance(method, str):
            raise APIError("Método de pago inválido.")
        allowed = {"method", "scenario", "brand"} if method == "card" else {"method", "operation", "receipt"}
        if any(key not in allowed for key in data):
            raise APIError("Esta demostración no acepta números de tarjeta ni códigos de seguridad.")
        if method == "card":
            scenario = data.get("scenario")
            if not isinstance(scenario, str) or scenario not in {"approved", "declined"}:
                raise APIError("Selecciona el resultado del pago de demostración.")
            if not isinstance(data.get("brand", "VISA"), str) or data.get("brand", "VISA") not in {"VISA", "MASTERCARD", "AMEX"}:
                raise APIError("Marca de tarjeta inválida.")
            brand = data.get("brand", "VISA")
            last4 = {"VISA": "1111", "MASTERCARD": "4444", "AMEX": "0005"}[brand]
            return {"method": "card", "scenario": scenario, "brand": brand, "last4": last4, "simulated": True}, None, None
        if method not in {"yape", "plin"}:
            raise APIError("Método de pago inválido.")
        operation = text_field(data, "operation", "Número de operación", 6, 12)
        if not re.fullmatch(r"\d{6,12}", operation):
            raise APIError("El número de operación requiere de seis a doce dígitos.")
        receipt = data.get("receipt")
        if not isinstance(receipt, dict):
            raise APIError("Adjunta un comprobante PNG, JPG o PDF.")
        name = text_field(receipt, "name", "Nombre del archivo", 1, 150)
        mime = receipt.get("mime")
        encoded = receipt.get("data")
        if not isinstance(mime, str) or mime not in {"image/png", "image/jpeg", "application/pdf"} or not isinstance(encoded, str) or len(encoded) > (MAX_RECEIPT * 4 // 3 + 4):
            raise APIError("Comprobante: admite PNG, JPG o PDF hasta 1 MB.")
        try:
            raw = base64.b64decode(encoded, validate=True)
        except Exception:
            raise APIError("El contenido del comprobante es inválido.")
        valid = (mime == "image/png" and raw.startswith(b"\x89PNG\r\n\x1a\n")) or (mime == "image/jpeg" and raw.startswith(b"\xff\xd8\xff")) or (mime == "application/pdf" and raw.startswith(b"%PDF-"))
        if not valid or not 16 <= len(raw) <= MAX_RECEIPT:
            raise APIError("El archivo no corresponde a un comprobante válido o supera 1 MB.")
        return {"method": method, "operation": operation, "simulated": True, "receipt": {"name": Path(name).name, "mime": mime, "size": len(raw)}}, raw, mime

    def pay(self, code, token, data):
        customer = self.person(data.get("customer"), True)
        payment, receipt, mime = self.payment(data.get("payment"))
        companions = data.get("companions")
        if not isinstance(companions, list) or len(companions) > 8:
            raise APIError("Completa los datos de tus acompañantes.")
        people = [self.person(p) for p in companions]
        # La expiración se confirma antes de iniciar la operación para que persista
        # incluso si se rechaza después una reserva ya vencida.
        with self.transaction():
            pass
        with self.transaction() as con:
            r = json.loads(self.get_row(con, code, token)["payload"])
            if r["status"] != "BORRADOR":
                raise APIError("La selección venció o ya fue procesada. Revisa el estado de tu reserva.", 409, "HOLD_INVALID")
            if len(people) != r["pax"]["adults"] + r["pax"]["children"] - 1:
                raise APIError("Completa los documentos de todos los acompañantes.")
            identities = [(p["docType"], p["doc"]) for p in [customer, *people]]
            if len(set(identities)) != len(identities):
                raise APIError("Cada viajero debe tener un documento distinto.")
            vehicles, closed = self.capacity(con, r["date"], r["slotId"])
            if closed:
                raise APIError("El operador cerró este turno. Elige otro horario.", 409, "DEPARTURE_CLOSED")
            # La anticipación se valida al crear la selección. Una retención
            # vigente conserva sus diez minutos para terminar el checkout.
            self.validate_date(r["date"])
            if payment.get("scenario") == "declined":
                self.audit(con, code, "PAYMENT_DECLINED", "customer", "Pago simulado rechazado, sin cargo.")
                outcome = None
            else:
                r["customer"], r["companions"], r["payment"] = customer, people, payment
                if receipt:
                    payment["receiptUrl"] = f"/api/admin/reservations/{code}/receipt"
                    con.execute("UPDATE reservations SET receipt=?,receipt_mime=? WHERE code=?", (receipt, mime, code))
                r["paidAt"] = stamp(self.clock()) if payment["method"] == "card" else None
                target = "CONFIRMADA" if payment["method"] == "card" else "PENDIENTE"
                note = "Pago simulado aprobado. No se realizó ningún cargo." if target == "CONFIRMADA" else "Comprobante de demostración pendiente de revisión manual."
                self.transition(con, r, target, "customer", note)
                outcome = {**r, "token": token}
        if outcome is None:
            raise APIError("Pago de demostración rechazado. No se realizó ningún cargo; puedes volver a intentarlo.", 402, "PAYMENT_DECLINED")
        return outcome

    def admin_reservations(self):
        with self.transaction() as con:
            return {"reservations": [json.loads(r[0]) for r in con.execute("SELECT payload FROM reservations ORDER BY rowid DESC")]}

    def admin_reservation(self, code):
        with self.transaction() as con:
            return json.loads(self.get_row(con, code, admin=True)["payload"])

    def update_status(self, code, target):
        with self.transaction() as con:
            r = json.loads(self.get_row(con, code, admin=True)["payload"])
            if not isinstance(target, str) or target not in TRANSITIONS.get(r["status"], set()) or target == "EXPIRADA":
                raise APIError("Ese cambio de estado no está permitido para esta reserva.", 409, "INVALID_TRANSITION")
            if target == "REEMBOLSADA" and not r.get("paidAt"):
                raise APIError("No hay un pago aprobado para registrar el reembolso.", 409, "INVALID_TRANSITION")
            if target == "CONFIRMADA":
                r["paidAt"] = stamp(self.clock())
            self.transition(con, r, target, "admin", "Cambio registrado por el operador (demostración).")
            return r

    def set_capacities(self, data):
        day = data.get("date")
        self.validate_date(day)
        updates = data.get("updates")
        if not isinstance(updates, list) or not 1 <= len(updates) <= 3:
            raise APIError("Envía de uno a tres ajustes de capacidad.")
        seen = set()
        with self.transaction() as con:
            for entry in updates:
                if not isinstance(entry, dict) or not isinstance(entry.get("slotId"), str) or entry.get("slotId") not in SLOTS or entry["slotId"] in seen:
                    raise APIError("Los turnos de capacidad deben ser válidos y distintos.")
                slot = entry["slotId"]
                seen.add(slot)
                vehicles = integer(entry.get("vehicles"), "Vehículos", 0, 20)
                closed = entry.get("closed")
                if not isinstance(closed, bool):
                    raise APIError("Selecciona el estado abierto o cerrado del turno.")
                taken, _ = self.used(con, day, slot)
                if vehicles < taken:
                    raise APIError(f"{SLOTS[slot]['time']}: hay {taken} UTV asignados; no puedes reducir la capacidad por debajo de ellos.", 409, "CAPACITY_CONFLICT")
                con.execute("INSERT INTO capacity(day,slot,vehicles,closed) VALUES(?,?,?,?) ON CONFLICT(day,slot) DO UPDATE SET vehicles=excluded.vehicles,closed=excluded.closed", (day, slot, vehicles, int(closed)))
                self.audit(con, None, "CAPACITY", "admin", json.dumps({"date": day, **entry}))
        return {"ok": True}

    def login(self, password, ip):
        now = self.clock()
        with self.auth_lock:
            failures = [x for x in self.failures.get(ip, []) if now - x < 600]
            if len(failures) >= 10:
                raise APIError("Demasiados intentos. Espera diez minutos antes de volver a ingresar.", 429, "RATE_LIMITED")
            if not isinstance(password, str) or not hmac.compare_digest(password.encode(), self.password.encode()):
                self.failures[ip] = failures + [now]
                raise APIError("Contraseña incorrecta.", 401, "AUTH_REQUIRED")
            self.failures.pop(ip, None)
        token = secrets.token_urlsafe(32)
        with self.transaction() as con:
            con.execute("INSERT INTO sessions VALUES(?,?)", (digest(token), now + 8 * 3600))
            self.audit(con, None, "LOGIN", "admin")
        return token

    def authorized(self, token):
        if not token:
            return False
        with self.connect() as con:
            return con.execute("SELECT 1 FROM sessions WHERE token_hash=? AND expires>?", (digest(token), self.clock())).fetchone() is not None

    def logout(self, token):
        with self.transaction() as con:
            con.execute("DELETE FROM sessions WHERE token_hash=?", (digest(token or ""),))
            self.audit(con, None, "LOGOUT", "admin")

    def seed(self):
        with self.transaction() as con:
            if con.execute("SELECT 1 FROM metadata WHERE key='seed_v1'").fetchone():
                return {"created": 0, "message": "Los datos de demostración ya se cargaron."}
            today = datetime.fromtimestamp(self.clock(), LIMA).date()
            created = 0
            for i, (name, last) in enumerate([("María", "Quispe"), ("John", "Miller"), ("Lucía", "Fernández"), ("Carlos", "Rojas"), ("Ana", "Torres"), ("Pierre", "Dubois")]):
                day = (today + timedelta(days=i // 3 + 1)).isoformat()
                slot = list(SLOTS)[i % 3]
                vehicles, closed = self.capacity(con, day, slot)
                used, _ = self.used(con, day, slot)
                if closed or used >= vehicles:
                    continue
                now = self.clock()
                code = f"DEMO-{datetime.fromtimestamp(now, LIMA).year}-{i + 1:04}"
                status = "PENDIENTE" if i % 3 == 1 else "CONFIRMADA"
                payment = {"method": "yape", "operation": "12345678", "simulated": True} if status == "PENDIENTE" else {"method": "card", "brand": "VISA", "last4": "1111", "simulated": True}
                r = {"code": code, "tourId": "utv-huacachina", "tourTitle": "UTV en Huacachina", "date": day, "slotId": slot, "slotTime": SLOTS[slot]["time"], "slotLabel": SLOTS[slot]["label"], "pax": {"adults": 2, "children": 0}, "vehicles": 1, "extras": [], "amounts": {"base": 240, "extras": 0, "total": 240, "currency": "PEN"}, "status": status, "createdAt": stamp(now), "expiresAt": None, "holdExpiresAt": None, "paidAt": stamp(now) if status == "CONFIRMADA" else None, "customer": {"name": name, "last": last, "docType": "DNI", "doc": str(40000000 + i), "email": "demo@example.com", "phone": "+51900000000", "notes": "Registro ficticio para demostración."}, "companions": [{"name": "Viajero", "last": "Ejemplo", "docType": "DNI", "doc": str(50000000 + i)}], "payment": payment, "channel": "Demostración", "demo": True, "history": [{"status": status, "at": stamp(now), "note": "Registro ficticio de demostración."}]}
                con.execute("INSERT OR IGNORE INTO reservations(code,token_hash,day,slot,status,vehicles,payload) VALUES(?,?,?,?,?,?,?)", (code, digest(secrets.token_urlsafe(32)), day, slot, status, 1, json.dumps(r, ensure_ascii=False)))
                self.audit(con, code, "SEED", "admin", "Registro ficticio")
                created += 1
            con.execute("INSERT INTO metadata VALUES('seed_v1','1')")
            return {"created": created, "message": "Datos de demostración cargados."}

    def receipt(self, code):
        with self.connect() as con:
            row = self.get_row(con, code, admin=True)
            if not row["receipt"]:
                raise APIError("Esta reserva no tiene un comprobante adjunto.", 404, "NOT_FOUND")
            return row["receipt"], row["receipt_mime"]


def qr_drawing(value, size=150):
    from reportlab.graphics.barcode import qr
    from reportlab.graphics.shapes import Drawing
    widget = qr.QrCodeWidget(value)
    x, y, x2, y2 = widget.getBounds()
    drawing = Drawing(size, size, transform=[size / (x2 - x), 0, 0, size / (y2 - y), 0, 0])
    drawing.add(widget)
    return drawing


def voucher_pdf(r, base_url):
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether
    from reportlab.lib.enums import TA_CENTER
    from xml.sax.saxutils import escape
    buff = io.BytesIO()
    width, height = A4
    ink, sand, pink = colors.HexColor("#12110F"), colors.HexColor("#F6F2EA"), colors.HexColor("#B4552D")
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle("Brand", fontName="Helvetica-Bold", fontSize=23, leading=27, textColor=ink))
    styles.add(ParagraphStyle("Muted", fontName="Helvetica", fontSize=9, leading=14, textColor=colors.HexColor("#687470")))
    styles.add(ParagraphStyle("Cell", fontName="Helvetica", fontSize=10, leading=15, textColor=ink))
    styles.add(ParagraphStyle("TitleBGV", fontName="Helvetica-Bold", fontSize=19, leading=25, textColor=ink))
    styles.add(ParagraphStyle("CodeBGV", fontName="Helvetica-Bold", fontSize=14, leading=20, textColor=pink))
    styles.add(ParagraphStyle("Centered", alignment=TA_CENTER, fontSize=8, leading=12, textColor=ink))
    safe = lambda value: escape(str(value))
    para = lambda value, style="Cell": Paragraph(safe(value), styles[style])
    story = [para("BUGANVILLA", "Brand"), para("TOURS / ICA, PERÚ", "Muted"), Spacer(1, 20), para("Voucher de reserva", "TitleBGV"), para(r["code"], "CodeBGV"), Spacer(1, 8)]
    labels = {"CONFIRMADA": "RESERVA CONFIRMADA", "PENDIENTE": "PAGO PENDIENTE DE VERIFICACIÓN", "BORRADOR": "SELECCIÓN TEMPORAL", "CANCELADA": "RESERVA CANCELADA", "EXPIRADA": "SELECCIÓN VENCIDA", "REEMBOLSADA": "REEMBOLSO REGISTRADO", "COMPLETADA": "EXPERIENCIA COMPLETADA"}
    story += [para(labels[r["status"]], "CodeBGV"), para("DEMOSTRACIÓN · No acredita un cobro ni un servicio contratado.", "Muted"), Spacer(1, 18)]
    customer = r.get("customer", {})
    adults, children, vehicles = r["pax"]["adults"], r["pax"]["children"], r["vehicles"]
    group = f"{adults} adulto{'s' if adults != 1 else ''}"
    if children:
        group += f", {children} niño{'s' if children != 1 else ''}"
    group += f" / {vehicles} UTV privado{'s' if vehicles != 1 else ''}"
    rows = [("Experiencia", r["tourTitle"]), ("Fecha de salida", r["date"]), ("Turno / hora local", r["slotTime"] + " · " + r["slotLabel"]), ("Titular", (customer.get("name", "") + " " + customer.get("last", "")).strip() or "Pendiente de completar"), ("Pasajeros / vehículos", group), ("Total referencial", f"S/ {r['amounts']['total']:.2f} PEN"), ("Punto de encuentro", "Oficina GO Adventure, Huacachina, Ica")]
    table = Table([[para(label, "Muted"), para(value)] for label, value in rows], colWidths=[135, width - 235])
    table.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), sand), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 13), ("RIGHTPADDING", (0, 0), (-1, -1), 13), ("TOPPADDING", (0, 0), (-1, -1), 10), ("BOTTOMPADDING", (0, 0), (-1, -1), 10), ("LINEBELOW", (0, 0), (-1, -2), .5, colors.HexColor("#E8DED3"))]))
    story += [table, Spacer(1, 18)]
    if r.get("extras"):
        story += [para("Complementos seleccionados", "CodeBGV"), para(" · ".join(e["label"] for e in r["extras"])), Spacer(1, 12)]
    link = f"{base_url}/voucher.html?code={r['code']}&token={r['token']}" if r.get("token") else f"{base_url}/admin.html?code={r['code']}"
    access_title = "Acceso a tu reserva" if r.get("token") else "Acceso operativo"
    access_text = "Escanea este código para consultar el estado vigente de tu reserva. Comparte este documento únicamente con tus viajeros." if r.get("token") else "Escanea este código para abrir el panel del operador. La consulta de esta reserva requiere una sesión autenticada."
    qr_table = Table([[qr_drawing(link, 112), [para(access_title, "CodeBGV"), Spacer(1, 6), para(access_text), Spacer(1, 7), para("Presentación: llega 15 minutos antes de tu salida. Lleva documento, ropa cómoda y zapatillas cerradas.")]]], colWidths=[130, width - 230])
    qr_table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0)]))
    story += [KeepTogether([qr_table]), Spacer(1, 18), para("Condiciones de demostración", "CodeBGV"), para("Los precios, horarios, cupos y políticas de esta plataforma son referenciales. Los pagos con tarjeta son simulados y los comprobantes Yape/Plin requieren revisión manual. Este documento es un voucher de prueba, no una factura ni un recibo tributario.", "Muted")]
    doc = SimpleDocTemplate(buff, pagesize=A4, rightMargin=50, leftMargin=50, topMargin=42, bottomMargin=45, title=f"Voucher {r['code']}", author="Buganvilla Tours")
    def footer(canvas, document):
        canvas.setStrokeColor(pink)
        canvas.line(50, 34, width - 50, 34)
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(ink)
        canvas.drawString(50, 21, "BUGANVILLA TOURS · HUACACHINA, ICA")
        canvas.drawRightString(width - 50, 21, "DEMOSTRACIÓN / " + str(document.page))
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return buff.getvalue()


class Handler(BaseHTTPRequestHandler):
    server_version = "BuganvillaLocal/2.0"
    protocol_version = "HTTP/1.1"

    def log_message(self, format, *args):
        # Nunca registrar URL con tokens, documentos ni datos de clientes.
        print(f"{self.client_address[0]} {self.command} {urlsplit(self.path).path}", flush=True)

    @property
    def backend(self):
        return self.server.backend

    def respond(self, status, body, mime="application/json; charset=utf-8", extra=None):
        if isinstance(body, (dict, list)):
            body = json.dumps(body, ensure_ascii=False).encode("utf-8")
        if isinstance(body, str):
            body = body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Frame-Options", "SAMEORIGIN")
        self.send_header("Cache-Control", "no-store" if self.path.startswith("/api/") else "no-cache")
        for key, value in (extra or {}).items():
            self.send_header(key, value)
        self.end_headers()
        self.wfile.write(body)

    def guard_host(self):
        host = self.headers.get("Host", "")
        if host not in {f"127.0.0.1:{self.server.server_port}", f"localhost:{self.server.server_port}"}:
            raise APIError("Host no autorizado.", 403, "ORIGIN_DENIED")
        origin = self.headers.get("Origin")
        if origin and origin not in {f"http://127.0.0.1:{self.server.server_port}", f"http://localhost:{self.server.server_port}"}:
            raise APIError("Origen no autorizado.", 403, "ORIGIN_DENIED")
        if self.headers.get("Sec-Fetch-Site") == "cross-site":
            raise APIError("Solicitud desde otro sitio rechazada.", 403, "ORIGIN_DENIED")

    def cookie(self):
        cookie = SimpleCookie()
        try:
            cookie.load(self.headers.get("Cookie", ""))
            return cookie["bgv_session"].value if "bgv_session" in cookie else None
        except Exception:
            return None

    def require_admin(self):
        if not self.backend.authorized(self.cookie()):
            raise APIError("Inicia sesión para acceder al panel operativo.", 401, "AUTH_REQUIRED")

    def body(self):
        if self.headers.get("Transfer-Encoding"):
            raise APIError("Codificación de solicitud no admitida.")
        try:
            size = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            raise APIError("Longitud de solicitud inválida.")
        if size < 0 or size > MAX_BODY:
            raise APIError("Solicitud demasiado grande.", 413, "BODY_TOO_LARGE")
        if self.headers.get("Content-Type", "").split(";")[0].strip() != "application/json":
            raise APIError("Se requiere contenido JSON.", 415, "INVALID_CONTENT_TYPE")
        try:
            value = json.loads(self.rfile.read(size))
        except (ValueError, UnicodeError):
            raise APIError("Contenido JSON inválido.")
        if not isinstance(value, dict):
            raise APIError("Se requiere un objeto JSON.")
        return value

    def do_GET(self):
        try:
            self.guard_host()
            parsed = urlsplit(self.path)
            path, query = unquote(parsed.path), parse_qs(parsed.query)
            if path == "/api/bootstrap":
                return self.respond(200, self.backend.bootstrap())
            if path == "/api/plan.txt":
                content = query.get("content", [""])[0]
                travel_date = query.get("date", [""])[0]
                if not content.strip() or len(content.encode("utf-8")) > 18000:
                    raise APIError("El resumen está vacío o es demasiado largo.")
                try:
                    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", travel_date):
                        raise ValueError
                    date.fromisoformat(travel_date)
                except ValueError:
                    raise APIError("Fecha del resumen inválida.")
                return self.respond(200, "\ufeff" + content, "text/plain; charset=utf-8", {"Content-Disposition": f'attachment; filename="Buganvilla-viaje-{travel_date}.txt"'})
            if path == "/api/admin/reservations":
                self.require_admin()
                return self.respond(200, self.backend.admin_reservations())
            if path == "/api/qr":
                value = query.get("text", [""])[0]
                if not value or len(value) > 800:
                    raise APIError("Contenido QR inválido.")
                from reportlab.graphics import renderSVG
                return self.respond(200, renderSVG.drawToString(qr_drawing(value)), "image/svg+xml")
            match = re.fullmatch(r"/api/reservations/([A-Z0-9-]+)(/voucher\.pdf)?", path)
            if match:
                r = self.backend.reservation(match[1], query.get("token", [None])[0])
                if match[2]:
                    return self.respond(200, voucher_pdf(r, f"http://127.0.0.1:{self.server.server_port}"), "application/pdf", {"Content-Disposition": f'attachment; filename="{r["code"]}.pdf"'})
                return self.respond(200, r)
            match = re.fullmatch(r"/api/admin/reservations/([A-Z0-9-]+)/receipt", path)
            if match:
                self.require_admin()
                body, mime = self.backend.receipt(match[1])
                extension = {"application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg"}[mime]
                return self.respond(200, body, mime, {"Content-Disposition": f'attachment; filename="comprobante-{match[1]}.{extension}"', "Content-Security-Policy": "sandbox"})
            match = re.fullmatch(r"/api/admin/reservations/([A-Z0-9-]+)/voucher\.pdf", path)
            if match:
                self.require_admin()
                r = self.backend.admin_reservation(match[1])
                return self.respond(200, voucher_pdf(r, f"http://127.0.0.1:{self.server.server_port}"), "application/pdf", {"Content-Disposition": f'attachment; filename="{r["code"]}.pdf"'})
            return self.static(path)
        except APIError as e:
            self.close_connection = True
            self.respond(e.status, {"error": str(e), "code": e.code})
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception as e:
            print(f"Error interno: {type(e).__name__}", flush=True)
            self.respond(500, {"error": "No se pudo completar la operación. Inténtalo otra vez.", "code": "SERVER_ERROR"})

    def static(self, path):
        if path == "/":
            path = "/index.html"
        allowed_pages = {"/index.html", "/tour-utv.html", "/admin.html", "/voucher.html", "/favicon.ico"}
        resolved = (ROOT / path.lstrip("/")).resolve()
        if (path not in allowed_pages and not path.startswith(("/assets/", "/css/", "/js/"))) or not resolved.is_relative_to(ROOT) or any(part.startswith(".") for part in Path(path).parts) or not resolved.is_file():
            raise APIError("Página no encontrada.", 404, "NOT_FOUND")
        mime = mimetypes.guess_type(str(resolved))[0] or "application/octet-stream"
        if mime.startswith("text/") or resolved.suffix == ".js":
            mime += "; charset=utf-8"
        return self.respond(200, resolved.read_bytes(), mime)

    def do_POST(self):
        try:
            self.guard_host()
            path = urlsplit(self.path).path
            data = self.body()
            if path == "/api/newsletter":
                return self.respond(200, self.backend.subscribe_newsletter(data))
            if path == "/api/admin/login":
                token = self.backend.login(data.get("password"), self.client_address[0])
                return self.respond(200, {"ok": True}, extra={"Set-Cookie": f"bgv_session={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800"})
            if path.startswith("/api/admin/"):
                self.require_admin()
                if path == "/api/admin/logout":
                    self.backend.logout(self.cookie())
                    return self.respond(200, {"ok": True}, extra={"Set-Cookie": "bgv_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0"})
                if path == "/api/admin/capacity":
                    return self.respond(200, self.backend.set_capacities(data))
                if path == "/api/admin/seed":
                    return self.respond(200, self.backend.seed())
                match = re.fullmatch(r"/api/admin/reservations/([A-Z0-9-]+)/status", path)
                if match:
                    return self.respond(200, self.backend.update_status(match[1], data.get("status")))
            if path == "/api/holds":
                return self.respond(201, self.backend.create_hold(data))
            match = re.fullmatch(r"/api/reservations/([A-Z0-9-]+)/(pay|release)", path)
            if match:
                result = self.backend.pay(match[1], data.get("token"), data) if match[2] == "pay" else self.backend.release(match[1], data.get("token"))
                return self.respond(200, result)
            raise APIError("Operación no encontrada.", 404, "NOT_FOUND")
        except APIError as e:
            self.close_connection = True
            self.respond(e.status, {"error": str(e), "code": e.code})
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception as e:
            print(f"Error interno: {type(e).__name__}", flush=True)
            self.respond(500, {"error": "No se pudo completar la operación. Inténtalo otra vez.", "code": "SERVER_ERROR"})


def make_server(port=8000, db=None, backend=None):
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    server.backend = backend or Backend(db or ROOT / ".runtime" / "buganvilla.sqlite3")
    server.daemon_threads = True
    return server


def main():
    parser = argparse.ArgumentParser(description="Buganvilla Tours: servidor local de demostración")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--db", default=str(ROOT / ".runtime" / "buganvilla.sqlite3"))
    args = parser.parse_args()
    server = make_server(args.port, args.db)
    print(f"Buganvilla Tours: http://127.0.0.1:{server.server_port}", flush=True)
    print("Demostración local. Pagos simulados. Ctrl+C para detener.", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
