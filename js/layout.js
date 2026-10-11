/* Shared, accessible identity and navigation. */
const Icons = {
  paths: {
    arrow: '<path d="M4 12h16M14 6l6 6-6 6"/>',
    diagonal: '<path d="M5 19L19 5M6 5h13v13"/>',
    location: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18M7 15h2m6 0h2m-10 3h2"/>',
    users: '<path d="M3 21v-2a5 5 0 0 1 5-5h3a5 5 0 0 1 5 5v2m2-7a5 5 0 0 1 3 5v2M16 3a4 4 0 0 1 0 8"/><circle cx="9.5" cy="7" r="4"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="m16 8-2 6-6 2 2-6 6-2Z"/>',
    vehicle: '<path d="m4 14 1-7h12l3 7v4H4v-4Zm1 0h15M8 7v7m5-7v7M4 10H2m18 0h2"/><circle cx="7" cy="19" r="2"/><circle cx="17" cy="19" r="2"/>',
    shield: '<path d="M12 3 3 7v6c0 5 9 9 9 9s9-4 9-9V7l-9-4Z"/><path d="m8 12 3 3 5-6"/>',
    receipt: '<path d="m5 3 2 1 2-1 3 1 3-1 2 1 2-1v18l-2-1-2 1-3-1-3 1-2-1-2 1V3ZM8 8h8m-8 4h8m-8 4h4"/>',
    headset: '<path d="M3 14v-3a9 9 0 0 1 18 0v6a4 4 0 0 1-4 4h-3"/><rect x="3" y="11" width="4" height="7" rx="2"/><rect x="17" y="11" width="4" height="7" rx="2"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    mountain: '<path d="m2 20 7-15 5 9 3-5 5 11H2Zm5-11 2 2 2-2"/>',
    car: '<path d="m3 14 2-7h14l2 7v5H3v-5Zm1 0h16M7 18v3m10-3v3M7 15h1m8 0h1"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M4 15v5h16v-5"/>',
    creditcard: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18m-13 5h4"/>',
    camera: '<path d="M3 7h4l2-3h6l2 3h4v14H3V7Z"/><circle cx="12" cy="13" r="4"/>',
    video: '<rect x="3" y="6" width="12" height="12" rx="2"/><path d="m15 10 6-3v10l-6-3"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    chevronLeft: '<path d="m15 5-7 7 7 7"/>',
    chevronRight: '<path d="m9 5 7 7-7 7"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
    search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
    print: '<path d="M7 7V3h10v4M7 17H3V9h18v8h-4M7 14h10v7H7v-7Zm11-3h.1"/>',
    qr: '<path d="M3 3h6v6H3V3Zm12 0h6v6h-6V3ZM3 15h6v6H3v-6Zm12 0h2v2h-2v-2Zm4-3h2v4m-9-4v3m0 4v2h5m4-1h-1m-4-8h1"/>',
    logout: '<path d="M10 3H4v18h6m5-13 4 4-4 4m-7-4h11"/>',
  },
  svg(name, className = '') { return `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${this.paths[name] || this.paths.info}</svg>`; },
  render(root = document) { root.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = this.svg(el.dataset.icon); }); },
};
const WA_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12.04 21.5h-.01a9.4 9.4 0 0 1-4.8-1.32l-.34-.2-3.57.94.95-3.48-.22-.36a9.43 9.43 0 1 1 8 4.42zm8.03-17.46A11.36 11.36 0 0 0 12.04.7C5.78.7.68 5.8.68 12.06c0 2 .52 3.96 1.52 5.68L.6 23.6l6-1.57a11.33 11.33 0 0 0 5.43 1.38h.01c6.26 0 11.36-5.1 11.36-11.36 0-3.03-1.18-5.89-3.33-8.03z"/></svg>';
const BRAND_MARK = '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.15" aria-hidden="true"><path d="M16 3c3 4 4 7 4 10a4 4 0 0 1-8 0c0-3 1-6 4-10Z"/><path d="M16 29c-5-3-8-7-8-12 0 0 4 1 8 5 4-4 8-5 8-5 0 5-3 9-8 12Z"/></svg>';

