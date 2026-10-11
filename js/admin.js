/* Operations panel. Reservation and capacity changes are validated by the server. */
Layout.render("admin");
const A = selector => document.querySelector(selector);

const Admin = {
  authenticated: false,
  refreshing: false,
  lastFingerprint: "",
  capacityDirty: false,
  view: "table",
  selectedCode: null,
  pendingOperation: null,
  calendarStart: null,
  statuses: {
    BORRADOR: { label: "Borrador", badge: "badge-warn" },
    PENDIENTE: { label: "Pendiente de verificación", badge: "badge-warn" },
    CONFIRMADA: { label: "Confirmada", badge: "badge-ok" },
    COMPLETADA: { label: "Completada", badge: "badge-oasis" },
    CANCELADA: { label: "Cancelada", badge: "badge-danger" },
    REEMBOLSADA: { label: "Reembolsada", badge: "badge-danger" },
    EXPIRADA: { label: "Expirada", badge: "badge-warn" },
  },
  init() {
    const today = this.today();
    this.calendarStart = this.weekStart(today);
    A("#occ-date").value = today;
    A("#occ-date").min = today;
    A("#occ-date").max = this.addDays(today, CONFIG.bookingWindowDays || 90);
    A("#f-status").insertAdjacentHTML("beforeend", Object.entries(this.statuses).map(([key, status]) => `<option value="${key}">${status.label}</option>`).join(""));
    A("#f-slot").insertAdjacentHTML("beforeend", UTV_TOUR.slots.map(slot => `<option value="${this.esc(slot.id)}">${this.esc(slot.time)} · ${this.esc(slot.label)}</option>`).join(""));
    A("#login-form").addEventListener("submit", event => { event.preventDefault(); this.login(); });
    A("#admin-logout").addEventListener("click", () => this.logout());
    ["#q", "#f-status", "#f-date", "#f-slot"].forEach(id => A(id).addEventListener("input", () => {
      if (id === "#f-date" && A(id).value) this.calendarStart = this.weekStart(A(id).value);
      this.renderResults();
    }));
    A("#filters-clear").addEventListener("click", () => {
      A("#q").value = ""; A("#f-status").value = "active"; A("#f-date").value = ""; A("#f-slot").value = "";
      this.renderResults();
    });
    A("#occ-date").addEventListener("change", () => {
      this.capacityDirty = false;
      this.refresh({ capacity: true }).catch(error => this.showError(error));
    });
    A("#cap-form").addEventListener("input", () => { this.capacityDirty = true; });
    A("#cap-form").addEventListener("submit", event => { event.preventDefault(); this.saveCapacity(); });
    A("#btn-seed").addEventListener("click", () => this.seed());
    A("#btn-export").addEventListener("click", () => this.exportCSV());
    A("#view-table").addEventListener("click", () => this.setView("table"));
    A("#view-calendar").addEventListener("click", () => this.setView("calendar"));
    A("#calendar-prev").addEventListener("click", () => this.moveWeek(-7));
    A("#calendar-next").addEventListener("click", () => this.moveWeek(7));
    A("#calendar-today").addEventListener("click", () => { this.calendarStart = this.weekStart(this.today()); A("#f-date").value = ""; this.renderResults(); });
    A("#res-body").addEventListener("click", event => this.handleAction(event));
    A("#calendar-days").addEventListener("click", event => this.handleAction(event));
    A("#details-content").addEventListener("click", event => this.handleAction(event));
    A("#detail-close").addEventListener("click", () => A("#res-details").close());
    A("#res-details").addEventListener("close", () => { this.selectedCode = null; });
    A("#operation-back").addEventListener("click", () => A("#operation-dialog").close());
    A("#operation-dialog").addEventListener("close", () => { this.pendingOperation = null; });
    A("#operation-form").addEventListener("submit", event => { event.preventDefault(); this.commitOperation(); });
    this.timer = setInterval(() => {
      const editingCapacity = A("#cap-form").contains(document.activeElement);
      if (this.authenticated && !document.hidden && !this.capacityDirty && !editingCapacity && !A("dialog[open]") && !this.refreshing) this.refresh().catch(error => this.showError(error, true));
    }, 15000);
  },
  esc(value) { return Utils.escape(value == null ? "" : value); },
  today() { return Utils.todayISO(); },
  addDays(iso, days) { const date = new Date(`${iso}T12:00:00`); date.setDate(date.getDate() + days); return Utils.toISODate(date); },
  weekStart(iso) { const day = new Date(`${iso}T12:00:00`).getDay(); return this.addDays(iso, -(day === 0 ? 6 : day - 1)); },
  shortDate(iso) { return iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("es-PE", { day: "2-digit", month: "short" }) : "Sin fecha"; },
  timestamp(value) {
    if (!value || Number.isNaN(new Date(value).getTime())) return "Sin registrar";
    return new Date(value).toLocaleString("es-PE", { timeZone: "America/Lima", dateStyle: "short", timeStyle: "short" });
  },
  total(reservation) { return Number(reservation.amounts?.total) || 0; },
  pax(reservation) { return (Number(reservation.pax?.adults) || 0) + (Number(reservation.pax?.children) || 0); },
  status(key) { return this.statuses[key] || { label: key || "Sin registrar", badge: "" }; },
  badge(key) { const status = this.status(key); return `<span class="badge ${status.badge}">${this.esc(status.label)}</span>`; },
  isSessionError(error) { return error?.status === 401 || error?.statusCode === 401 || ["AUTH_REQUIRED", "UNAUTHORIZED"].includes(error?.code); },
  showError(error, silent = false) {
    if (this.isSessionError(error)) {
      this.lock(); A("#login-error").textContent = "La sesión ha expirado. Ingresa nuevamente para continuar."; A("#login-error").hidden = false;
      return;
    }
    A("#sync-status").textContent = "No se pudo actualizar. Los datos visibles corresponden a la última sincronización.";
    if (!silent) Utils.toast(error?.message || "No se pudo completar la operación. Intenta nuevamente.", "error");
  },
  lock() {
    this.authenticated = false; this.selectedCode = null; this.pendingOperation = null;
    document.querySelectorAll("dialog[open]").forEach(dialog => dialog.close());
    A("#admin-workspace").hidden = true; A("#admin-login").hidden = false;
    A("#admin-password").value = ""; A("#admin-password").focus();
  },
  async login() {
    const button = A("#login-submit");
    if (button.disabled) return;
    button.disabled = true; button.textContent = "Verificando acceso..."; A("#login-error").hidden = true;
    try {
      await Store.login(A("#admin-password").value);
      await this.refresh({ capacity: true });
      this.authenticated = true; A("#admin-password").value = "";
      A("#admin-login").hidden = true; A("#admin-workspace").hidden = false; A("#q").focus();
      const requestedCode = new URLSearchParams(location.search).get("code");
      if (requestedCode) this.showDetails(requestedCode);
    } catch (error) { A("#login-error").textContent = error?.message || "No se pudo iniciar sesión. Revisa la contraseña y la conexión."; A("#login-error").hidden = false; }
    finally { button.disabled = false; button.textContent = "Entrar al panel"; }
  },
  async logout() {
    A("#admin-logout").disabled = true;
    try { await Store.logout(); this.lock(); }
    catch (error) { this.showError(error); }
    finally { A("#admin-logout").disabled = false; }
  },
  async refresh({ capacity = false } = {}) {
    if (this.refreshing) return;
    this.refreshing = true;
    try {
      await Store.refresh({ admin: true, date: A("#occ-date").value });
      const date = A("#occ-date").value;
      const fingerprint = JSON.stringify([Store.getReservations(), date, UTV_TOUR.slots.map(slot => Store.getAvailability(UTV_TOUR.id, date, slot.id))]);
      if (capacity || fingerprint !== this.lastFingerprint) {
        this.renderResults(); this.renderOccupancy();
        if (capacity || !this.capacityDirty) this.renderCapacity();
        this.lastFingerprint = fingerprint;
      }
      A("#sync-status").textContent = `Sincronizado a las ${new Date().toLocaleTimeString("es-PE", { timeZone: "America/Lima", hour: "2-digit", minute: "2-digit" })} · Actualización cada 15 segundos`;
    } finally { this.refreshing = false; }
  },
  filtered() {
    const query = A("#q").value.trim().toLocaleLowerCase("es");
    const status = A("#f-status").value, date = A("#f-date").value, slot = A("#f-slot").value;
    return Store.getReservations().filter(reservation => {
      if (status === "active" && !["PENDIENTE", "CONFIRMADA", "COMPLETADA"].includes(reservation.status)) return false;
      if (status && status !== "active" && reservation.status !== status) return false;
      if (date && reservation.date !== date) return false;
      if (slot && reservation.slotId !== slot) return false;
      const customer = reservation.customer || {};
      return !query || [reservation.code, customer.name, customer.last, customer.doc, customer.email, customer.phone].join(" ").toLocaleLowerCase("es").includes(query);
    }).sort((a, b) => `${a.date}|${a.slotTime}|${a.createdAt}`.localeCompare(`${b.date}|${b.slotTime}|${b.createdAt}`));
  },
  renderResults() {
    const list = this.filtered();
    A("#res-count").textContent = `${list.length} reserva${list.length === 1 ? "" : "s"} según los filtros`;
    this.renderKPIs(list); this.renderTable(list); this.renderCalendar(list); this.renderAnalytics(list);
    A("#btn-export").disabled = list.length === 0;
  },
  renderKPIs(list) {
    const confirmed = list.filter(reservation => ["CONFIRMADA", "COMPLETADA"].includes(reservation.status));
    const pending = list.filter(reservation => reservation.status === "PENDIENTE");
    const items = [
      ["Reservas", list.length, "Resultados filtrados"],
      ["Confirmadas", confirmed.length, `${confirmed.filter(reservation => reservation.status === "COMPLETADA").length} experiencias completadas`],
      ["Por verificar", pending.length, `${Utils.money(pending.reduce((sum, reservation) => sum + this.total(reservation), 0), "PEN")} pendientes`],
      ["Ingresos confirmados", Utils.money(confirmed.reduce((sum, reservation) => sum + this.total(reservation), 0), "PEN"), "Reservas confirmadas y completadas"],
      ["Pasajeros", list.reduce((sum, reservation) => sum + this.pax(reservation), 0), "En las reservas seleccionadas"],
    ];
    A("#kpis").innerHTML = items.map(([label, value, note]) => `<div class="kpi glass"><small>${this.esc(label)}</small><strong>${this.esc(value)}</strong><span>${this.esc(note)}</span></div>`).join("");
  },
  paymentLabel(reservation) {
    const payment = reservation.payment || {};
    if (payment.method === "card") return [payment.brand || "Tarjeta", payment.last4 ? `terminada en ${payment.last4}` : ""].filter(Boolean).join(" ");
    if (["yape", "plin"].includes(payment.method)) return `${payment.method === "yape" ? "Yape" : "Plin"}${payment.operation ? ` · ${payment.operation}` : ""}`;
    return "Sin registrar";
  },
  renderTable(list) {
    A("#res-body").innerHTML = list.length ? list.map(reservation => {
      const customer = reservation.customer || {};
      return `<tr><td><span class="code">${this.esc(reservation.code)}</span><small>${this.esc(this.timestamp(reservation.createdAt))}</small></td><td>${this.esc(this.shortDate(reservation.date))}<small>${this.esc(reservation.slotTime)} · ${this.esc(reservation.slotLabel)}</small></td><td>${this.esc([customer.name, customer.last].filter(Boolean).join(" "))}<small>${this.esc(customer.email)}</small></td><td>${this.pax(reservation)}<small>${Number(reservation.vehicles) || 0} UTV</small></td><td><strong>${this.esc(Utils.money(this.total(reservation), "PEN"))}</strong></td><td>${this.esc(this.paymentLabel(reservation))}</td><td>${this.badge(reservation.status)}</td><td><button type="button" class="btn btn-ghost btn-sm" data-action="detail" data-code="${this.esc(reservation.code)}">Ver detalle</button></td></tr>`;
    }).join("") : '<tr><td colspan="8" class="empty">No hay reservas que coincidan con estos filtros.</td></tr>';
  },
  setView(view) {
    this.view = view; A("#table-view").hidden = view !== "table"; A("#calendar-view").hidden = view !== "calendar";
    ["table", "calendar"].forEach(name => { A(`#view-${name}`).classList.toggle("active", name === view); A(`#view-${name}`).setAttribute("aria-pressed", String(name === view)); });
  },
  moveWeek(days) { this.calendarStart = this.addDays(this.calendarStart, days); A("#f-date").value = ""; this.renderResults(); },
  renderCalendar(list) {
    const last = this.addDays(this.calendarStart, 6);
    A("#calendar-range").textContent = `${this.shortDate(this.calendarStart)} al ${this.shortDate(last)}`;
    A("#calendar-days").innerHTML = Array.from({ length: 7 }, (_, index) => {
      const date = this.addDays(this.calendarStart, index);
      const title = new Date(`${date}T12:00:00`).toLocaleDateString("es-PE", { weekday: "short", day: "numeric", month: "short" });
      const dayReservations = list.filter(reservation => reservation.date === date);
      return `<section class="calendar-day ${date === this.today() ? "is-today" : ""}"><h4>${this.esc(title)}${date === this.today() ? '<small>Hoy</small>' : ""}</h4>${dayReservations.length ? UTV_TOUR.slots.filter(slot => !A("#f-slot").value || slot.id === A("#f-slot").value).map(slot => {
        const reservations = dayReservations.filter(reservation => reservation.slotId === slot.id);
        if (!reservations.length) return "";
        return `<div class="calendar-slot"><strong>${this.esc(slot.time)}</strong>${reservations.map(reservation => `<button class="calendar-reservation" type="button" data-action="detail" data-code="${this.esc(reservation.code)}"><span class="code">${this.esc(reservation.code)}</span><span>${this.esc(reservation.customer?.name || "Titular")} · ${this.pax(reservation)} pax</span>${this.badge(reservation.status)}</button>`).join("")}</div>`;
      }).join("") : '<p class="calendar-empty">Sin reservas</p>'}</section>`;
    }).join("");
  },
  renderOccupancy() {
    const date = A("#occ-date").value;
    A("#occupancy").innerHTML = UTV_TOUR.slots.map(slot => {
      const availability = Store.getAvailability(UTV_TOUR.id, date, slot.id);
      const used = Number(availability.usedVehicles) || 0, vehicles = Number(availability.vehicles) || 0;
      const percent = vehicles ? Math.min(100, Math.round(used / vehicles * 100)) : 0;
      return `<div class="occ-slot"><div class="occ-top"><span><strong>${this.esc(slot.time)}</strong><small>${this.esc(slot.label)}</small></span><span>${availability.closed ? "Cerrado" : `${used} / ${vehicles} UTV`}</span></div><div class="bar ${availability.closed ? "closed" : ""}" role="progressbar" aria-label="Ocupación del turno ${this.esc(slot.time)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><i style="width:${percent}%"></i></div><small class="muted">${Store.getBookedSeats(UTV_TOUR.id, date, slot.id)} pasajeros reservados · ${Number(availability.freeVehicles) || 0} unidades disponibles</small></div>`;
    }).join("");
  },
  renderCapacity() {
    const date = A("#occ-date").value;
    A("#cap-form").innerHTML = UTV_TOUR.slots.map(slot => {
      const capacity = Store.getCapacity(UTV_TOUR.id, date, slot.id);
      const used = Store.getBookedVehicles(UTV_TOUR.id, date, slot.id);
      return `<div class="cap-row"><div><strong>${this.esc(slot.time)} · ${this.esc(slot.label)}</strong><small>${used} UTV ocupados o bloqueados</small></div><input class="input" type="number" required min="${used}" max="20" step="1" id="cap-${this.esc(slot.id)}" value="${Number(capacity.vehicles) || 0}" aria-label="Unidades del turno ${this.esc(slot.time)}" /><label class="checkbox"><input type="checkbox" id="closed-${this.esc(slot.id)}" ${capacity.closed ? "checked" : ""} /> Cerrar</label></div>`;
    }).join("") + '<button class="btn btn-primary btn-sm btn-block" type="submit" id="cap-save">Guardar disponibilidad</button>';
    this.capacityDirty = false; A("#capacity-error").hidden = true;
  },
  async saveCapacity() {
    if (!A("#cap-form").reportValidity()) return;
    const button = A("#cap-save"); button.disabled = true; button.textContent = "Guardando..."; A("#capacity-error").hidden = true;
    const rows = UTV_TOUR.slots.map(slot => ({ slotId: slot.id, vehicles: Number(A(`#cap-${slot.id}`).value), closed: A(`#closed-${slot.id}`).checked }));
    try {
      await Store.setCapacities(A("#occ-date").value, rows);
      this.capacityDirty = false; await this.refresh({ capacity: true }); Utils.toast("Disponibilidad actualizada", "ok");
    } catch (error) {
      if (this.isSessionError(error)) this.showError(error);
      else { A("#capacity-error").textContent = error?.message || "No se pudo guardar. La capacidad debe cubrir las reservas y los bloqueos vigentes."; A("#capacity-error").hidden = false; }
    } finally { if (button.isConnected) { button.disabled = false; button.textContent = "Guardar disponibilidad"; } }
  },
  handleAction(event) {
    const button = event.target.closest("[data-action]"); if (!button) return;
    if (button.dataset.action === "detail") this.showDetails(button.dataset.code);
    else this.prepareOperation(button.dataset.code, button.dataset.action);
  },
  receiptURL(reservation) {
    const raw = reservation.payment?.receiptUrl || reservation.payment?.receipt?.url || reservation.receiptUrl;
    if (!raw) return null;
    try { const url = new URL(raw, location.href); return url.origin === location.origin && url.pathname.startsWith("/api/admin/") ? url.href : null; } catch { return null; }
  },
  field(label, value) { return `<div><dt>${this.esc(label)}</dt><dd>${this.esc(value || "Sin registrar")}</dd></div>`; },
  detailActions(reservation) {
    const code = this.esc(reservation.code); const actions = [];
    if (!["BORRADOR", "EXPIRADA"].includes(reservation.status)) actions.push(`<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener noreferrer" href="/api/admin/reservations/${encodeURIComponent(reservation.code)}/voucher.pdf">Descargar voucher PDF</a>`);
    if (reservation.status === "PENDIENTE") actions.push(`<button class="btn btn-primary btn-sm" type="button" data-action="confirm" data-code="${code}">Verificar y confirmar</button>`);
    if (reservation.status === "CONFIRMADA") actions.push(`<button class="btn btn-primary btn-sm" type="button" data-action="complete" data-code="${code}">Marcar completada</button>`);
    if (["PENDIENTE", "CONFIRMADA"].includes(reservation.status)) actions.push(`<button class="btn btn-ghost btn-sm danger" type="button" data-action="cancel" data-code="${code}">Cancelar reserva</button>`);
    if (reservation.status === "CANCELADA" && reservation.history?.some(item => item.status === "CONFIRMADA")) actions.push(`<button class="btn btn-ghost btn-sm" type="button" data-action="refund" data-code="${code}">Registrar reembolso simulado</button>`);
    const phone = String(reservation.customer?.phone || "").replace(/\D/g, "");
    if (phone.length >= 8 && phone.length <= 15) actions.push(`<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener noreferrer" href="https://wa.me/${phone}?text=${encodeURIComponent(`Hola ${reservation.customer?.name || ""}, te escribimos de Buganvilla Tours por tu reserva ${reservation.code}.`)}">Contactar por WhatsApp</a>`);
    return actions.join("");
  },
  showDetails(code) {
    const reservation = Store.getReservations().find(item => item.code === code); if (!reservation) return;
    this.selectedCode = code; A("#detail-title").textContent = code;
    const customer = reservation.customer || {}, receipt = this.receiptURL(reservation);
    const companions = reservation.companions || reservation.passengers || reservation.travelers || [];
    const extras = reservation.extras || [];
    A("#details-content").innerHTML = `<div class="detail-summary">${this.badge(reservation.status)}<span>${this.esc(reservation.tourTitle || UTV_TOUR.title)}</span><strong>${this.esc(Utils.money(this.total(reservation), "PEN"))}</strong></div><div class="details-grid">
      <section class="detail-section"><h3>Salida y pasajeros</h3><dl class="detail-list">${this.field("Fecha", reservation.date ? Utils.formatDateLong(reservation.date) : "Sin fecha")}${this.field("Turno", [reservation.slotTime, reservation.slotLabel].filter(Boolean).join(" · "))}${this.field("Grupo", `${Number(reservation.pax?.adults) || 0} adultos · ${Number(reservation.pax?.children) || 0} niños`)}${this.field("Vehículos", `${Number(reservation.vehicles) || 0} UTV`)}${this.field("Canal", this.channel(reservation))}${this.field("Creada", this.timestamp(reservation.createdAt))}</dl></section>
      <section class="detail-section"><h3>Titular de la reserva</h3><dl class="detail-list">${this.field("Nombre", [customer.name, customer.last].filter(Boolean).join(" "))}${this.field("Documento", [customer.docType, customer.doc].filter(Boolean).join(" "))}${this.field("Correo", customer.email)}${this.field("WhatsApp", customer.phone)}${this.field("Nacionalidad", customer.nationality)}${this.field("Solicitudes", customer.notes)}</dl></section>
      <section class="detail-section"><h3>Acompañantes para el seguro</h3>${companions.length ? `<ul class="companion-list">${companions.map((person, index) => `<li><strong>${this.esc([person.name, person.last].filter(Boolean).join(" ") || `Acompañante ${index + 1}`)}</strong><span>${this.esc([person.docType, person.doc || person.document].filter(Boolean).join(" ") || "Documento sin registrar")}${person.age != null ? ` · ${this.esc(person.age)} años` : ""}</span></li>`).join("")}</ul>` : '<p class="muted">No hay acompañantes registrados.</p>'}</section>
      <section class="detail-section"><h3>Pago y servicios</h3><dl class="detail-list">${this.field("Método", this.paymentLabel(reservation))}${this.field("Tarifa base", Utils.money(Number(reservation.amounts?.base) || 0, "PEN"))}${this.field("Complementos", Utils.money(Number(reservation.amounts?.extras) || 0, "PEN"))}${this.field("Total", Utils.money(this.total(reservation), "PEN"))}</dl>${extras.length ? `<ul class="detail-extras">${extras.map(extra => `<li>${this.esc(extra.label)} · ${this.esc(Utils.money(Number(extra.amount) || 0, "PEN"))}</li>`).join("")}</ul>` : ""}${receipt ? `<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener noreferrer" href="${this.esc(receipt)}">Abrir comprobante</a>` : '<p class="form-note">No hay un comprobante adjunto.</p>'}${reservation.payment?.method === "card" ? '<p class="form-note">Pago de demostración. No representa un cobro real.</p>' : ""}</section>
      <section class="detail-section detail-history"><h3>Historial de la reserva</h3>${reservation.history?.length ? `<ol class="history-list">${reservation.history.map(item => `<li><strong>${this.esc(this.status(item.status).label)}</strong><time datetime="${this.esc(item.at)}">${this.esc(this.timestamp(item.at))}</time>${item.note ? `<span>${this.esc(item.note)}</span>` : ""}</li>`).join("")}</ol>` : '<p class="muted">Sin movimientos registrados.</p>'}</section></div><div class="dialog-actions">${this.detailActions(reservation)}</div>`;
    if (!A("#res-details").open) A("#res-details").showModal();
  },
  prepareOperation(code, action) {
    const reservation = Store.getReservations().find(item => item.code === code); if (!reservation) return;
    const operations = {
      confirm: { from: ["PENDIENTE"], status: "CONFIRMADA", title: "Verificar pago y confirmar", copy: `Confirma que revisaste el comprobante de ${code} por ${Utils.money(this.total(reservation), "PEN")} y que el importe fue recibido. La reserva pasará a confirmada.` },
      complete: { from: ["CONFIRMADA"], status: "COMPLETADA", title: "Completar experiencia", copy: `Marca ${code} como completada una vez que los pasajeros hayan realizado la experiencia. El registro de pago se conserva.` },
      cancel: { from: ["PENDIENTE", "CONFIRMADA"], status: "CANCELADA", title: "Cancelar reserva", copy: `Cancelar ${code} libera ${Number(reservation.vehicles) || 0} UTV del turno. ${reservation.status === "CONFIRMADA" ? "El pago no se reembolsa automáticamente. Podrás registrar un reembolso simulado después de cancelar." : "La reserva dejará de ocupar cupos."}` },
      refund: { from: ["CANCELADA"], status: "REEMBOLSADA", title: "Registrar reembolso simulado", copy: `Esta acción registra el reembolso de demostración de ${code} por ${Utils.money(this.total(reservation), "PEN")}. No envía dinero ni ejecuta un reembolso bancario.` },
    };
    const operation = operations[action]; if (!operation || !operation.from.includes(reservation.status)) return;
    this.pendingOperation = { code, ...operation }; A("#operation-title").textContent = operation.title; A("#operation-copy").textContent = operation.copy;
    A("#operation-error").hidden = true; A("#operation-submit").textContent = operation.title; A("#operation-dialog").showModal();
  },
  async commitOperation() {
    const operation = this.pendingOperation; if (!operation) return;
    const button = A("#operation-submit"); if (button.disabled) return;
    button.disabled = true; button.textContent = "Procesando...";
    try {
      await Store.updateStatus(operation.code, operation.status);
      await this.refresh(); A("#operation-dialog").close();
      if (A("#res-details").open) this.showDetails(operation.code);
      Utils.toast(`Reserva ${operation.code}: ${this.status(operation.status).label}`, "ok");
    } catch (error) {
      if (this.isSessionError(error)) this.showError(error);
      else { A("#operation-error").textContent = error?.message || "No se pudo actualizar la reserva."; A("#operation-error").hidden = false; }
    } finally { button.disabled = false; button.textContent = operation.title; }
  },
  channel(reservation) {
    const channel = reservation.channel || reservation.source;
    return ({ web: "Web directa", direct: "Web directa", whatsapp: "WhatsApp", agency: "Agencia", demo: "Demostración" })[channel] || channel || "Sin registrar";
  },
  confirmationDate(reservation) {
    const event = (reservation.history || []).find(item => item.status === "CONFIRMADA");
    const value = event?.at || reservation.confirmedAt;
    if (!value || Number.isNaN(new Date(value).getTime())) return null;
    return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
  },
  renderAnalytics(list) {
    const days = Array.from({ length: 7 }, (_, index) => this.addDays(this.today(), index - 6));
    const revenue = days.map(date => list.filter(reservation => ["CONFIRMADA", "COMPLETADA"].includes(reservation.status) && this.confirmationDate(reservation) === date).reduce((sum, reservation) => sum + this.total(reservation), 0));
    const total = revenue.reduce((sum, value) => sum + value, 0);
    A("#revenue-total").textContent = Utils.money(total, "PEN");
    const max = Math.max(...revenue, 1), top = 24, floor = 160, left = 68, gap = 66, width = 34;
    const bars = revenue.map((value, index) => { const height = value / max * (floor - top); const x = left + index * gap; return `<g><rect class="chart-bar" x="${x}" y="${floor - height}" width="${width}" height="${height}" rx="4"><title>${this.esc(this.shortDate(days[index]))}: ${this.esc(Utils.money(value, "PEN"))}</title></rect><text class="chart-label" x="${x + width / 2}" y="190" text-anchor="middle">${this.esc(this.shortDate(days[index]))}</text></g>`; }).join("");
    A("#revenue-chart").innerHTML = `<svg class="revenue-svg" viewBox="0 0 550 210" role="img" aria-labelledby="chart-caption"><title id="chart-caption">Ingresos confirmados en los últimos siete días: ${this.esc(Utils.money(total, "PEN"))}</title><line class="chart-gridline" x1="60" y1="${floor}" x2="535" y2="${floor}" /><line class="chart-gridline" x1="60" y1="${top}" x2="535" y2="${top}" /><text class="chart-label" x="50" y="${floor + 4}" text-anchor="end">0</text><text class="chart-label" x="50" y="${top + 4}" text-anchor="end">${Math.round(max)}</text>${bars}</svg>${total === 0 ? '<p class="chart-empty muted">No hay ingresos confirmados en este período.</p>' : ""}`;
    const groups = new Map(); list.forEach(reservation => { const name = this.channel(reservation); groups.set(name, (groups.get(name) || 0) + this.pax(reservation)); });
    const paxTotal = Array.from(groups.values()).reduce((sum, value) => sum + value, 0);
    A("#channel-metrics").innerHTML = paxTotal ? Array.from(groups).sort((a, b) => b[1] - a[1]).map(([name, passengers]) => { const percent = Math.round(passengers / paxTotal * 100); return `<div class="channel-row"><div class="occ-top"><strong>${this.esc(name)}</strong><span>${passengers} pasajeros · ${percent}%</span></div><div class="bar"><i style="width:${percent}%"></i></div></div>`; }).join("") : '<p class="empty">No hay pasajeros en las reservas seleccionadas.</p>';
  },
  async seed() {
    const button = A("#btn-seed"); button.disabled = true; button.textContent = "Cargando...";
    try { await Store.seed(); await this.refresh(); Utils.toast("Datos de demostración disponibles. Las reservas existentes se conservan.", "ok"); }
    catch (error) { this.showError(error); }
    finally { button.disabled = false; button.textContent = "Cargar datos demo"; }
  },
  exportCSV() {
    const list = this.filtered(); if (!list.length) return;
    const headers = ["Código", "Fecha", "Turno", "Nombres", "Apellidos", "Documento", "Correo", "Teléfono", "Adultos", "Niños", "UTV", "Total PEN", "Pago", "Estado", "Canal", "Creada"];
    const escapeCSV = value => {
      let text = String(value ?? "");
      // Excel interprets formulas even when the CSV cell is quoted.
      if (/^[\s\u0000-\u001f]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
      return `"${text.replace(/"/g, '""')}"`;
    };
    const rows = list.map(reservation => { const customer = reservation.customer || {}; return [reservation.code, reservation.date, reservation.slotTime, customer.name, customer.last, [customer.docType, customer.doc].filter(Boolean).join(" "), customer.email, customer.phone, reservation.pax?.adults, reservation.pax?.children, reservation.vehicles, this.total(reservation).toFixed(2), this.paymentLabel(reservation), this.status(reservation.status).label, this.channel(reservation), reservation.createdAt].map(escapeCSV).join(","); });
    const blob = new Blob(["\uFEFF", [headers.map(escapeCSV).join(","), ...rows].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a"); const url = URL.createObjectURL(blob);
    link.href = url; link.download = `reservas-buganvilla-${this.today()}.csv`; document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    Utils.toast(`${list.length} reservas exportadas según los filtros`, "ok");
  },
};
Admin.init();
