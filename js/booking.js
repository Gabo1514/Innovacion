/* =========================================================
   Buganvilla Tours 2.0 — Motor de reservas y checkout
   Flujo: fecha → turno → pasajeros → extras → datos → pago → voucher
   ========================================================= */

Layout.render("utv");

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const T = UTV_TOUR;

const Booking = {
  state: {
    date: null,
    slotId: null,
    adults: 2,
    children: 0,
    extras: new Set(),
    month: null, // primer día del mes visible
  },

  /* ---------------- Inicialización ---------------- */
  async init() {
    this.renderStaticContent();
    try {
      await Store.refresh();
    } catch (error) {
      this.showError('No pudimos conectar con las reservas. Inicia el proyecto con iniciar.ps1 y vuelve a cargar la página.');
      $('#bk-continue').disabled = true;
      return;
    }

    const today = new Date();
    this.state.month = new Date(today.getFullYear(), today.getMonth(), 1);

    // Parámetros desde el buscador rápido del inicio (?date=YYYY-MM-DD&pax=N)
    const params = new URLSearchParams(location.search);
    const pDate = params.get("date");
    const pPax = Number(params.get("pax"));
    if (Number.isInteger(pPax) && pPax >= T.minPax) this.state.adults = Math.min(pPax, T.maxPaxPerBooking);
    if (pDate && this.isDateSelectable(pDate)) {
      this.state.date = pDate;
      const d = Utils.fromISODate(pDate);
      this.state.month = new Date(d.getFullYear(), d.getMonth(), 1);
    }

    this.bindWidget();
    this.renderAll();
    Checkout.init();

    document.addEventListener("currencychange", () => this.renderAll());
    document.addEventListener('currencychange', () => {
      if ($('#checkout').classList.contains('open')) { Checkout.renderSide(); Checkout.setMethod(Checkout.method); }
    });
    this.refreshTimer = setInterval(async () => {
      if (document.hidden || Checkout.busy) return;
      const before = JSON.stringify(Store._availability);
      try { await Store.refresh(); if (before !== JSON.stringify(Store._availability)) this.renderAll(); }
      catch { this.showError('La conexión se interrumpió. Reintentaremos actualizar los cupos.'); }
    }, 15000);
    window.addEventListener('focus', async () => {
      const before = JSON.stringify(Store._availability);
      try { await Store.refresh(); if (before !== JSON.stringify(Store._availability)) this.renderAll(); } catch { /* siguiente actualización */ }
    });
    this.initGallery();
  },

  showError(message) {
    const el = $('#booking-error');
    el.textContent = message;
    el.hidden = !message;
  },

  initGallery() {
    const dialog = $('#gallery-dialog');
    $$('.gallery button').forEach(button => button.addEventListener('click', () => {
      const img = $('img', button);
      $('#gallery-large').src = img.currentSrc || img.src;
      $('#gallery-large').alt = img.alt;
      dialog.showModal();
    }));
    $('#gallery-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  },

  renderStaticContent() {
    $("#tour-desc").textContent = T.description;
    $("#feature-row").innerHTML = T.features.map(f =>
      `<div class="feature-item"><span>${Icons.svg(f.icon || 'clock')}</span><small>${f.label}</small><strong>${f.value}</strong></div>`).join("");
    $("#timeline").innerHTML = T.itinerary.map(i =>
      `<div class="tl-item"><h3>${i.title}</h3><p>${i.text}</p></div>`).join("");
    $("#list-inc").innerHTML = T.includes.map(x => `<li>${x}</li>`).join("");
    $("#list-exc").innerHTML = T.excludes.map(x => `<li>${x}</li>`).join("");
    $("#list-rec").innerHTML = T.recommendations.map(x => `<li>${x}</li>`).join("");
    $("#map-frame").src = T.meetingPoint.embed;
    $("#meeting-name").textContent = T.meetingPoint.name;
    $("#maps-link").href = T.meetingPoint.mapsUrl;
    $("#child-label").textContent = T.childAgeLabel;
    const cancelTxt = `La política de demostración permite solicitar cancelación hasta ${CONFIG.freeCancellationHours} horas antes de la salida. Debe ser aprobada por la agencia antes del lanzamiento comercial.`;
    $("#faq-cancel").textContent = cancelTxt;
    $('#policy-note').textContent = `Política de prueba: cancelación hasta ${CONFIG.freeCancellationHours} h antes`;
  },

  /* ---------------- Reglas de disponibilidad ---------------- */
  todayISO() { return Utils.todayISO(); },

  maxDateISO() {
    const d = Utils.fromISODate(this.todayISO()); d.setDate(d.getDate() + CONFIG.bookingWindowDays);
    return Utils.toISODate(d);
  },

  /** Un turno de hoy solo se vende si faltan más de N horas para la salida. */
  isSlotOnTime(dateISO, slot) {
    const departure = Date.parse(`${dateISO}T${slot.time}:00-05:00`);
    return departure - (Utils.serverNow?.() ?? Date.now()) > CONFIG.minHoursBeforeDeparture * 3600e3;
  },

  slotAvailability(dateISO, slot) {
    const av = Store.getAvailability(T.id, dateISO, slot.id, Checkout.hold?.code);
    if (!this.isSlotOnTime(dateISO, slot)) return { ...av, freeVehicles: 0, freeSeats: 0, expired: true };
    return av;
  },

  dayAvailability(dateISO) {
    let total = 0, free = 0;
    T.slots.forEach(s => {
      const av = this.slotAvailability(dateISO, s);
      total += av.closed ? 0 : av.vehicles;
      free += av.freeVehicles;
    });
    return { total, free, ratio: total ? free / total : 0 };
  },

  isDateSelectable(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || Utils.toISODate(Utils.fromISODate(iso)) !== iso) return false;
    if (iso < this.todayISO() || iso > this.maxDateISO()) return false;
    return this.dayAvailability(iso).free > 0;
  },

  selectedSlot() { return T.slots.find(s => s.id === this.state.slotId) || null; },

  maxPaxAllowed() {
    const slot = this.selectedSlot();
    if (!slot || !this.state.date) return T.maxPaxPerBooking;
    return Math.min(T.maxPaxPerBooking, this.slotAvailability(this.state.date, slot).freeSeats);
  },

  /* ---------------- Cálculo de precio ---------------- */
  calc() {
    const { adults, children } = this.state;
    const pax = adults + children;
    const base = adults * T.prices.adult + children * T.prices.child;
    const extras = [...this.state.extras].map(id => {
      const e = T.extras.find(x => x.id === id);
      return { id, label: e.label, amount: e.per === "person" ? e.price * pax : e.price };
    });
    const extrasTotal = extras.reduce((s, e) => s + e.amount, 0);
    return { pax, vehicles: Math.ceil(pax / T.seatsPerVehicle), base, extras, extrasTotal, total: base + extrasTotal };
  },

  isReady() {
    const { pax } = this.calc();
    const slot = this.selectedSlot();
    return !!(Store.online && this.state.date && slot && this.isSlotOnTime(this.state.date, slot) && pax >= T.minPax && pax <= this.maxPaxAllowed());
  },

  /* ---------------- Render ---------------- */
  renderAll() {
    if (Store.online) this.showError('');
    $("#bk-from").textContent = Utils.money(T.prices.adult);
    $("#child-price").textContent = `${Utils.money(T.prices.child)} c/u`;
    this.renderCalendar();
    this.renderSlots();
    this.renderPax();
    this.renderExtras();
    this.renderSummary();
  },

  renderCalendar() {
    const m = this.state.month;
    const today = Utils.fromISODate(this.todayISO());
    const first = new Date(m.getFullYear(), m.getMonth(), 1);
    const daysInMonth = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    const offset = (first.getDay() + 6) % 7; // semana inicia lunes
    const maxISO = this.maxDateISO();
    const minMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const maxD = Utils.fromISODate(maxISO);
    const maxMonth = new Date(maxD.getFullYear(), maxD.getMonth(), 1);

    let cells = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"].map(d => `<div class="cal-dow">${d}</div>`).join("");
    cells += "<div></div>".repeat(offset);
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = Utils.toISODate(new Date(m.getFullYear(), m.getMonth(), d));
      const inRange = iso >= this.todayISO() && iso <= maxISO;
      let cls = "cal-day";
      let disabled = !inRange;
      if (inRange) {
        const av = this.dayAvailability(iso);
        if (av.free === 0) { cls += " avail-full"; disabled = true; }
        else cls += av.ratio < 0.35 ? " avail-low" : " avail-high";
      }
      if (iso === this.todayISO()) cls += " today";
      if (iso === this.state.date) cls += " selected";
      cells += `<button type="button" class="${cls}" data-date="${iso}" ${disabled ? "disabled" : ""} aria-label="${iso}" aria-pressed="${iso === this.state.date}">${d}</button>`;
    }

    const title = m.toLocaleDateString("es-PE", { month: "long", year: "numeric" });
    $("#calendar").innerHTML = `
      <div class="cal-head">
        <button type="button" class="cal-nav" id="cal-prev" aria-label="Mes anterior" ${m <= minMonth ? "disabled" : ""}>‹</button>
        <strong>${title}</strong>
        <button type="button" class="cal-nav" id="cal-next" aria-label="Mes siguiente" ${m >= maxMonth ? "disabled" : ""}>›</button>
      </div>
      <div class="cal-grid">${cells}</div>
      <div class="cal-legend"><span class="l-high">Disponible</span><span class="l-low">Últimos cupos</span></div>`;
  },

  renderSlots() {
    const wrap = $("#slots");
    if (!this.state.date) {
      $("#slot-date-hint").textContent = "";
      wrap.innerHTML = `<div class="slot-empty">Primero selecciona una fecha en el calendario</div>`;
      return;
    }
    const d = Utils.fromISODate(this.state.date);
    $("#slot-date-hint").textContent = d.toLocaleDateString("es-PE", { weekday: "short", day: "numeric", month: "short" });

    wrap.innerHTML = T.slots.map(s => {
      const av = this.slotAvailability(this.state.date, s);
      let tag, tagCls;
      if (av.expired) { tag = "Cerrado"; tagCls = "none"; }
      else if (av.closed) { tag = "No opera"; tagCls = "none"; }
      else if (av.freeVehicles === 0) { tag = "Agotado"; tagCls = "none"; }
      else if (av.freeVehicles <= 1) { tag = `¡Queda ${av.freeVehicles} UTV!`; tagCls = "low"; }
      else { tag = `${av.freeVehicles} UTV libres`; tagCls = av.freeVehicles / av.vehicles < 0.35 ? "low" : "high"; }
      const disabled = av.freeVehicles === 0;
      return `
        <button type="button" class="slot ${s.id === this.state.slotId ? "selected" : ""}" data-slot="${s.id}" id="slot-${s.id}" aria-pressed="${s.id === this.state.slotId}" ${disabled ? "disabled" : ""}>
          <span class="slot-time">${s.time}</span>
          <span class="slot-info">${s.label}${s.featured ? " " : ""}<small>Salida desde GO Adventure</small></span>
          <span class="slot-left ${tagCls}">${tag}</span>
        </button>`;
    }).join("");
  },

  renderPax() {
    const { adults, children } = this.state;
    const total = adults + children;
    const max = this.maxPaxAllowed();
    $("#adult-count").textContent = adults;
    $("#child-count").textContent = children;
    $("#adult-minus").disabled = adults <= 1 || total <= T.minPax;
    $("#child-minus").disabled = children <= 0 || total <= T.minPax;
    $("#adult-plus").disabled = total >= max;
    $("#child-plus").disabled = total >= max;

    const v = Math.ceil(total / T.seatsPerVehicle);
    let note = ` ${v} UTV privado${v > 1 ? "s" : ""} para tu grupo (hasta ${T.seatsPerVehicle} por unidad)`;
    if (this.state.slotId && total >= max && max < T.maxPaxPerBooking) note += ` · máximo disponible en este turno: ${max}`;
    $("#vehicle-note").textContent = note;
  },

  renderExtras() {
    $("#extras").innerHTML = T.extras.map(e => {
      const on = this.state.extras.has(e.id);
      return `
        <label class="extra ${on ? "on" : ""}" for="extra-${e.id}">
          <input type="checkbox" id="extra-${e.id}" data-extra="${e.id}" ${on ? "checked" : ""} />
          <span class="extra-icon">${Icons.svg(e.icon || 'plus')}</span><span class="lbl">${e.label}</span>
          <span class="pr">+${Utils.money(e.price)}${e.per === "person" ? " p/p" : ""}</span>
        </label>`;
    }).join("");
  },

  renderSummary() {
    const c = this.calc();
    const { adults, children } = this.state;
    let html = `<div class="sum-line"><span>${adults} adulto${adults > 1 ? "s" : ""} × ${Utils.money(T.prices.adult)}</span><span>${Utils.money(adults * T.prices.adult)}</span></div>`;
    if (children) html += `<div class="sum-line"><span>${children} niño${children > 1 ? "s" : ""} × ${Utils.money(T.prices.child)}</span><span>${Utils.money(children * T.prices.child)}</span></div>`;
    c.extras.forEach(e => { html += `<div class="sum-line"><span>${e.label}</span><span>${Utils.money(e.amount)}</span></div>`; });
    html += `<div class="sum-total"><span>Total</span><strong id="bk-total">${Utils.money(c.total)}</strong></div>`;
    $("#summary").innerHTML = html;

    const btn = $("#bk-continue");
    const ready = this.isReady();
    btn.disabled = !ready || Checkout.opening || Checkout.closing;
    btn.textContent = ready ? "Continuar con la reserva →" : !this.state.date ? "Elige una fecha" : !this.state.slotId ? "Elige un turno" : "Revisa los pasajeros";

    $("#mb-label").textContent = ready ? "Total" : "Desde";
    $("#mb-total").textContent = ready ? Utils.money(c.total) : Utils.money(T.prices.adult);
    $("#mb-cta").textContent = ready ? "Continuar" : "Reservar";
  },

  /* ---------------- Eventos ---------------- */
  bindWidget() {
    $("#calendar").addEventListener("click", e => {
      if (e.target.closest("#cal-prev")) { this.shiftMonth(-1); return; }
      if (e.target.closest("#cal-next")) { this.shiftMonth(1); return; }
      const day = e.target.closest(".cal-day");
      if (!day || day.disabled) return;
      this.state.date = day.dataset.date;
      // Si el turno elegido ya no tiene cupo en la nueva fecha, se limpia
      const slot = this.selectedSlot();
      if (slot && this.slotAvailability(this.state.date, slot).freeVehicles === 0) this.state.slotId = null;
      this.clampPax();
      this.renderAll();
    });

    $("#slots").addEventListener("click", e => {
      const b = e.target.closest(".slot");
      if (!b || b.disabled) return;
      this.state.slotId = b.dataset.slot;
      this.clampPax();
      this.renderAll();
    });

    const step = (key, delta) => {
      const total = this.state.adults + this.state.children;
      if (delta > 0 && total >= this.maxPaxAllowed()) return;
      if (delta < 0 && (total <= T.minPax || (key === 'adults' && this.state.adults <= 1) || (key === 'children' && this.state.children <= 0))) return;
      this.state[key] += delta;
      this.renderPax(); this.renderSummary();
    };
    $("#adult-plus").addEventListener("click", () => step("adults", 1));
    $("#adult-minus").addEventListener("click", () => step("adults", -1));
    $("#child-plus").addEventListener("click", () => step("children", 1));
    $("#child-minus").addEventListener("click", () => step("children", -1));

    $("#extras").addEventListener("change", e => {
      const id = e.target.dataset.extra;
      if (!id) return;
      e.target.checked ? this.state.extras.add(id) : this.state.extras.delete(id);
      e.target.closest(".extra").classList.toggle("on", e.target.checked);
      this.renderSummary();
    });

    $("#bk-continue").addEventListener("click", () => { if (this.isReady()) Checkout.open(); });

    $("#mb-cta").addEventListener("click", e => {
      if (this.isReady()) { e.preventDefault(); Checkout.open(); }
    });
  },

  shiftMonth(delta) {
    const m = this.state.month;
    this.state.month = new Date(m.getFullYear(), m.getMonth() + delta, 1);
    this.renderCalendar();
  },

  /** Ajusta pasajeros si el turno elegido tiene menos asientos libres. */
  clampPax() {
    const max = this.maxPaxAllowed();
    while (this.state.adults + this.state.children > max && this.state.children > 0) this.state.children--;
    while (this.state.adults + this.state.children > max && this.state.adults > T.minPax) this.state.adults--;
  },

  reset() {
    Object.assign(this.state, { date: null, slotId: null, adults: 2, children: 0, extras: new Set() });
    history.replaceState(null, "", location.pathname + "#reservar");
    this.renderAll();
  },
};

