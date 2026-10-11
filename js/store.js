/* API local: disponibilidad y reservas persistidas en SQLite. */
const STATUS = {
  BORRADOR: { label: "Selección reservada", badge: "badge-warn" },
  PENDIENTE: { label: "Pago por verificar", badge: "badge-warn" },
  CONFIRMADA: { label: "Confirmada", badge: "badge-ok" },
  CANCELADA: { label: "Cancelada", badge: "badge-danger" },
  REEMBOLSADA: { label: "Reembolsada", badge: "badge-oasis" },
  COMPLETADA: { label: "Completada", badge: "badge-oasis" },
  EXPIRADA: { label: "Selección vencida", badge: "badge-danger" },
};

const Store = {
  ready: false, online: false, config: {}, _availability: {}, _reservations: [], _own: new Map(), clockOffset: 0,
  async _request(path, options = {}) {
    try {
      const response = await fetch(path, { credentials: "same-origin", ...options,
        headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
      const result = await response.json(); this.online = true;
      if (!response.ok) { const error = new Error(result.error || "No fue posible completar la operación."); error.status = response.status; error.code = result.code; throw error; }
      return result;
    } catch (error) { if (!error.status) this.online = false; throw error; }
  },
  async refresh({ admin = false } = {}) {
    const requests = [this._request("/api/bootstrap")];
    if (admin) requests.push(this._request("/api/admin/reservations"));
    const [data, reservations] = await Promise.all(requests);
    this.config = data.config; this._availability = data.availability; this.clockOffset = data.serverTime - Date.now(); this.ready = true;
    if (typeof CONFIG !== "undefined") { for (const key of ["exchangeRate", "bookingWindowDays", "minHoursBeforeDeparture"]) if (data.config[key] !== undefined) CONFIG[key] = data.config[key]; }
    if (typeof UTV_TOUR !== "undefined") {
      Object.assign(UTV_TOUR.prices, data.config.prices || {});
      for (const slot of UTV_TOUR.slots) { const source = data.config.slots?.find(item => item.id === slot.id); if (source) Object.assign(slot, source); }
      for (const extra of UTV_TOUR.extras) { const source = data.config.extras?.find(item => item.id === extra.id); if (source) Object.assign(extra, source); }
    }
    if (typeof TOURS !== "undefined") { const tour = TOURS.find(item => item.id === "utv-huacachina"); if (tour && data.config.prices) tour.priceFrom = data.config.prices.adult; }
    if (admin) this._reservations = reservations.reservations;
    document.dispatchEvent(new CustomEvent("availabilitychange")); return data;
  },
  getReservations() { return this._reservations; },
  getReservation(code) { return this._own.get(code) || this._reservations.find(r => r.code === code); },
  _cacheMutation(r) {
    const before = this.getReservation(r.code), active = ["BORRADOR", "PENDIENTE", "CONFIRMADA", "COMPLETADA"];
    const allocation = entry => entry && active.includes(entry.status) ? entry.vehicles : 0;
    const seats = entry => entry && active.includes(entry.status) ? entry.pax.adults + entry.pax.children : 0;
    const av = this._availability[`${r.date}|${r.slotId}`];
    if (av) { av.usedVehicles = Math.max(0, av.usedVehicles + allocation(r) - allocation(before)); av.bookedSeats = Math.max(0, av.bookedSeats + seats(r) - seats(before)); av.freeVehicles = av.closed || av.expired ? 0 : Math.max(0, av.vehicles - av.usedVehicles); av.freeSeats = av.freeVehicles * 3; }
    this._own.set(r.code, r);
  },
  async _refreshAfterWrite(options) { try { await this.refresh(options); } catch { this.online = false; } },
  getAvailability(tourId, date, slotId, ignoreCode) {
    const empty = { vehicles: 0, seats: 0, closed: false, usedVehicles: 0, bookedSeats: 0, freeVehicles: 0, freeSeats: 0, expired: false };
    if (tourId !== "utv-huacachina") return empty;
    const av = { ...(this._availability[`${date}|${slotId}`] || empty) }, hold = ignoreCode && this._own.get(ignoreCode);
    if (hold && hold.status === "BORRADOR" && hold.expiresAt > Utils.serverNow() && hold.date === date && hold.slotId === slotId && !av.closed && !av.expired) {
      av.usedVehicles = Math.max(0, av.usedVehicles - hold.vehicles); av.bookedSeats = Math.max(0, av.bookedSeats - hold.pax.adults - hold.pax.children);
      av.freeVehicles = Math.min(av.vehicles, av.freeVehicles + hold.vehicles); av.freeSeats = av.freeVehicles * 3;
    }
    return av;
  },
  getCapacity(tourId, date, slotId) { const av = this.getAvailability(tourId, date, slotId); return { vehicles: av.vehicles, seats: av.seats, closed: av.closed }; },
  getBookedSeats(tourId, date, slotId) { return this.getAvailability(tourId, date, slotId).bookedSeats; },
  getBookedVehicles(tourId, date, slotId) { return this.getAvailability(tourId, date, slotId).usedVehicles; },
  getCurrency() { try { return localStorage.getItem("bgv_currency") === "USD" ? "USD" : "PEN"; } catch { return "PEN"; } },
  setCurrency(currency) { if (!["PEN", "USD"].includes(currency)) return; try { localStorage.setItem("bgv_currency", currency); } catch {} },
  async createHold(selection) { const r = await this._request("/api/holds", { method: "POST", body: JSON.stringify(selection) }); this._cacheMutation(r); await this._refreshAfterWrite(); return r; },
  async releaseHold(code, token) { const r = await this._request(`/api/reservations/${encodeURIComponent(code)}/release`, { method: "POST", body: JSON.stringify({ token }) }); this._cacheMutation(r); await this._refreshAfterWrite(); return r; },
  async pay(code, token, data) { const r = await this._request(`/api/reservations/${encodeURIComponent(code)}/pay`, { method: "POST", body: JSON.stringify({ ...data, token }) }); this._cacheMutation(r); await this._refreshAfterWrite(); return r; },
  async fetchReservation(code, token) { const r = await this._request(`/api/reservations/${encodeURIComponent(code)}?token=${encodeURIComponent(token)}`); this._own.set(r.code, r); return r; },
  async updateStatus(code, status) { const r = await this._request(`/api/admin/reservations/${encodeURIComponent(code)}/status`, { method: "POST", body: JSON.stringify({ status }) }); this._cacheMutation(r); this._reservations = this._reservations.map(entry => entry.code === r.code ? r : entry); await this._refreshAfterWrite({ admin: true }); return r; },
  async setCapacities(date, updates) { await this._request("/api/admin/capacity", { method: "POST", body: JSON.stringify({ date, updates }) }); return this.refresh({ admin: true }); },
  async login(password) { await this._request("/api/admin/login", { method: "POST", body: JSON.stringify({ password }) }); return this.refresh({ admin: true }); },
  async logout() { await this._request("/api/admin/logout", { method: "POST", body: "{}" }); this._reservations = []; },
  async seed() { const result = await this._request("/api/admin/seed", { method: "POST", body: "{}" }); await this.refresh({ admin: true }); return result; },
  pdfURL(r) { return `/api/reservations/${encodeURIComponent(r.code)}/voucher.pdf?token=${encodeURIComponent(r.token || "")}`; },
  qrURL(text) { return `/api/qr?text=${encodeURIComponent(text)}`; },
  receiptURL(code) { return `/api/admin/reservations/${encodeURIComponent(code)}/receipt`; },
  adminPdfURL(code) { return `/api/admin/reservations/${encodeURIComponent(code)}/voucher.pdf`; },
};

const Utils = {
  serverNow() { return Date.now() + Store.clockOffset; },
  money(amountPEN, currency = Store.getCurrency()) { const rate = Store.config.exchangeRate || CONFIG.exchangeRate; return currency === "USD" ? "US$ " + (amountPEN / rate).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "S/ " + Number(amountPEN).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); },
  todayISO() { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(this.serverNow())); },
  toISODate(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; },
  fromISODate(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); },
  formatDateLong(iso) { return this.fromISODate(iso).toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); },
  escape(str = "") { return String(str).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); },
  toast(message, type = "") { let wrap = document.querySelector(".toast-wrap"); if (!wrap) { wrap = document.createElement("div"); wrap.className = "toast-wrap"; wrap.setAttribute("aria-live", "polite"); document.body.appendChild(wrap); } const item = document.createElement("div"); item.className = `toast ${type}`; item.textContent = message; wrap.appendChild(item); setTimeout(() => item.remove(), 4500); },
};