const Layout = {
  render(active = '') {
    const links = [
      { href: 'index.html#destinos', label: 'Destinos', key: 'experiencias' },
      { href: 'tour-utv.html', label: 'UTV Huacachina', key: 'utv' },
      { href: 'index.html#paquetes', label: 'Programas', key: 'como' },
      { href: 'index.html#contacto', label: 'Contacto', key: 'contacto' },
    ];
    const header = document.createElement('header');
    header.className = 'site-header';
    header.innerHTML = `<div class="container nav"><a href="index.html" class="brand" id="brand-home" aria-label="Buganvilla Tours, inicio"><span class="brand-mark">${BRAND_MARK}</span><span class="brand-txt"><b>Buganvilla</b><small>TOURS · ICA, PERÚ</small></span></a><nav class="nav-links" id="nav-links" aria-label="Navegación principal">${links.map(l => `<a href="${l.href}" ${l.key === active ? 'aria-current="page"' : ''} class="${l.key === active ? 'active' : ''}">${l.label}</a>`).join('')}<a class="mobile-only" href="voucher.html">Consultar mi reserva</a></nav><div class="nav-actions"><div class="currency-toggle" role="group" aria-label="Moneda de los precios"><button type="button" data-cur="PEN" id="cur-pen" aria-label="Mostrar precios en soles">S/</button><button type="button" data-cur="USD" id="cur-usd" aria-label="Mostrar precios en dólares">US$</button></div><a href="voucher.html" class="reservation-link">Mi reserva</a><a href="tour-utv.html#reservar" class="btn btn-primary btn-sm btn-reserve" id="nav-reserve">Reservar</a><button type="button" class="menu-btn" id="menu-btn" aria-label="Abrir menú" aria-controls="nav-links" aria-expanded="false">${Icons.svg('menu')}</button></div></div>`;
    document.body.prepend(header);
    this.showDemoBanner();
    if (!document.getElementById('page-progress')) { const progress = document.createElement('div'); progress.className = 'page-progress'; progress.setAttribute('aria-hidden', 'true'); progress.innerHTML = '<span id="page-progress"></span>'; document.body.prepend(progress); }
    const skip = document.createElement('a'); skip.href = '#contenido'; skip.className = 'skip-link'; skip.textContent = 'Ir al contenido'; document.body.prepend(skip);
    const main = document.querySelector('main'); if (main && !main.id) main.id = 'contenido';
    const footer = document.createElement('footer'); footer.className = 'site-footer'; footer.id = 'contacto';
    footer.innerHTML = `<svg class="footer-dunes" viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true"><path class="footer-dunes-back" d="M0 120V70C140 30 260 20 400 52s250 70 420 40 260-80 400-72c90 5 160 30 220 50V120Z"/><path class="footer-dunes-front" d="M0 120V90C180 60 300 72 470 84s300-40 470-46 330 40 500 26V120Z"/></svg><div class="container"><div class="footer-grid"><div class="footer-about"><a href="index.html" class="brand"><span class="brand-mark">${BRAND_MARK}</span><span class="brand-txt"><b>Buganvilla</b><small>TOURS · ICA, PERÚ</small></span></a><p>El desierto, el mar y la historia de Ica.<br />Experiencias con una agencia local.</p><a class="footer-social" href="${CONFIG.facebook}" target="_blank" rel="noopener">Encuéntranos en Facebook ${Icons.svg('diagonal')}</a><br /><a class="footer-social" href="https://twitter.com/Buganvillatours" target="_blank" rel="noopener">Síguenos en X ${Icons.svg('diagonal')}</a></div><div><h4>Explora Ica</h4><ul><li><a href="tour-utv.html">UTV en Huacachina</a></li><li><a href="index.html#destinos">Paracas y Ballestas</a></li><li><a href="index.html#destinos">Líneas de Nasca</a></li><li><a href="index.html#destinos">Ruta del Pisco</a></li></ul></div><div><h4>Hablemos de tu viaje</h4><ul>${CONFIG.phones.map(p => `<li><a href="tel:+51${p.replace(/\s/g, '')}">+51 ${p}</a></li>`).join('')}<li><a href="mailto:${CONFIG.email}">${CONFIG.email}</a></li><li><a href="https://wa.me/${CONFIG.whatsapp}" target="_blank" rel="noopener">WhatsApp ${Icons.svg('diagonal')}</a></li></ul></div><div><h4>Tu reserva</h4><ul><li><a href="voucher.html">Consultar mi reserva</a></li><li><a href="tour-utv.html#reservar">Cómo reservar</a></li><li><a href="tour-utv.html#condiciones">Condiciones del servicio</a></li><li><a href="https://buganvillatours.com/libro-de-reclamaciones/" target="_blank" rel="noopener">Libro de reclamaciones</a></li><li><a href="admin.html" id="footer-admin">Acceso del operador</a></li></ul></div></div><div class="footer-wordmark" aria-hidden="true">Buganvilla</div><div class="footer-bottom"><span>${new Date().toLocaleDateString('es-PE', { year: 'numeric', timeZone: 'America/Lima' })} Buganvilla Tours. Todos los derechos reservados.</span><span>Entorno de demostración · Pagos simulados</span><span class="footer-payments">TARJETA <b>·</b> YAPE <b>·</b> PLIN</span></div></div>`;
    document.body.appendChild(footer);
    if (active !== 'admin') {
      const wa = document.createElement('a'); wa.className = 'wa-float no-print'; wa.id = 'wa-float'; wa.href = `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent('Hola Buganvilla Tours, quisiera información sobre sus tours.')}`; wa.target = '_blank'; wa.rel = 'noopener'; wa.setAttribute('aria-label', 'Consultar por WhatsApp'); wa.innerHTML = WA_ICON; document.body.appendChild(wa);
    }
    Icons.render(); this.bind();
  },
  showDemoBanner() {
    if (document.getElementById('global-demo-notice')) return;
    const note = document.createElement('div'); note.id = 'global-demo-notice'; note.className = 'global-demo-notice'; note.innerHTML = '<div class="container"><strong>DEMO</strong><span>Tarifas referenciales y pagos simulados. Ningún cargo es real.</span></div>'; document.body.prepend(note);
  },
  bind() {
    const header = document.querySelector('.site-header');
    const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 24); onScroll(); window.addEventListener('scroll', onScroll, { passive: true });
    const menuBtn = document.getElementById('menu-btn'), navLinks = document.getElementById('nav-links'), small = window.matchMedia('(max-width: 1120px)');
    const setMenu = open => { navLinks.classList.toggle('open', open); menuBtn.setAttribute('aria-expanded', String(open)); menuBtn.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú'); menuBtn.innerHTML = Icons.svg(open ? 'close' : 'menu'); navLinks.inert = small.matches && !open; };
    setMenu(false);
    menuBtn.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
    navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setMenu(false)));
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && menuBtn.getAttribute('aria-expanded') === 'true') { setMenu(false); menuBtn.focus(); } });
    document.addEventListener('click', e => { if (!header.contains(e.target)) setMenu(false); });
    small.addEventListener('change', () => setMenu(false));
    this.syncCurrency();
    document.querySelectorAll('.currency-toggle button').forEach(b => b.addEventListener('click', () => { Store.setCurrency(b.dataset.cur); this.syncCurrency(); document.dispatchEvent(new CustomEvent('currencychange', { detail: b.dataset.cur })); }));
    this.observeReveal();
  },
  syncCurrency() { const cur = Store.getCurrency(); document.querySelectorAll('.currency-toggle button').forEach(b => { b.classList.toggle('active', b.dataset.cur === cur); b.setAttribute('aria-pressed', String(b.dataset.cur === cur)); }); },
  observeReveal(root = document) {
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { root.querySelectorAll('.reveal').forEach(el => el.classList.add('visible')); return; }
    this.observer ||= new IntersectionObserver(entries => { entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); this.observer.unobserve(e.target); } }); }, { threshold: 0.08 });
    root.querySelectorAll('.reveal:not(.visible)').forEach(el => this.observer.observe(el));
  },
};