/* =========================================================
   Checkout: datos → pago → voucher
   ========================================================= */
const Checkout = {
  step: 1,
  method: "card",
  customer: null,
  holdTimer: null,
  holdSeconds: 600,
  lastReservation: null,
  hold: null,
  busy: false,
  opening: false,
  closing: false,
  receipt: null,
  previousFocus: null,

  init() {
    $$("#checkout [data-close]").forEach(el => el.addEventListener("click", () => this.close()));
    document.addEventListener('keydown', e => {
      if (!$('#checkout').classList.contains('open')) return;
      if (e.key === 'Escape') this.close();
      if (e.key === 'Tab') {
        const focusable = $$('#checkout button, #checkout a[href], #checkout input, #checkout select, #checkout textarea').filter(el => !el.disabled && el.getClientRects().length);
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    });

    $("#form-data").addEventListener("submit", e => { e.preventDefault(); this.submitData(); });
    $("#form-pay").addEventListener("submit", e => { e.preventDefault(); this.submitPayment(); });
    $("#back-to-data").addEventListener("click", () => this.goTo(1));

    $$(".pay-tab").forEach(tab => tab.addEventListener("click", () => this.setMethod(tab.dataset.method)));

    // Formato en vivo de la tarjeta
    $("#c-number").addEventListener("input", e => {
      const digits = e.target.value.replace(/\D/g, "").slice(0, 16);
      e.target.value = digits.replace(/(.{4})/g, "$1 ").trim();
      $("#cp-number").textContent = (digits.padEnd(16, "•")).replace(/(.{4})/g, "$1 ").trim();
      $("#cp-brand").textContent = this.cardBrand(digits) || "CARD";
    });
    $("#c-name").addEventListener("input", e => { $("#cp-name").textContent = e.target.value.toUpperCase() || "NOMBRE APELLIDO"; });
    $("#c-exp").addEventListener("input", e => {
      let v = e.target.value.replace(/\D/g, "").slice(0, 4);
      if (v.length >= 3) v = v.slice(0, 2) + "/" + v.slice(2);
      e.target.value = v;
      $("#cp-exp").textContent = v || "MM/AA";
    });
    $("#c-cvv").addEventListener("input", e => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4); });
    $("#y-op").addEventListener("input", e => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 12); });
    $('#receipt').addEventListener('change', () => this.readReceipt());
    $('#fill-demo-card')?.addEventListener('click', () => {
      $('#c-number').value = '4111 1111 1111 1111';
      $('#c-exp').value = `12/${String(new Date().getFullYear() + 1).slice(-2)}`;
      $('#c-cvv').value = '123';
      ['#c-number', '#c-exp'].forEach(id => $(id).dispatchEvent(new Event('input')));
    });

    // Limpia el error al editar
    $$("#checkout .input, #checkout .select").forEach(el => el.addEventListener("input", () => this.setError(el, "")));
  },

  async open() {
    if (this.opening || this.busy || this.closing) return;
    this.opening = true;
    $('#bk-continue').disabled = true;
    $('#reservar').inert = true;
    try {
      this.hold = await Store.createHold({ date: Booking.state.date, slotId: Booking.state.slotId, pax: { adults: Booking.state.adults, children: Booking.state.children }, extras: [...Booking.state.extras] });
    } catch (error) {
      Booking.showError(error.message);
      Utils.toast(error.message, 'error');
      try { await Store.refresh(); Booking.renderAll(); } catch { /* mensaje ya visible */ }
      return;
    } finally {
      this.opening = false;
      $('#reservar').inert = false;
      Booking.renderSummary();
    }
    Object.assign(Booking.state, { date: this.hold.date, slotId: this.hold.slotId, adults: this.hold.pax.adults, children: this.hold.pax.children, extras: new Set(this.hold.extras.map(extra => extra.id)) });
    this.previousFocus = document.activeElement;
    this.customer = null;
    this.receipt = null;
    $('#form-data').reset();
    $('#form-pay').reset();
    $$('#checkout .invalid').forEach(el => this.setError(el, ''));
    $('#err-terms').textContent = '';
    $('#payment-error').hidden = true;
    $('#receipt-preview').textContent = '';
    this.renderCompanions();
    this.goTo(1);
    this.renderSide();
    $("#checkout").classList.add("open");
    document.body.style.overflow = "hidden";
    $$('body > main, body > header, body > footer, #wa-float, #mobile-bar').forEach(el => { el.inert = true; });
    this.startHold();
    setTimeout(() => $("#f-name").focus(), 100);
  },

  async close() {
    if (this.busy || this.opening || this.closing) return;
    this.closing = true;
    const hold = this.hold;
    this.hold = null;
    $("#checkout").classList.remove("open");
    document.body.style.overflow = "";
    this.stopHold();
    $$('body > main, body > header, body > footer, #wa-float, #mobile-bar').forEach(el => { el.inert = false; });
    this.previousFocus?.focus();
    if (hold && this.step !== 3) {
      try { await Store.releaseHold(hold.code, hold.token); await Store.refresh(); }
      catch { Utils.toast('El bloqueo se liberará automáticamente al terminar su plazo.'); }
    }
    if (this.step === 3) Booking.reset();
    Booking.renderAll();
    this.closing = false;
  },

  goTo(step) {
    this.step = step;
    $$("#checkout [data-pane]").forEach(p => { p.hidden = Number(p.dataset.pane) !== step; });
    $$("#stepper-bar .sb-step").forEach(s => {
      const n = Number(s.dataset.step);
      s.classList.toggle("active", n === step);
      s.classList.toggle("done", n < step);
    });
    $("#hold-timer").style.visibility = step === 3 ? "hidden" : "visible";
    $("#checkout .modal-panel").scrollTop = 0;
    if (step === 2) this.setMethod(this.method);
  },

  /* ----- Temporizador de bloqueo de cupo ----- */
  startHold() {
    this.stopHold();
    const paint = () => {
      const left = Math.max(0, Math.ceil((this.hold.expiresAt - (Utils.serverNow?.() ?? Date.now())) / 1000));
      $('#hold-time').textContent = `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`;
      return left;
    };
    paint();
    this.holdTimer = setInterval(() => {
      const left = paint();
      if (left <= 0) {
        this.close();
        Utils.toast("El tiempo de reserva expiró. Vuelve a seleccionar tu turno.", "error");
      }
    }, 1000);
  },
  stopHold() { clearInterval(this.holdTimer); this.holdTimer = null; },

  renderCompanions() {
    const count = this.hold.pax.adults + this.hold.pax.children - 1;
    $('#companions').innerHTML = `<h3>Acompañantes</h3><p class="muted">Completa los datos de ${count === 1 ? 'la persona que viaja' : `las ${count} personas que viajan`} contigo para el registro del tour.</p>` + Array.from({ length: count }, (_, i) => `
      <fieldset class="companion-row" data-companion="${i}"><legend>Pasajero ${i + 2}</legend><div class="form-grid">
        <div class="field"><label for="p-name-${i}">Nombres</label><input class="input" id="p-name-${i}" data-key="name" autocomplete="off" maxlength="70" required/><span class="field-error"></span></div>
        <div class="field"><label for="p-last-${i}">Apellidos</label><input class="input" id="p-last-${i}" data-key="last" autocomplete="off" maxlength="70" required/><span class="field-error"></span></div>
        <div class="field"><label for="p-type-${i}">Tipo de documento</label><select class="select" id="p-type-${i}" data-key="docType"><option value="DNI">DNI</option><option value="PAS">Pasaporte</option><option value="CE">Carné de extranjería</option></select></div>
        <div class="field"><label for="p-doc-${i}">Documento</label><input class="input" id="p-doc-${i}" data-key="doc" autocomplete="off" maxlength="12" required/><span class="field-error"></span></div>
      </div></fieldset>`).join('');
  },

  async readReceipt() {
    this.receipt = null;
    const file = $('#receipt').files[0];
    $('#receipt-preview').textContent = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.type) || file.size > 1024 * 1024) {
      this.setError($('#receipt'), 'Adjunta un JPG, PNG o PDF de hasta 1 MB.');
      $('#receipt').value = '';
      return;
    }
    try {
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(file);
      });
      this.receipt = { name: file.name, mime: file.type, data };
      this.setError($('#receipt'), '');
      $('#receipt-preview').textContent = `${file.name} · ${Math.ceil(file.size / 1024)} KB · listo para revisión`;
    } catch { this.setError($('#receipt'), 'No pudimos leer el archivo. Inténtalo de nuevo.'); }
  },

  /* ----- Resumen lateral ----- */
  renderSide() {
    const r = this.hold;
    const s = { date: r.date, adults: r.pax.adults, children: r.pax.children };
    const c = { ...r.amounts, vehicles: r.vehicles, extras: r.extras };
    const slot = { time: r.slotTime, label: r.slotLabel };
    const html = `
      <h3>Resumen de tu reserva</h3>
      <div class="side-tour"><img src="https://buganvillatours.com/wp-content/uploads/2025/06/Tour-Paseo-Premium-en-UTV-Huacachina3.jpg" alt="" /><div><strong>${T.title}</strong><small> ${Utils.formatDateLong(s.date)}</small><small> ${slot.time} · ${slot.label}</small></div></div>
      <div class="sum-line"><span>Pasajeros</span><span>${s.adults} adulto${s.adults > 1 ? "s" : ""}${s.children ? ` + ${s.children} niño${s.children > 1 ? "s" : ""}` : ""}</span></div>
      <div class="sum-line"><span>Vehículos</span><span>${c.vehicles} UTV privado${c.vehicles > 1 ? "s" : ""}</span></div>
      <div class="sum-line"><span>Tour</span><span>${Utils.money(c.base)}</span></div>
      ${c.extras.map(e => `<div class="sum-line"><span>${e.label}</span><span>${Utils.money(e.amount)}</span></div>`).join("")}
      <div class="sum-total"><span>Total</span><strong>${Utils.money(c.total)}</strong></div>
      ${Store.getCurrency() === "USD" ? `<p class="muted" style="font-size:.76rem">Se cobrará el equivalente en soles: ${Utils.money(c.total, "PEN")}. Tipo de cambio referencial.</p>` : ""}
      <p class="policy-note" style="justify-content:flex-start;text-align:left">Política de demostración: cancelación hasta ${CONFIG.freeCancellationHours} h antes</p>`;
    $$("#checkout [data-side]").forEach(el => (el.innerHTML = html));
    $("#pay-submit").textContent = `Pagar ${Utils.money(c.total)}`;
    $("#yape-amount").textContent = Utils.money(c.total, "PEN");
  },

  /* ----- Validación ----- */
  setError(input, msg) {
    input.classList.toggle("invalid", !!msg);
    const err = input.closest(".field")?.querySelector(".field-error");
    if (err) err.textContent = msg;
  },

  submitData() {
    const v = id => $(id).value.trim();
    const checks = [
      ["#f-name", /^[\p{L}\s'.-]{2,}$/u.test(v("#f-name")) ? "" : "Ingresa tus nombres"],
      ["#f-last", /^[\p{L}\s'.-]{2,}$/u.test(v("#f-last")) ? "" : "Ingresa tus apellidos"],
      ["#f-doc", this.validateDoc(v("#f-doctype"), v("#f-doc"))],
      ["#f-email", /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v("#f-email")) ? "" : "Correo no válido"],
      ["#f-phone", this.validatePhone(v("#f-cc"), v("#f-phone"))],
    ];
    let ok = true;
    checks.forEach(([id, msg]) => { this.setError($(id), msg); if (msg) ok = false; });
    const terms = $("#f-terms").checked;
    $("#err-terms").textContent = terms ? "" : "Debes aceptar los términos para continuar";
    if (!terms) ok = false;

    this.companions = $$('[data-companion]').map(row => {
      const person = Object.fromEntries(['name', 'last', 'docType', 'doc'].map(key => [key, $(`[data-key="${key}"]`, row).value.trim()]));
      ['name', 'last', 'doc'].forEach(key => {
        const error = key === 'doc' ? this.validateDoc(person.docType, person.doc) : /^[\p{L}\s'.-]{2,70}$/u.test(person[key]) ? '' : 'Completa este dato';
        this.setError($(`[data-key="${key}"]`, row), error);
        if (error) ok = false;
      });
      return person;
    });
    const documents = [`${v('#f-doctype')}:${v('#f-doc').toUpperCase()}`, ...this.companions.map(person => `${person.docType}:${person.doc.toUpperCase()}`)];
    if (new Set(documents).size !== documents.length) {
      ok = false;
      $('#err-terms').textContent = 'Cada pasajero debe tener un documento diferente.';
    }

    if (!ok) { $("#form-data .invalid")?.focus(); return; }

    this.customer = {
      name: v("#f-name"), last: v("#f-last"), docType: v("#f-doctype"), doc: v("#f-doc"),
      email: v("#f-email"), phone: `${v("#f-cc")} ${v("#f-phone")}`, notes: v("#f-notes"),
    };
    if (!$("#c-name").value) { $("#c-name").value = `${this.customer.name} ${this.customer.last}`; $("#c-name").dispatchEvent(new Event("input")); }
    this.goTo(2);
  },

  validateDoc(type, doc) {
    if (type === "DNI") return /^\d{8}$/.test(doc) ? "" : "El DNI debe tener 8 dígitos";
    if (type === "PAS") return /^[A-Za-z0-9]{6,12}$/.test(doc) ? "" : "Pasaporte no válido (6 a 12 caracteres)";
    return /^[A-Za-z0-9]{9,12}$/.test(doc) ? "" : "Carné no válido (9 a 12 caracteres)";
  },

  validatePhone(cc, phone) {
    const digits = phone.replace(/\D/g, "");
    if (cc === "+51") return /^9\d{8}$/.test(digits) ? "" : "Celular peruano: 9 dígitos, empieza con 9";
    return /^\d{6,14}$/.test(digits) ? "" : "Número no válido";
  },

  cardBrand(d) {
    if (/^4/.test(d)) return "VISA";
    if (/^(5[1-5]|2[2-7])/.test(d)) return "MASTERCARD";
    if (/^3[47]/.test(d)) return "AMEX";
    return "";
  },

  luhn(num) {
    let sum = 0, alt = false;
    for (let i = num.length - 1; i >= 0; i--) {
      let n = Number(num[i]);
      if (alt) { n *= 2; if (n > 9) n -= 9; }
      sum += n; alt = !alt;
    }
    return sum % 10 === 0;
  },

  setMethod(method) {
    this.method = method;
    $$(".pay-tab").forEach(t => t.classList.toggle("active", t.dataset.method === method));
    $$("[data-method-pane]").forEach(p => { p.hidden = p.dataset.methodPane !== method; });
    const total = this.hold?.amounts.total ?? Booking.calc().total;
    $$('.pay-tab').forEach(tab => tab.setAttribute('aria-pressed', tab.dataset.method === method));
    $('#pay-submit').textContent = method === 'card' ? `Pagar ${Utils.money(total)}` : 'Enviar comprobante de prueba';
    if (method === 'yape' && this.hold) this.renderQR($('#yape-qr'), `BUGANVILLA DEMO|${this.hold.code}|PEN ${total.toFixed(2)}|SIN COBRO REAL`, 'Código QR de demostración, sin cobros');
  },

  validateCard() {
    const num = $("#c-number").value.replace(/\s/g, "");
    const brand = this.cardBrand(num);
    const errs = [];
    const nOk = /^\d{13,19}$/.test(num);
    this.setError($('#c-number'), nOk ? '' : 'Revisa el número de la tarjeta.'); if (!nOk) errs.push(1);

    const nameOk = $("#c-name").value.trim().length >= 3;
    this.setError($("#c-name"), nameOk ? "" : "Ingresa el nombre como figura en la tarjeta"); if (!nameOk) errs.push(1);

    const [mm, yy] = $("#c-exp").value.split("/").map(Number);
    const now = new Date();
    const expOk = mm >= 1 && mm <= 12 && yy >= 0 && new Date(2000 + yy, mm, 0, 23, 59) >= now;
    this.setError($("#c-exp"), expOk ? "" : "Fecha vencida o no válida"); if (!expOk) errs.push(1);

    const cvvLen = brand === "AMEX" ? 4 : 3;
    const cvvOk = new RegExp(`^\\d{${cvvLen}}$`).test($("#c-cvv").value);
    this.setError($("#c-cvv"), cvvOk ? "" : `CVV de ${cvvLen} dígitos`); if (!cvvOk) errs.push(1);

    return errs.length ? null : { num, brand: brand || 'VISA' };
  },

  async submitPayment() {
    if (this.busy || !this.hold || !this.customer) return;
    $('#payment-error').hidden = true;
    let payment;
    if (this.method === "card") {
      const card = this.validateCard();
      if (!card) { $("#form-pay .invalid")?.focus(); return; }
      payment = { method: 'card', brand: card.brand, scenario: card.num === '4000000000000002' ? 'declined' : 'approved' };
    } else {
      const op = $("#y-op").value.trim();
      const ok = /^\d{6,12}$/.test(op);
      this.setError($("#y-op"), ok ? "" : "Ingresa el número de operación (6 a 12 dígitos)");
      this.setError($('#receipt'), this.receipt ? '' : 'Adjunta el comprobante de prueba para revisión.');
      if (!ok || !this.receipt) return;
      payment = { method: 'yape', operation: op, receipt: this.receipt };
    }
    this.busy = true;
    $('#pay-submit').disabled = true;
    $('#processing-text').textContent = this.method === 'card' ? 'Confirmando tu reserva de prueba…' : 'Registrando tu comprobante…';
    $('#processing').classList.add('show');
    try {
      const reservation = await Store.pay(this.hold.code, this.hold.token, { customer: this.customer, companions: this.companions, payment });
      this.showPaidReservation(reservation);
      try { await Store.refresh(); Booking.renderCalendar(); Booking.renderSlots(); } catch { /* reserva guardada */ }
    } catch (error) {
      // Una respuesta perdida no equivale a un pago fallido: consultar el estado
      // evita ocultar una reserva ya confirmada o duplicar el intento.
      let recovered = null;
      try { recovered = await Store.fetchReservation(this.hold.code, this.hold.token); } catch { /* mantener error original */ }
      if (recovered && ['CONFIRMADA', 'PENDIENTE', 'COMPLETADA'].includes(recovered.status)) {
        this.showPaidReservation(recovered);
      } else {
        $('#payment-error').textContent = error.message;
        $('#payment-error').hidden = false;
        Utils.toast(error.message, 'error');
      }
    } finally {
      this.busy = false;
      $('#pay-submit').disabled = false;
      $('#processing').classList.remove('show');
    }
  },

  showPaidReservation(reservation) {
    this.lastReservation = reservation;
    try { sessionStorage.setItem('bgv_last_voucher', JSON.stringify({ code: reservation.code, token: reservation.token })); }
    catch { /* el voucher sigue disponible aunque el navegador impida guardar preferencias */ }
    ['#c-number', '#c-cvv', '#c-exp'].forEach(id => { $(id).value = ''; });
    this.stopHold();
    this.renderVoucher(reservation);
    this.goTo(3);
  },

  /* ----- Voucher ----- */
  renderVoucher(r) {
    const ok = r.status === "CONFIRMADA";
    const payTxt = r.payment.method === "card" ? `${r.payment.brand} •••• ${r.payment.last4}` : `Yape/Plin · Op. ${r.payment.operation}`;
    $("#voucher").innerHTML = `
      <div class="success-ico ${ok ? "" : "pending"}">${Icons.svg(ok ? 'check' : 'clock')}</div>
      <h2>${ok ? "¡Reserva confirmada!" : "¡Reserva registrada!"}</h2>
      <p class="muted">${ok
        ? 'Tu voucher está listo. Descárgalo y preséntalo en el punto de encuentro.'
        : 'Tu comprobante está pendiente de revisión en el panel del operador. Puedes consultar el estado desde tu voucher.'}</p>
      <div class="ticket">
        <div class="ticket-main">
          <span class="badge ${STATUS[r.status].badge}">${STATUS[r.status].label}</span>
          <div class="ticket-code" style="margin-top:.7rem">${r.code}</div>
          <div class="ticket-rows">
            <div><small>Tour</small><span>${r.tourTitle}</span></div>
            <div><small>Titular</small><span>${Utils.escape(r.customer.name)} ${Utils.escape(r.customer.last)}</span></div>
            <div><small>Fecha</small><span>${Utils.formatDateLong(r.date)}</span></div>
            <div><small>Turno</small><span>${r.slotTime} · ${r.slotLabel}</span></div>
            <div><small>Pasajeros</small><span>${r.pax.adults} adulto${r.pax.adults > 1 ? "s" : ""}${r.pax.children ? ` + ${r.pax.children} niño${r.pax.children > 1 ? "s" : ""}` : ""} · ${r.vehicles} UTV</span></div>
            <div><small>Total</small><span>${Utils.money(r.amounts.total, "PEN")}</span></div>
            <div><small>Pago de prueba</small><span>${Utils.escape(payTxt)}</span></div>
            <div><small>Punto de encuentro</small><span>${T.meetingPoint.name}</span></div>
          </div>
        </div>
        <div class="ticket-qr"><div class="qr-box" id="voucher-qr"></div><small>Check-in con QR</small></div>
      </div>
      <div class="voucher-actions">
        <a class="btn btn-ghost" id="v-pdf" href="${Utils.escape(Store.pdfURL(r))}" download>${Icons.svg('download')} Descargar PDF</a>
        <a class="btn btn-ghost" href="voucher.html?code=${encodeURIComponent(r.code)}&token=${encodeURIComponent(r.token)}">Consultar mi reserva</a>
        <a class="btn btn-whatsapp" id="v-share" target="_blank" rel="noopener">Compartir por WhatsApp</a>
        <button class="btn btn-primary" id="v-new">Hacer otra reserva</button>
      </div>`;

    this.renderQR($('#voucher-qr'), `${location.origin}/voucher.html?code=${encodeURIComponent(r.code)}&token=${encodeURIComponent(r.token)}`);

    const shareTxt = ` Mi reserva en Buganvilla Tours\n${r.tourTitle}\nCódigo: ${r.code}\n ${Utils.formatDateLong(r.date)} · ${r.slotTime}\n ${r.pax.adults + r.pax.children} pasajeros\n ${T.meetingPoint.name}`;
    $("#v-share").href = `https://wa.me/?text=${encodeURIComponent(shareTxt)}`;
    $("#v-new").addEventListener("click", () => { this.close(); document.getElementById("reservar").scrollIntoView({ behavior: "smooth" }); });
  },

  renderQR(el, text, label = 'Código QR del voucher') {
    el.innerHTML = `<img src="${Utils.escape(Store.qrURL(text))}" alt="${Utils.escape(label)}" width="140" height="140"/>`;
  },
};

Booking.init();
