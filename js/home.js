/* Catalog and date-aware discovery. */
Layout.render('');
const Home = {
  filter: 'todos',
  destination(tour) { if (tour.location.includes('Huacachina')) return 'huacachina'; if (tour.location.includes('Paracas')) return 'paracas'; if (tour.location.includes('Nasca')) return 'nasca'; return 'ica'; },
  init() {
    this.renderFilters(); this.renderTours(); this.renderReviews(); this.initQuickSearch(); this.renderPrices();
    document.getElementById('cta-wa').href = `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent('Hola, me gustaría planificar un viaje a Ica. ¿Pueden orientarme sobre sus experiencias?')}`;
    document.addEventListener('currencychange', () => { this.renderTours(); this.renderPrices(); });
  },
  renderPrices() { document.getElementById('feat-price').textContent = Utils.money(UTV_TOUR.prices.adult); },
  renderFilters() {
    const wrap = document.getElementById('filters');
    const items = [['todos', 'Todas las experiencias'], ['huacachina', 'Huacachina'], ['paracas', 'Paracas'], ['nasca', 'Nasca'], ['ica', 'Valle de Ica']];
    wrap.innerHTML = items.map(([key, label]) => `<button type="button" class="chip ${key === this.filter ? 'active' : ''}" data-filter="${key}" id="filter-${key}" aria-pressed="${key === this.filter}">${label}</button>`).join('');
    wrap.addEventListener('click', e => {
      const btn = e.target.closest('[data-filter]'); if (!btn) return;
      this.filter = btn.dataset.filter;
      wrap.querySelectorAll('.chip').forEach(c => { c.classList.toggle('active', c === btn); c.setAttribute('aria-pressed', String(c === btn)); }); this.renderTours();
    });
  },
  renderTours() {
    const grid = document.getElementById('tour-grid');
    const list = TOURS.filter(t => this.filter === 'todos' || this.destination(t) === this.filter);
    document.getElementById('catalog-count').textContent = `${list.length} ${list.length === 1 ? 'experiencia' : 'experiencias'}`;
    grid.classList.toggle('filtered', this.filter !== 'todos');
    grid.innerHTML = list.map(t => {
      const cat = CATEGORIES[t.category], waText = encodeURIComponent(`Hola, quiero información sobre el tour "${t.title}". ¿Cuáles son las tarifas y fechas disponibles?`);
      const href = t.bookable ? t.url : `https://wa.me/${CONFIG.whatsapp}?text=${waText}`;
      const external = t.bookable ? '' : 'target="_blank" rel="noopener"';
      return `<article class="tour-card ${t.bookable && this.filter === 'todos' ? 'tour-featured' : ''}"><a class="tour-media" href="${href}" ${external} aria-label="${t.bookable ? 'Ver' : 'Consultar'} ${Utils.escape(t.title)}"><img src="${t.image}" alt="${Utils.escape(t.title)}" width="1376" height="768" loading="lazy" /><div class="badges"><span class="badge ${cat.badge}">${cat.label}</span>${t.bookable ? '<span class="badge badge-light">Reserva online</span>' : ''}</div><span class="tour-image-arrow">${Icons.svg('diagonal')}</span></a><div class="tour-body"><span class="tour-loc">${Icons.svg('location')} ${Utils.escape(t.location)}<span class="tour-duration">${Icons.svg('clock')} ${Utils.escape(t.duration)}</span></span><h3><a href="${href}" ${external}>${Utils.escape(t.title)}</a></h3><p>${Utils.escape(t.short)}</p><div class="tour-tags">${t.tags.map(x => `<span>${Utils.escape(x)}</span>`).join('')}</div><div class="tour-foot"><div class="price-from"><small>Desde, por persona</small><strong>${Utils.money(t.priceFrom)}</strong></div><a href="${t.bookable ? `${t.url}#reservar` : href}" ${external} class="${t.bookable ? 'btn btn-primary btn-sm' : 'text-link'}" id="${t.bookable ? 'book' : 'ask'}-${t.id}">${t.bookable ? 'Reservar' : 'Consultar'} ${Icons.svg('arrow')}</a></div></div></article>`;
    }).join('');
  },
  renderReviews() {
    document.getElementById('reviews-grid').innerHTML = REVIEWS.slice(0, 3).map((review, i) => `<article class="review-card"><span class="review-number">0${i + 1}</span><span class="review-topic">${Utils.escape(review.topic || 'Atención y experiencia')}</span><h3>${Utils.escape(review.title)}</h3><p>${Utils.escape(review.text)}</p><div class="review-author"><span class="avatar">${Utils.escape(review.author[0].toUpperCase())}</span><div>${Utils.escape(review.author)}<small>${Utils.escape(review.date || 'Reseña en la web de la agencia')}</small></div></div></article>`).join('');
  },
  initQuickSearch() {
    const tourSel = document.getElementById('qs-tour'), dateIn = document.getElementById('qs-date'), paxSel = document.getElementById('qs-pax'), submit = document.getElementById('qs-submit');
    tourSel.innerHTML = TOURS.map(t => `<option value="${t.id}">${Utils.escape(t.title)}</option>`).join('');
    paxSel.innerHTML = Array.from({ length: UTV_TOUR.maxPaxPerBooking - 1 }, (_, i) => i + 2).map(n => `<option value="${n}">${n} personas</option>`).join('');
    const parts = new Intl.DateTimeFormat('en', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const get = type => parts.find(p => p.type === type).value;
    const today = `${get('year')}-${get('month')}-${get('day')}`;
    const nextDate = (iso, days) => { const date = new Date(`${iso}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); };
    dateIn.min = today; dateIn.max = nextDate(today, CONFIG.bookingWindowDays); dateIn.value = nextDate(today, 1);
    const syncAction = () => { const tour = TOURS.find(t => t.id === tourSel.value); submit.innerHTML = `${tour?.bookable ? 'Ver disponibilidad' : 'Consultar experiencia'} ${Icons.svg('arrow')}`; }; tourSel.addEventListener('change', syncAction);
    document.getElementById('quick-search').addEventListener('submit', e => {
      e.preventDefault(); if (!dateIn.reportValidity()) return;
      const tour = TOURS.find(t => t.id === tourSel.value); if (!tour) return;
      if (tour.bookable) { location.href = `${tour.url}?date=${encodeURIComponent(dateIn.value)}&pax=${encodeURIComponent(paxSel.value)}#reservar`; }
      else { const message = `Hola, quiero consultar "${tour.title}" para el ${dateIn.value}, ${paxSel.value} personas. ¿Pueden confirmar tarifa y disponibilidad?`; window.open(`https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer'); }
    });
  },
};
Home.init();
