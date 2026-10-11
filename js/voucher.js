'use strict';
Layout.render('voucher');

const VoucherPage = {
  credentials: null,
  reservation: null,
  requestSequence: 0,
  async init() {
    document.getElementById('voucher-form').addEventListener('submit', event => {
      event.preventDefault();
      try {
        const link = new URL(document.getElementById('voucher-link').value.trim(), location.origin);
        if (link.origin !== location.origin || !link.searchParams.get('code') || !link.searchParams.get('token')) throw new Error('Pega el enlace privado completo que recibiste al reservar.');
        this.credentials = { code: link.searchParams.get('code'), token: link.searchParams.get('token') };
        this.load();
      } catch (error) { this.error(error.message); }
    });
    const params = new URLSearchParams(location.search);
    if (params.get('code') && params.get('token')) {
      this.credentials = { code: params.get('code'), token: params.get('token') };
      history.replaceState(null, '', location.pathname);
    } else {
      try { this.credentials = JSON.parse(sessionStorage.getItem('bgv_last_voucher')); } catch { /* sin reserva previa */ }
    }
    if (this.credentials) await this.load();
    else {
      document.getElementById('voucher-loading').hidden = true;
      document.getElementById('voucher-empty').hidden = false;
    }
    this.timer = setInterval(() => { if (!document.hidden && this.credentials) this.load(true); }, 15000);
  },
  error(message) {
    const element = document.getElementById('voucher-error');
    element.textContent = message;
    element.hidden = false;
  },
  async load(silent = false) {
    const credentials = { ...this.credentials };
    const request = ++this.requestSequence;
    if (!silent) document.getElementById('voucher-loading').hidden = false;
    document.getElementById('voucher-error').hidden = true;
    try {
      const reservation = await Store.fetchReservation(credentials.code, credentials.token);
      if (request !== this.requestSequence) return;
      reservation.token = credentials.token;
      try { sessionStorage.setItem('bgv_last_voucher', JSON.stringify(credentials)); } catch { /* consulta válida sin almacenamiento */ }
      if (JSON.stringify(this.reservation) !== JSON.stringify(reservation)) { this.reservation = reservation; this.render(reservation); }
      document.getElementById('voucher-empty').hidden = true;
      document.getElementById('voucher-result').hidden = false;
    } catch (error) {
      if (request !== this.requestSequence) return;
      this.error(error.message || 'No pudimos consultar tu reserva. Comprueba el enlace e inténtalo otra vez.');
      if (!silent) document.getElementById('voucher-result').hidden = true;
    } finally { if (request === this.requestSequence) document.getElementById('voucher-loading').hidden = true; }
  },
  render(reservation) {
    const r = reservation, e = Utils.escape;
    const status = STATUS[r.status] || { label: r.status, badge: 'badge-warn' };
    const success = ['CONFIRMADA', 'COMPLETADA'].includes(r.status);
    const title = { CONFIRMADA: 'Tu aventura está confirmada.', PENDIENTE: 'Estamos revisando tu comprobante.', COMPLETADA: 'Gracias por viajar con nosotros.', CANCELADA: 'Esta reserva fue cancelada.', REEMBOLSADA: 'Reembolso de prueba registrado.', EXPIRADA: 'El plazo de esta reserva terminó.', BORRADOR: 'Tu reserva aún está en proceso.' }[r.status];
    const url = `${location.origin}/voucher.html?code=${encodeURIComponent(r.code)}&token=${encodeURIComponent(r.token)}`;
    const cancelled = ['CANCELADA', 'REEMBOLSADA', 'EXPIRADA'].includes(r.status);
    const customer = r.customer || {};
    document.getElementById('voucher-result').innerHTML = `
      <article class="glass voucher-status-card">
        <div class="voucher"><div class="success-ico ${success ? '' : 'pending'}">${Icons.svg(success ? 'check' : 'clock')}</div>
          <span class="badge ${status.badge}">${e(status.label)}</span>
          <h2>${e(title || status.label)}</h2>
          <p class="muted">${cancelled ? 'Este voucher no habilita el ingreso al tour.' : r.status === 'PENDIENTE' ? 'Tu cupo se conserva mientras el operador verifica el pago de prueba.' : 'Llega quince minutos antes de tu salida a GO Adventure, Huacachina.'}</p>
          <div class="ticket">
            <div class="ticket-main"><div class="ticket-code">${e(r.code)}</div>
              <div class="ticket-rows">
                <div><small>Experiencia</small><span>${e(r.tourTitle)}</span></div>
                <div><small>Titular</small><span>${e([customer.name, customer.last].filter(Boolean).join(' ') || 'Datos pendientes')}</span></div>
                <div><small>Fecha</small><span>${e(Utils.formatDateLong(r.date))}</span></div>
                <div><small>Turno</small><span>${e(r.slotTime)} · ${e(r.slotLabel)}</span></div>
                <div><small>Grupo</small><span>${r.pax.adults + r.pax.children} pasajeros · ${r.vehicles} UTV</span></div>
                <div><small>Total en soles</small><span>${Utils.money(r.amounts.total, 'PEN')}</span></div>
                <div><small>Punto de encuentro</small><span>GO Adventure, Huacachina</span></div>
                <div><small>Modalidad</small><span>Reserva de demostración</span></div>
              </div>
            </div>
            <div class="ticket-qr"><div class="qr-box"><img src="${e(Store.qrURL(url))}" width="150" height="150" alt="Código QR para consultar este voucher"/></div><small>Enlace privado de tu reserva</small></div>
          </div>
          <div class="voucher-actions">
            ${r.customer ? `<a class="btn btn-primary" href="${e(Store.pdfURL(r))}" download>${Icons.svg('download')} Descargar voucher PDF</a>` : ''}
            <button class="btn btn-ghost" id="copy-voucher-link">Copiar enlace privado</button>
            <a class="btn btn-ghost" href="${e(UTV_TOUR.meetingPoint.mapsUrl)}" target="_blank" rel="noopener">Cómo llegar</a>
          </div>
          <p class="policy-note">El enlace permite acceder a tu voucher. Guárdalo y compártelo solo con tu grupo.</p>
        </div>
      </article>
      <section class="glass voucher-history"><h2>Seguimiento de tu reserva</h2>
        <ol>${(r.history || []).map(item => `<li><span class="badge ${(STATUS[item.status] || status).badge}">${e((STATUS[item.status] || status).label)}</span><time datetime="${e(item.at)}">${e(new Date(item.at).toLocaleString('es-PE', { timeZone: 'America/Lima', dateStyle: 'medium', timeStyle: 'short' }))}</time></li>`).join('')}</ol>
      </section>`;
    document.getElementById('copy-voucher-link').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(url); Utils.toast('Enlace privado copiado.'); }
      catch { document.getElementById('voucher-link').value = url; document.querySelector('.voucher-link-form').open = true; document.getElementById('voucher-link').select(); Utils.toast('Selecciona y copia el enlace del campo.'); }
    });
  },
};

VoucherPage.init();
