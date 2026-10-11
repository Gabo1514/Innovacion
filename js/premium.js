(function (scope) {
  'use strict';

  const Core = {
    text(value, language = 'es') {
      if (value && typeof value === 'object') return String(value[language] ?? value.es ?? value.en ?? '');
      return String(value ?? '');
    },
    normalize(value) { return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); },
    legacyCurrency(currency) { return currency === 'USD' ? 'USD' : 'PEN'; },
    newsletterValid(email, consent) {
      return typeof email === 'string' && email.trim().length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && consent === true;
    },
    planDownloadURL(content, date, today = Core.today()) {
      if (typeof content !== 'string' || !content.trim() || new TextEncoder().encode(content).length > 18000 || !Core.validDate(date, today)) return null;
      return `/api/plan.txt?content=${encodeURIComponent(content)}&date=${encodeURIComponent(date)}`;
    },
    today(now = Date.now()) {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(now));
      const values = Object.fromEntries(parts.map(item => [item.type, item.value]));
      return `${values.year}-${values.month}-${values.day}`;
    },
    addDays(date, days) { return new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10); },
    validDate(date, today = Core.today(), days = 90) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return false;
      const parsed = new Date(`${date}T12:00:00Z`);
      return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === date && date >= today && date <= Core.addDays(today, days);
    },
    context(input = {}, today = Core.today()) {
      input = input && typeof input === 'object' ? input : {};
      const destinations = ['all', 'huacachina', 'paracas', 'nasca', 'ica'];
      const pax = Number(input.pax);
      return { destination: destinations.includes(input.destination) ? input.destination : 'all', date: Core.validDate(input.date, today) ? input.date : Core.addDays(today, 1), pax: Number.isInteger(pax) && pax >= 2 && pax <= 9 ? pax : 2 };
    },
    toggleCompare(current, id, available) {
      const items = current.filter((entry, index, all) => available.includes(entry) && all.indexOf(entry) === index).slice(0, 3);
      if (!available.includes(id)) return { items, limited: false };
      if (items.includes(id)) return { items: items.filter(entry => entry !== id), limited: false };
      if (items.length >= 3) return { items, limited: true };
      return { items: [...items, id], limited: false };
    },
    filter(items, { destination = 'all', query = '', savedOnly = false, saved = [], sort = 'editorial' } = {}) {
      const search = Core.normalize(query);
      const results = items.filter(item => (destination === 'all' || item.destination === destination) && (!savedOnly || saved.includes(item.id)) && (!search || Core.normalize([Core.text(item.title, 'es'), Core.text(item.title, 'en'), Core.text(item.region, 'es'), Core.text(item.region, 'en'), Core.text(item.category, 'es'), Core.text(item.category, 'en')].join(' ')).includes(search)));
      if (sort === 'price-asc') return results.sort((a, b) => a.pricePEN - b.pricePEN);
      if (sort === 'duration') return results.sort((a, b) => a.durationHours - b.durationHours);
      return results;
    },
    inquiry({ name, email, destination, date, pax, message }, language = 'es') {
      return language === 'en' ? `Travel enquiry | Buganvilla Tours\n\nName: ${name}\nEmail: ${email}\nDestination: ${destination}\nPreferred date: ${date}\nTravellers: ${pax}\n\n${message}\n\nPlease confirm availability, the final rate and service conditions.` : `Consulta de viaje | Buganvilla Tours\n\nNombre: ${name}\nCorreo: ${email}\nDestino: ${destination}\nFecha preferida: ${date}\nViajeros: ${pax}\n\n${message}\n\nPor favor, confirmen disponibilidad, tarifa final y condiciones del servicio.`;
    },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Core;
  scope.PremiumCore = Core;
  if (!scope.document) return;

  const document = scope.document;
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const paths = {
    arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
    diagonal: '<path d="M6 18 18 6M6 6h12v12"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.9-8.6a5.5 5.5 0 0 0-.1-7.8Z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    location: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    users: '<circle cx="9" cy="7" r="4"/><path d="M2 21v-2a7 7 0 0 1 14 0v2m1-18a4 4 0 0 1 0 8m3 10v-2a7 7 0 0 0-3-6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
  };
  const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="icon ico" aria-hidden="true">${paths[name] || paths.arrow}</svg>`;
  const fallback = {
    es: {
      addToPlan: 'Añadir a mi viaje', removeFromPlan: 'Quitar de mi viaje', saved: 'Guardado', unsaved: 'Guardar experiencia', compare: 'Comparar', details: 'Ver experiencia', from: 'Desde', perPerson: 'por persona', priceNote: 'Tarifa referencial por adulto. Sujeta a confirmación.', include: 'Incluye', exclude: 'No incluye', itinerary: 'Itinerario', duration: 'Duración', destination: 'Destino', group: 'Viajeros', consult: 'Consultar disponibilidad', bookNow: 'Elegir turno', close: 'Cerrar', emptyPlan: 'Tu viaje empieza con una selección.', emptyPlanBody: 'Añade experiencias o programas para guardar una propuesta, descargarla o consultar con la agencia.', noResults: 'No encontramos experiencias con estos filtros.', clearFilters: 'Restablecer filtros', plan: 'Mi viaje', date: 'Fecha preferida', quote: 'Estimación del grupo', estimated: 'Estimación referencial', online: 'Reserva en línea', consultation: 'Bajo consulta', compareLimit: 'Puedes comparar hasta tres experiencias.', compared: 'experiencias seleccionadas', compareEmpty: 'Elige dos o tres experiencias del catálogo para compararlas.', planAdded: 'Experiencia añadida a tu viaje.', planRemoved: 'Experiencia retirada de tu viaje.', favoriteAdded: 'Experiencia guardada.', favoriteRemoved: 'Experiencia retirada de guardados.', results: 'experiencias', filterDate: 'Selección para', travelers: 'viajeros', available: 'Vehículos disponibles', loadingAvailability: 'Consultando disponibilidad…', unavailable: 'No hay salidas con capacidad para este grupo en la fecha elegida.', availabilityError: 'La disponibilidad se confirma al elegir el turno.', demo: 'Demostración: tarifas referenciales y pagos simulados. No se efectúan cargos.', inquiryError: 'Revisa tu nombre, correo, fecha, número de viajeros y consentimiento.', inquiryHeading: 'Tu consulta, lista para revisar', inquiryNote: 'Elige el canal para enviar este mensaje. La disponibilidad y las tarifas se confirman con la agencia.', offline: 'No pudimos conectar con el servicio. Inténtalo de nuevo cuando esté disponible.', newsletterError: 'Introduce un correo válido y acepta el tratamiento de tus datos.', newsletterSuccess: 'Tu correo quedó registrado. Esta demostración aún no envía boletines.', newsletterExisting: 'Este correo ya está registrado.', remove: 'Quitar', planAlternative: 'Los programas son alternativas de viaje; no se suman entre sí ni con los tours incluidos. Cada importe se muestra por separado.', planNoBooking: 'Esta selección no constituye una reserva ni garantiza disponibilidad.', price: 'Precio referencial', modality: 'Modalidad', participants: 'Participantes', selectedDate: 'Fecha preferida', email: 'Correo', contact: 'Consulta', privacyTitle: 'Privacidad de la demostración', termsTitle: 'Condiciones de uso', menuOpen: 'Abrir menú', menuClose: 'Cerrar menú', planDownloads: 'Propuesta de viaje | Buganvilla Tours', invalidDate: 'Selecciona una fecha dentro de los próximos 90 días.', unavailablePax: 'Ajusta el grupo para esta experiencia.', dateAndGroup: 'Fecha y grupo', paymentLanguage: 'El proceso de reserva de UTV está disponible en español.', noFavorites: 'Todavía no tienes experiencias guardadas.', downloadError: 'No fue posible descargar la propuesta en este navegador.', newWindow: 'Se abre en una nueva ventana', transferDate: 'La fecha es orientativa para los programas de varios días.', contactEmailError: 'No pudimos preparar la consulta. Revisa los datos.', transport: 'Traslados y horarios se confirman con la agencia.', comparedPrice: 'Por adulto', fullGroup: 'Para el grupo', adultNote: 'Estimación para adultos. Tarifas infantiles y suplementos se consultan.', arrivalTime: 'Horarios con salida disponible', noSlots: 'No hay salidas disponibles para este grupo.', privacyLink: 'Política de privacidad', querySending: 'Registrando…', consultFirst: 'Solicitar propuesta', reviewsPrevious: 'Reseña anterior', reviewsNext: 'Siguiente reseña'
    },
    en: {
      addToPlan: 'Add to my trip', removeFromPlan: 'Remove from my trip', saved: 'Saved', unsaved: 'Save experience', compare: 'Compare', details: 'View experience', from: 'From', perPerson: 'per person', priceNote: 'Indicative adult rate, subject to confirmation.', include: 'Included', exclude: 'Not included', itinerary: 'Itinerary', duration: 'Duration', destination: 'Destination', group: 'Travellers', consult: 'Check availability', bookNow: 'Choose departure', close: 'Close', emptyPlan: 'Your trip begins with a selection.', emptyPlanBody: 'Add experiences or programmes to save a proposal, download it or contact the agency.', noResults: 'No experiences match these filters.', clearFilters: 'Reset filters', plan: 'My trip', date: 'Preferred date', quote: 'Group estimate', estimated: 'Indicative estimate', online: 'Online booking', consultation: 'On request', compareLimit: 'You can compare up to three experiences.', compared: 'experiences selected', compareEmpty: 'Select two or three catalogue experiences to compare them.', planAdded: 'Experience added to your trip.', planRemoved: 'Experience removed from your trip.', favoriteAdded: 'Experience saved.', favoriteRemoved: 'Experience removed from saved items.', results: 'experiences', filterDate: 'Selection for', travelers: 'travellers', available: 'Available vehicles', loadingAvailability: 'Checking availability…', unavailable: 'No departures have capacity for this group on the chosen date.', availabilityError: 'Availability is confirmed when selecting your departure.', demo: 'Demonstration: indicative rates and simulated payments. No charges are made.', inquiryError: 'Check your name, email, date, number of travellers and consent.', inquiryHeading: 'Your enquiry, ready to review', inquiryNote: 'Choose a channel to send this message. Availability and final rates are confirmed with the agency.', offline: 'We could not connect to the service. Try again when it is available.', newsletterError: 'Enter a valid email and accept the processing of your data.', newsletterSuccess: 'Your email has been registered. This demonstration does not yet send newsletters.', newsletterExisting: 'This email is already registered.', remove: 'Remove', planAlternative: 'Programmes are alternative travel proposals. They are not added together or combined with their included tours. Each estimate is shown separately.', planNoBooking: 'This selection is not a booking and does not guarantee availability.', price: 'Indicative price', modality: 'Format', participants: 'Participants', selectedDate: 'Preferred date', email: 'Email', contact: 'Enquiry', privacyTitle: 'Demonstration privacy', termsTitle: 'Terms of use', menuOpen: 'Open menu', menuClose: 'Close menu', planDownloads: 'Travel proposal | Buganvilla Tours', invalidDate: 'Choose a date within the next 90 days.', unavailablePax: 'Adjust the group size for this experience.', dateAndGroup: 'Date and group', paymentLanguage: 'The UTV booking process is available in Spanish.', noFavorites: 'You have no saved experiences yet.', downloadError: 'The proposal could not be downloaded in this browser.', newWindow: 'Opens in a new window', transferDate: 'The date is indicative for multi-day programmes.', contactEmailError: 'We could not prepare the enquiry. Check your details.', transport: 'Transfers and departure times are confirmed with the agency.', comparedPrice: 'Per adult', fullGroup: 'For the group', adultNote: 'Adult estimate. Child rates and supplements are available on request.', arrivalTime: 'Available departure times', noSlots: 'No departures are available for this group.', privacyLink: 'Privacy policy', querySending: 'Registering…', consultFirst: 'Request a proposal', reviewsPrevious: 'Previous review', reviewsNext: 'Next review'
    }
  };
  const read = (key, value) => { try { const raw = scope.localStorage.getItem(key); return raw === null ? value : JSON.parse(raw); } catch { return value; } };
  const write = (key, value) => { try { scope.localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  const catalog = () => scope.PremiumCatalog || { tours: [], packages: [] };
  const allItems = () => [...(catalog().tours || []), ...(catalog().packages || [])];
  const findItem = id => allItems().find(item => item.id === id);
  const state = {
    language: read('premium_language', 'es') === 'en' ? 'en' : 'es',
    currency: ['PEN', 'USD', 'EUR'].includes(read('premium_currency', 'PEN')) ? read('premium_currency', 'PEN') : 'PEN',
    saved: read('premium_saved', []), plan: read('premium_plan', []), compare: [],
    context: Core.context(read('premium_context', {})), query: '', sort: 'editorial', savedOnly: false,
    detail: null, detailContext: null, review: 0, bootstrap: null, availabilityRequest: 0, newsletterBusy: false, lastFocus: null,
  };
  const t = (key, values = {}) => {
    const dictionaries = scope.PremiumI18n || {};
    let value = dictionaries[state.language]?.[key] ?? fallback[state.language][key] ?? dictionaries.es?.[key] ?? key;
    Object.entries(values).forEach(([name, replacement]) => { value = String(value).replaceAll(`{${name}}`, replacement); });
    return String(value);
  };
  const text = value => Core.text(value, state.language);
  const money = value => {
    const rates = catalog().exchangeRates || catalog().rates || { USD: 3.75, EUR: 4.1 };
    const divisor = state.currency === 'PEN' ? 1 : Number(rates[state.currency]) || (state.currency === 'USD' ? 3.75 : 4.1);
    return new Intl.NumberFormat(state.language === 'en' ? 'en-US' : 'es-PE', { style: 'currency', currency: state.currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(value) / divisor);
  };
  const longDate = date => new Intl.DateTimeFormat(state.language === 'en' ? 'en-GB' : 'es-PE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Lima' }).format(new Date(`${date}T12:00:00Z`));
  const persistContext = () => write('premium_context', state.context);
  const getPhone = () => String(catalog().contact?.whatsapp || catalog().contact?.phone || catalog().whatsapp || '51948401267').replace(/\D/g, '');
  const getEmail = () => catalog().contact?.email || catalog().email || 'reservas@buganvillatours.com.pe';
  const waURL = message => `https://wa.me/${getPhone()}?text=${encodeURIComponent(message)}`;
  const toast = message => {
    let host = $('#premium-toasts');
    if (!host) { host = document.createElement('div'); host.id = 'premium-toasts'; host.className = 'toast-wrap toast-stack'; host.setAttribute('aria-live', 'polite'); document.body.append(host); }
    const item = document.createElement('div'); item.className = 'toast premium-toast'; item.innerHTML = `${icon('check')}<span>${escape(message)}</span>`; host.append(item); scope.setTimeout(() => item.remove(), 4500);
  };

  function syncTranslations() {
    document.documentElement.lang = state.language;
    $$('[data-i18n]').forEach(element => { element.textContent = t(element.dataset.i18n); });
    $$('[data-i18n-placeholder]').forEach(element => { element.setAttribute('placeholder', t(element.dataset.i18nPlaceholder)); });
    $$('[data-i18n-title]').forEach(element => { element.setAttribute('title', t(element.dataset.i18nTitle)); });
    $$('[data-i18n-aria]').forEach(element => { element.setAttribute('aria-label', t(element.dataset.i18nAria)); });
    if ($('#language-select')) $('#language-select').value = state.language;
    if ($('#currency-select')) $('#currency-select').value = state.currency;
    if ($('#menuBtn')) $('#menuBtn').setAttribute('aria-label', t($('#menuBtn').getAttribute('aria-expanded') === 'true' ? 'menuClose' : 'menuOpen'));
    $$('[data-price-pen]').forEach(element => { element.textContent = money(Number(element.dataset.pricePen)); });
    $$('[data-catalog-image], [data-image]').forEach(element => {
      const key = element.dataset.catalogImage || element.dataset.image;
      const entry = catalog().images?.[key];
      if (!entry) return;
      const url = typeof entry === 'string' ? entry : entry.url || entry.src;
      if (url && element.tagName === 'IMG') { if (element.dataset.catalogImage || !element.getAttribute('src')) element.src = url; element.alt = text(catalog().imageMetadata?.[key]?.alt || (typeof entry === 'string' ? '' : entry.alt)); }
    });
    if ($('#currency-select')) $('#currency-select').title = state.currency === 'EUR' ? checkoutCurrencyNote() : '';
    if ($('.footer-demo') && state.currency === 'EUR') $('.footer-demo').textContent = `${t('footerDemo')} ${checkoutCurrencyNote()}`;
  }

  function checkoutCurrencyNote() {
    return state.language === 'en' ? 'EUR prices are indicative. The UTV checkout uses Peruvian soles (PEN).' : 'Los importes en EUR son referenciales. La reserva UTV se completa en soles peruanos (PEN).';
  }

  function syncBookingLinks() {
    $$('a[href^="tour-utv.html"]').filter(link => !link.closest('#detail-dialog')).forEach(link => {
      link.href = `tour-utv.html?date=${encodeURIComponent(state.context.date)}&pax=${state.context.pax}#reservar`;
      if (state.currency === 'EUR') link.title = checkoutCurrencyNote(); else link.removeAttribute('title');
    });
  }

  function saveButton(item) {
    const saved = state.saved.includes(item.id);
    return `<button type="button" class="save-btn save-button ${saved ? 'is-saved' : ''}" data-save="${escape(item.id)}" aria-pressed="${saved}" aria-label="${escape(t(saved ? 'saved' : 'unsaved'))}: ${escape(text(item.title))}">${icon('heart')}</button>`;
  }

  function planButton(item) {
    const inPlan = state.plan.includes(item.id);
    return `<button type="button" class="text-button plan-toggle" data-plan="${escape(item.id)}" aria-pressed="${inPlan}">${icon(inPlan ? 'check' : 'plus')}${escape(t(inPlan ? 'removeFromPlan' : 'addToPlan'))}</button>`;
  }

  function routeCard(item, position = 0) {
    const isCompared = state.compare.includes(item.id);
    const online = item.booking === 'online';
    const index = (catalog().tours || []).findIndex(entry => entry.id === item.id) + 1;
    const bookingURL = `tour-utv.html?date=${encodeURIComponent(state.context.date)}&pax=${state.context.pax}#reservar`;
    const primaryAction = online
      ? `<a class="btn btn-glow route-reserve" href="${bookingURL}">${escape(t('bookNow'))}${icon('arrow')}</a>`
      : `<button type="button" class="btn btn-outline route-detail" data-detail="${escape(item.id)}">${escape(t('details'))}${icon('arrow')}</button>`;
    return `<article class="route-card" data-tour="${escape(item.id)}" style="--card-i:${position}">
      <div class="route-media" data-cursor="view">
        <button type="button" class="route-image-button" data-detail="${escape(item.id)}" aria-label="${escape(t('details'))}: ${escape(text(item.title))}"><img src="${escape(item.image)}" alt="${escape(text(item.alt))}" loading="lazy" decoding="async" width="1200" height="800"></button>
        <div class="route-chips"><span class="chip chip-glass">${escape(text(item.region))}</span>${online ? `<span class="chip chip-live"><i aria-hidden="true"></i>${escape(t('online'))}</span>` : ''}</div>
        ${saveButton(item)}
        <span class="route-index" aria-hidden="true">${String(index).padStart(2, '0')}</span>
      </div>
      <div class="route-body">
        <p class="route-category">${escape(text(item.category || item.mode))}${online ? '' : ` · ${escape(t('consultation'))}`}</p>
        <h3><button type="button" class="card-title-button" data-detail="${escape(item.id)}">${escape(text(item.title))}</button></h3>
        <p class="route-desc">${escape(text(item.description))}</p>
        <ul class="route-specs" aria-label="${escape(t('duration'))} · ${escape(t('modality'))}"><li>${icon('clock')}${escape(text(item.duration))}</li><li>${icon('users')}${escape(text(item.mode))}</li></ul>
        <ul class="route-includes" aria-label="${escape(t('include'))}">${(item.includes?.[state.language] || item.includes?.es || []).slice(0, 4).map(entry => `<li>${icon('check')}${escape(entry)}</li>`).join('')}</ul>
        <div class="route-foot">
          <div class="route-price"><span>${escape(t('from'))}</span><strong>${escape(money(item.pricePEN))}</strong><small>${escape(t('perPerson'))}</small></div>
          <div class="route-cta">${primaryAction}</div>
        </div>
        <div class="route-actions"><label class="compare-toggle compare-check"><input type="checkbox" data-compare="${escape(item.id)}" ${isCompared ? 'checked' : ''}><span>${escape(t('compare'))}</span></label>${online ? `<button type="button" class="text-button route-itinerary" data-detail="${escape(item.id)}">${escape(t('itinerary'))}${icon('diagonal')}</button>` : ''}${planButton(item)}</div>
      </div>
      <span class="route-spot" aria-hidden="true"></span>
    </article>`;
  }

  function ticketCard(item, position = 0) {
    const days = Number(item.days) || 1, nights = Number(item.nights) || 0;
    const stayText = `${days} ${t(days === 1 ? 'day' : 'days')} · ${nights === 0 ? t('noNight') : `${nights} ${t(nights === 1 ? 'night' : 'nights')}`}`;
    const stops = text(item.region).split('·').map(stop => stop.trim()).filter(Boolean);
    const code = `BGV-${stops.map(stop => Core.normalize(stop).slice(0, 2).toUpperCase()).join('')}-${String(days).padStart(2, '0')}`;
    const group = `${Math.max(1, item.paxMin || 1)}–${item.paxMax || 9}`;
    return `<article class="ticket" data-tour="${escape(item.id)}" style="--card-i:${position}">
      <div class="ticket-media" data-cursor="view"><img src="${escape(item.image)}" alt="${escape(text(item.alt))}" loading="lazy" decoding="async" width="1200" height="900">${saveButton(item)}<span class="chip chip-glass ticket-days">${escape(stayText)}</span></div>
      <div class="ticket-main">
        <p class="ticket-route">${stops.map(stop => `<span>${escape(stop)}</span>`).join('<i aria-hidden="true"></i>')}</p>
        <h3><button type="button" class="card-title-button" data-detail="${escape(item.id)}">${escape(text(item.title))}</button></h3>
        <p>${escape(text(item.description))}</p>
        <dl class="ticket-meta"><div><dt><small>${escape(t('duration'))}</small></dt><dd><b>${escape(text(item.duration))}</b></dd></div><div><dt><small>${escape(t('modality'))}</small></dt><dd><b>${escape(text(item.mode))}</b></dd></div><div><dt><small>${escape(t('group'))}</small></dt><dd><b>${escape(group)}</b></dd></div></dl>
      </div>
      <div class="ticket-stub">
        <div class="ticket-price"><small>${escape(t('from'))}</small><strong>${escape(money(item.pricePEN))}</strong><small>${escape(t('perPerson'))}</small></div>
        <button type="button" class="btn btn-glow btn-sm" data-detail="${escape(item.id)}">${escape(t('ticketProgram'))}${icon('arrow')}</button>
        ${planButton(item)}
        <div class="ticket-barcode" aria-hidden="true"></div>
        <span class="ticket-code" aria-hidden="true">${escape(code)}</span>
      </div>
    </article>`;
  }

  function card(item, packageCard = false, position = 0) {
    return packageCard ? ticketCard(item, position) : routeCard(item, position);
  }

  function syncCounters() {
    if ($('#plan-count')) $('#plan-count').textContent = state.plan.length;
    if ($('#compare-count')) $('#compare-count').textContent = state.compare.length;
    if ($('#compare-bar')) $('#compare-bar').hidden = state.compare.length === 0;
    if ($('#open-compare')) $('#open-compare').disabled = state.compare.length < 2;
    $$('[data-save]').forEach(button => { const selected = state.saved.includes(button.dataset.save); button.setAttribute('aria-pressed', String(selected)); button.classList.toggle('is-saved', selected); button.setAttribute('aria-label', `${t(selected ? 'saved' : 'unsaved')}: ${text(findItem(button.dataset.save)?.title)}`); });
    $$('[data-plan]').forEach(button => { const selected = state.plan.includes(button.dataset.plan); button.setAttribute('aria-pressed', String(selected)); button.innerHTML = `${icon(selected ? 'check' : 'plus')}${escape(t(selected ? 'removeFromPlan' : 'addToPlan'))}`; });
    $$('[data-compare]').forEach(input => { input.checked = state.compare.includes(input.dataset.compare); });
  }

  function renderCatalog() {
    const items = Core.filter(catalog().tours || [], { destination: state.context.destination, query: state.query, sort: state.sort, savedOnly: state.savedOnly, saved: state.saved });
    const grid = $('#tour-grid'), signature = items.map(item => item.id).join('|');
    if (grid) grid.classList.toggle('no-anim', grid.dataset.signature === signature);
    if (grid) grid.dataset.signature = signature;
    if (grid) grid.innerHTML = items.length ? items.map((item, index) => card(item, false, index)).join('') : `<div class="empty-state"><h3>${escape(t('noResults'))}</h3><p>${escape(state.savedOnly ? t('noFavorites') : t('transport'))}</p><button type="button" class="btn btn-outline" data-reset-filters>${escape(t('clearFilters'))}</button></div>`;
    if ($('#results-status')) $('#results-status').textContent = `${items.length} ${t(items.length === 1 ? 'result' : 'results')} · ${t('filterDate')} ${longDate(state.context.date)} · ${state.context.pax} ${t('travelers')}`;
    $$('#destination-filters [data-filter]').forEach(button => { const selected = button.dataset.filter === state.context.destination; button.classList.toggle('active', selected); button.setAttribute('aria-pressed', String(selected)); });
    if ($('#q-dest')) $('#q-dest').value = state.context.destination;
    syncBookingLinks();
    syncCounters();
  }

  function renderPackages() {
    const grid = $('#package-grid'); if (!grid) return;
    grid.classList.toggle('no-anim', Boolean(grid.dataset.rendered));
    grid.dataset.rendered = 'true';
    grid.innerHTML = (catalog().packages || []).map((item, index) => card(item, true, index)).join('');
  }

  function showDialog(id) {
    const dialog = document.getElementById(id);
    if (!dialog) return;
    state.closeMenu?.();
    state.lastFocus = document.activeElement;
    if (!dialog.open) dialog.showModal();
    document.body.classList.add('dialog-open');
  }

  function closeDialog(dialog) { if (dialog?.open) dialog.close(); }

  function dateLimits(input) {
    if (!input) return;
    const today = Core.today(); input.min = today; input.max = Core.addDays(today, 90);
    if (input.value && !Core.validDate(input.value, today)) input.value = Core.addDays(today, 1);
  }

  function detailInputs() {
    const item = findItem(state.detail);
    const date = $('#detail-date')?.value || state.detailContext?.date || state.context.date;
    const pax = Number($('#detail-pax')?.value || state.detailContext?.pax || state.context.pax);
    const valid = Core.validDate(date) && Number.isInteger(pax) && pax >= Math.max(2, item?.paxMin || 2) && pax <= Math.min(9, item?.paxMax || 9);
    return { date, pax, valid };
  }

  function openDetail(id) {
    const item = findItem(id); if (!item) return;
    state.detail = id;
    state.detailContext = { ...state.context, pax: Math.min(Math.max(state.context.pax, item.paxMin || 2), Math.min(9, item.paxMax || 9)) };
    renderDetail(); showDialog('detail-dialog'); updateAvailability();
  }

  function renderDetail() {
    const item = findItem(state.detail); if (!item || !$('#detail-content')) return;
    if ($('#detail-title')) $('#detail-title').textContent = text(item.title);
    const current = state.detailContext || state.context;
    const isPackage = (catalog().packages || []).some(entry => entry.id === item.id);
    const facts = item.facts || [];
    const itinerary = item.itinerary || [];
    const minPax = Math.max(2, item.paxMin || 2), maxPax = Math.min(9, item.paxMax || 9);
    $('#detail-content').innerHTML = `<div class="detail-hero"><img src="${escape(item.image)}" alt="${escape(text(item.alt))}" width="1400" height="800" decoding="async"><span>${escape(text(item.region))}</span></div><div class="detail-layout"><div class="detail-copy"><p class="detail-description">${escape(text(item.description))}</p><dl class="detail-facts"><div><dt>${escape(t('duration'))}</dt><dd>${escape(text(item.duration))}</dd></div><div><dt>${escape(t('modality'))}</dt><dd>${escape(text(item.mode))}</dd></div>${facts.map(fact => `<div><dt>${escape(text(fact.label))}</dt><dd>${escape(text(fact.value))}</dd></div>`).join('')}</dl><div class="detail-tabs" role="tablist" aria-label="${escape(t('details'))}"><button type="button" class="detail-tab active" role="tab" id="tab-itinerary" aria-controls="panel-itinerary" aria-selected="true" tabindex="0" data-tab="itinerary">${escape(t('itinerary'))}</button><button type="button" class="detail-tab" role="tab" id="tab-include" aria-controls="panel-include" aria-selected="false" tabindex="-1" data-tab="include">${escape(t('include'))}</button><button type="button" class="detail-tab" role="tab" id="tab-exclude" aria-controls="panel-exclude" aria-selected="false" tabindex="-1" data-tab="exclude">${escape(t('exclude'))}</button></div><section id="panel-itinerary" class="detail-panel" role="tabpanel" aria-labelledby="tab-itinerary" tabindex="0"><ol class="detail-itinerary">${itinerary.map((step, index) => `<li class="detail-day"><div><h4>${escape(text(step.title))}</h4><p>${escape(text(step.body))}</p></div></li>`).join('')}</ol></section><section id="panel-include" class="detail-panel" role="tabpanel" aria-labelledby="tab-include" tabindex="0" hidden><ul class="detail-list">${(item.includes?.[state.language] || item.includes?.es || []).map(entry => `<li>${icon('check')}${escape(entry)}</li>`).join('')}</ul></section><section id="panel-exclude" class="detail-panel" role="tabpanel" aria-labelledby="tab-exclude" tabindex="0" hidden><ul class="detail-list">${(item.excludes?.[state.language] || item.excludes?.es || []).map(entry => `<li>${icon('close')}${escape(entry)}</li>`).join('')}</ul></section></div><aside class="detail-sidebar"><p class="eyebrow">${escape(t('dateAndGroup'))}</p><div class="detail-controls"><label>${escape(t('date'))}<input type="date" id="detail-date" value="${escape(current.date)}" required></label><label>${escape(t('group'))}<select id="detail-pax">${Array.from({ length: Math.max(0, maxPax - minPax + 1) }, (_, index) => index + minPax).map(pax => `<option value="${pax}" ${pax === current.pax ? 'selected' : ''}>${pax} ${escape(t('travelers'))}</option>`).join('')}</select></label></div><div class="detail-quote"><span>${escape(t('quote'))}</span><strong id="detail-total">${escape(money(item.pricePEN * current.pax))}</strong><small id="detail-unit">${escape(money(item.pricePEN))} ${escape(t('perPerson'))}</small></div><p class="detail-price-note">${escape(t('priceNote'))} ${escape(t('adultNote'))}${isPackage ? ` ${escape(t('transferDate'))}` : ''}</p><p id="detail-availability" class="detail-availability" aria-live="polite"></p><p id="detail-error" class="form-error" role="alert" hidden></p><div id="detail-actions" class="detail-actions"></div><button type="button" class="btn btn-outline detail-plan" data-plan="${escape(item.id)}" aria-pressed="${state.plan.includes(item.id)}"></button>${item.booking === 'online' && state.language === 'en' ? `<small>${escape(t('paymentLanguage'))}</small>` : ''}</aside></div>`;
    dateLimits($('#detail-date'));
    updateDetailActions(); syncCounters();
  }

  function updateDetailActions() {
    const item = findItem(state.detail); if (!item) return;
    const input = detailInputs();
    state.detailContext = { ...state.context, date: input.date, pax: input.pax };
    if ($('#detail-total')) $('#detail-total').textContent = money(item.pricePEN * input.pax);
    if ($('#detail-unit')) $('#detail-unit').textContent = `${money(item.pricePEN)} ${t('perPerson')}`;
    const error = $('#detail-error');
    if (error) { error.hidden = input.valid; error.textContent = !Core.validDate(input.date) ? t('invalidDate') : t('unavailablePax'); }
    const host = $('#detail-actions'); if (!host) return;
    let currencyNote = $('#detail-currency-note');
    if (item.booking === 'online' && state.currency === 'EUR') {
      if (!currencyNote) { currencyNote = document.createElement('small'); currencyNote.id = 'detail-currency-note'; currencyNote.className = 'detail-price-note'; host.after(currencyNote); }
      currencyNote.textContent = checkoutCurrencyNote();
    } else currencyNote?.remove();
    if (!input.valid) { host.innerHTML = `<button type="button" class="btn btn-primary btn-solid" disabled>${escape(t(item.booking === 'online' ? 'bookNow' : 'consult'))}</button>`; return; }
    if (item.booking === 'online') {
      host.innerHTML = `<a class="btn btn-primary btn-solid" href="tour-utv.html?date=${encodeURIComponent(input.date)}&pax=${input.pax}#reservar">${escape(t('bookNow'))}${icon('arrow')}</a>`;
    } else {
      const message = Core.inquiry({ name: state.language === 'en' ? 'To confirm' : 'Por confirmar', email: state.language === 'en' ? 'To confirm' : 'Por confirmar', destination: text(item.title), date: input.date, pax: input.pax, message: `${t('estimated')}: ${money(item.pricePEN * input.pax)}. ${t('adultNote')}` }, state.language);
      host.innerHTML = `<a class="btn btn-primary btn-solid" href="${escape(waURL(message))}" target="_blank" rel="noopener noreferrer">${escape(t('consult'))}${icon('diagonal')}</a>`;
    }
  }

  async function updateAvailability() {
    const item = findItem(state.detail), container = $('#detail-availability');
    if (!item || !container) return;
    if (item.booking !== 'online') { container.textContent = t('transport'); return; }
    const input = detailInputs(); if (!input.valid) { container.textContent = ''; return; }
    const requestId = ++state.availabilityRequest;
    container.textContent = t('loadingAvailability');
    try {
      const response = await scope.fetch('/api/bootstrap', { credentials: 'same-origin' });
      if (!response.ok) throw new Error('availability');
      const result = await response.json();
      if (requestId !== state.availabilityRequest || state.detail !== item.id || !$('#detail-availability')) return;
      state.bootstrap = result;
      const price = Number(result.config?.prices?.adult);
      if (Number.isFinite(price) && price > 0) { item.pricePEN = price; renderCatalog(); updateDetailActions(); }
      const slots = (result.config?.slots || []).map(slot => ({ ...slot, available: result.availability?.[`${input.date}|${slot.id}`] })).filter(slot => slot.available && !slot.available.closed && !slot.available.expired && slot.available.freeVehicles >= Math.ceil(input.pax / 3));
      $('#detail-availability').textContent = slots.length ? `${t('arrivalTime')}: ${slots.map(slot => `${slot.time || slot.label || slot.id} (${slot.available.freeVehicles} ${state.language === 'en' ? 'UTVs' : 'UTV'})`).join(' · ')}` : t('unavailable');
      const action = $('#detail-actions a');
      if (action && !slots.length) { action.removeAttribute('href'); action.setAttribute('aria-disabled', 'true'); action.classList.add('disabled'); }
    } catch {
      if (requestId === state.availabilityRequest && $('#detail-availability')) $('#detail-availability').textContent = t('availabilityError');
    }
  }

  function selectTab(button, focus = false) {
    const dialog = $('#detail-dialog'); if (!dialog || !button) return;
    dialog.querySelectorAll('[data-tab]').forEach(tab => { const selected = tab === button; tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1; tab.classList.toggle('active', selected); });
    dialog.querySelectorAll('.detail-panel').forEach(panel => { panel.hidden = panel.id !== button.getAttribute('aria-controls'); });
    if (focus) button.focus();
  }

  function toggleSaved(id) {
    if (!findItem(id)) return;
    const already = state.saved.includes(id);
    state.saved = already ? state.saved.filter(entry => entry !== id) : [...state.saved, id];
    write('premium_saved', state.saved); renderCatalog(); syncCounters(); toast(t(already ? 'favoriteRemoved' : 'favoriteAdded'));
  }

  function togglePlan(id) {
    if (!findItem(id)) return;
    const already = state.plan.includes(id);
    let contextChanged = false;
    if (!already && state.detail === id && $('#detail-dialog')?.open) {
      const selection = detailInputs();
      if (!selection.valid) { toast(!Core.validDate(selection.date) ? t('invalidDate') : t('unavailablePax')); return; }
      state.context = Core.context({ ...state.context, date: selection.date, pax: selection.pax });
      persistContext(); contextChanged = true;
      if ($('#q-fecha')) $('#q-fecha').value = state.context.date;
      if ($('#q-pax')) $('#q-pax').value = String(state.context.pax);
      if ($('#cf-date')) $('#cf-date').value = state.context.date;
      if ($('#cf-pax')) $('#cf-pax').value = String(state.context.pax);
    }
    state.plan = already ? state.plan.filter(entry => entry !== id) : [...state.plan, id];
    write('premium_plan', state.plan); if (contextChanged) renderCatalog(); syncCounters();
    const counter = $('#plan-count'); if (counter) { counter.classList.remove('bump'); void counter.offsetWidth; counter.classList.add('bump'); }
    if ($('#plan-dialog')?.open) renderPlan();
    toast(t(already ? 'planRemoved' : 'planAdded'));
  }

  function toggleComparison(id) {
    const result = Core.toggleCompare(state.compare, id, (catalog().tours || []).map(item => item.id));
    state.compare = result.items; syncCounters();
    if (result.limited) toast(t('compareLimit'));
    if ($('#compare-dialog')?.open) renderCompare();
  }

  function renderCompare() {
    if (!$('#compare-content')) return;
    const items = state.compare.map(findItem).filter(Boolean);
    if (items.length < 2) { $('#compare-content').innerHTML = `<div class="empty-state"><p>${escape(t('compareEmpty'))}</p></div>`; return; }
    const row = (label, getValue) => `<tr><th scope="row">${escape(label)}</th>${items.map(item => `<td>${getValue(item)}</td>`).join('')}</tr>`;
    $('#compare-content').innerHTML = `<div class="comparison-scroll" tabindex="0" aria-label="${escape(t('compare'))}"><table class="comparison-table compare-table"><thead><tr><th scope="col">${escape(t('compare'))}</th>${items.map(item => `<th scope="col"><img src="${escape(item.image)}" alt="${escape(text(item.alt))}" width="280" height="180"><h3>${escape(text(item.title))}</h3><button type="button" class="text-button" data-remove-compare="${escape(item.id)}">${escape(t('remove'))}</button></th>`).join('')}</tr></thead><tbody>${row(t('price'), item => `${escape(money(item.pricePEN))}<small>${escape(t('comparedPrice'))}</small>`)}${row(t('duration'), item => escape(text(item.duration)))}${row(t('destination'), item => escape(text(item.region)))}${row(t('modality'), item => escape(text(item.mode)))}${row(t('include'), item => `<ul>${(item.includes?.[state.language] || item.includes?.es || []).map(entry => `<li>${escape(entry)}</li>`).join('')}</ul>`)}${row(t('fullGroup'), item => `${escape(money(item.pricePEN * state.context.pax))}<small>${state.context.pax} ${escape(t('travelers'))}</small>`)}<tr><th scope="row">${escape(t('details'))}</th>${items.map(item => `<td><button type="button" class="btn btn-outline" data-compare-detail="${escape(item.id)}">${escape(t('details'))}${icon('arrow')}</button></td>`).join('')}</tr></tbody></table></div><p class="dialog-note">${escape(t('priceNote'))} ${escape(t('adultNote'))}</p>`;
  }

  function renderPlan() {
    if (!$('#plan-content')) return;
    const items = state.plan.map(findItem).filter(Boolean);
    const download = $('#plan-download'), whatsapp = $('#plan-whatsapp');
    if (download) {
      const url = items.length ? Core.planDownloadURL(planText(), state.context.date) : null;
      download.setAttribute('aria-disabled', String(!url)); download.classList.toggle('disabled', !url);
      if (url) { download.href = url; download.setAttribute('download', `Buganvilla-viaje-${state.context.date}.txt`); download.removeAttribute('title'); }
      else { download.removeAttribute('href'); download.removeAttribute('download'); if (items.length) download.title = state.language === 'en' ? 'Reduce the selection to download the proposal.' : 'Reduce la selección para descargar la propuesta.'; }
    }
    if (whatsapp) { whatsapp.hidden = !items.length; whatsapp.href = waURL(planText()); }
    if (!items.length) { $('#plan-content').innerHTML = `<div class="empty-state"><h3>${escape(t('emptyPlan'))}</h3><p>${escape(t('emptyPlanBody'))}</p><button type="button" class="btn btn-outline" data-close-dialog>${escape(t('details'))}${icon('arrow')}</button></div>`; return; }
    $('#plan-content').innerHTML = `<div class="plan-context"><label>${escape(t('selectedDate'))}<input id="plan-date" type="date" value="${escape(state.context.date)}"></label><label>${escape(t('participants'))}<select id="plan-pax">${Array.from({ length: 8 }, (_, index) => index + 2).map(pax => `<option value="${pax}" ${pax === state.context.pax ? 'selected' : ''}>${pax} ${escape(t('travelers'))}</option>`).join('')}</select></label></div><div class="plan-items">${items.map(item => `<article class="plan-item"><img src="${escape(item.image)}" alt="${escape(text(item.alt))}" width="220" height="160" loading="lazy"><div><span class="eyebrow">${escape(text(item.region))}</span><h3>${escape(text(item.title))}</h3><p>${escape(text(item.duration))} · ${escape(text(item.mode))}</p><strong>${escape(money(item.pricePEN * state.context.pax))}</strong><small>${escape(t('estimated'))} · ${state.context.pax} ${escape(t('travelers'))}</small><div class="plan-item-actions"><button type="button" class="text-button" data-plan-detail="${escape(item.id)}">${escape(t('details'))}${icon('arrow')}</button><button type="button" class="text-button" data-plan="${escape(item.id)}" aria-pressed="true">${escape(t('removeFromPlan'))}</button></div></div></article>`).join('')}</div><p class="dialog-note">${escape(t('planAlternative'))}</p><p class="dialog-note">${escape(t('planNoBooking'))} ${escape(t('adultNote'))}</p>`;
    dateLimits($('#plan-date'));
  }

  function planText() {
    const separator = '\n';
    const sections = [t('planDownloads'), '', `${t('selectedDate')}: ${state.context.date}`, `${t('participants')}: ${state.context.pax}`, `${t('price')}: ${state.currency}`, ''];
    state.plan.map(findItem).filter(Boolean).forEach((item, index) => {
      sections.push(`${index + 1}. ${text(item.title)}`, `${text(item.region)} | ${text(item.duration)} | ${text(item.mode)}`, text(item.description), `${t('estimated')}: ${money(item.pricePEN * state.context.pax)} (${state.context.pax} ${t('travelers')})`, `${t('itinerary')}:`);
      (item.itinerary || []).forEach((step, stepIndex) => sections.push(`  ${stepIndex + 1}. ${text(step.title)}: ${text(step.body)}`));
      sections.push(`${t('include')}: ${(item.includes?.[state.language] || item.includes?.es || []).join('; ')}`, `${t('exclude')}: ${(item.excludes?.[state.language] || item.excludes?.es || []).join('; ')}`, '');
    });
    sections.push(t('planAlternative'), t('planNoBooking'), t('priceNote'), t('adultNote'), t('demo'));
    return sections.join(separator);
  }

  function renderReview() {
    const reviews = catalog().reviews || []; if (!reviews.length) return;
    state.review = ((state.review % reviews.length) + reviews.length) % reviews.length;
    const review = reviews[state.review];
    if ($('#review-summary')) $('#review-summary').textContent = text(review.summary);
    if ($('#review-author')) $('#review-author').textContent = review.author;
    if ($('#review-theme')) $('#review-theme').textContent = text(review.theme);
    if ($('#review-counter')) $('#review-counter').textContent = `${String(state.review + 1).padStart(2, '0')} / ${String(reviews.length).padStart(2, '0')}`;
    if ($('#review-source')) { $('#review-source').href = typeof review.source === 'string' ? review.source : review.source?.url || 'https://buganvillatours.com/utv-en-huacachina/'; $('#review-source').setAttribute('target', '_blank'); $('#review-source').setAttribute('rel', 'noopener noreferrer'); }
  }

  function resetFilters() {
    state.context.destination = 'all'; state.query = ''; state.sort = 'editorial'; state.savedOnly = false;
    if ($('#catalog-search')) $('#catalog-search').value = '';
    if ($('#catalog-sort')) $('#catalog-sort').value = 'editorial';
    if ($('#only-saved')) $('#only-saved').checked = false;
    persistContext(); renderCatalog();
  }

  function renderLegal(type) {
    if (type === 'photography') {
      if ($('#legal-title')) $('#legal-title').textContent = t('photoCredits');
      const heading = state.language === 'en' ? 'View original photograph' : 'Ver fotografía original';
      if ($('#legal-content')) $('#legal-content').innerHTML = `<p>${escape(text(catalog().photographyNote))}</p><ul class="photo-credits">${Object.values(catalog().imageMetadata || {}).map(photo => `<li><strong>${escape(photo.credit)}</strong><p>${escape(text(photo.alt))} · ${escape(photo.location)}</p>${typeof photo.source === 'string' && photo.source.startsWith('https://') ? `<a href="${escape(photo.source)}" target="_blank" rel="noopener noreferrer">${escape(heading)}${icon('diagonal')}</a>` : ''}</li>`).join('')}</ul>`;
      showDialog('legal-dialog');
      return;
    }
    const privacy = type === 'privacy';
    const title = t(privacy ? 'privacyTitle' : 'termsTitle');
    if ($('#legal-title')) $('#legal-title').textContent = title;
    const paragraphs = state.language === 'en' ? privacy ? [
      'Saved experiences, trip selections, language and currency are stored in this browser. You can remove them by deleting the site data in your browser settings.',
      'The newsletter form stores your email, selected language, consent and registration date in the local application database. It does not send newsletters in this demonstration. To request removal, contact the agency using the email below.',
      'The contact form prepares an enquiry for WhatsApp or email. Your enquiry is sent only when you choose one of those channels and complete the sending process.',
      'Images and fonts may load from Unsplash and Google Fonts. Their services receive the network information required to deliver those resources. Do not enter real payment data in this demonstration.'
    ] : [
      'This application is a functional demonstration. Rates, currency conversions, programme contents and service policies require confirmation by Buganvilla Tours before commercial operation.',
      'Only the Huacachina UTV experience has an online demonstration booking flow. Payments are simulated. Other experiences and programmes are prepared as enquiries and require confirmation by the agency.',
      'Saving or downloading a trip proposal does not create a booking, reserve seats or guarantee availability. Package estimates are shown separately as alternative programmes.',
      'Final schedules, meeting points, minimum ages, insurance and cancellation conditions must be confirmed with the operator before travelling.'
    ] : privacy ? [
      'Las experiencias guardadas, la selección del viaje, el idioma y la moneda se almacenan en este navegador. Puedes eliminarlos borrando los datos del sitio desde la configuración del navegador.',
      'El formulario de boletín registra tu correo, idioma, consentimiento y fecha de registro en la base de datos local de la aplicación. Esta demostración no envía boletines. Para solicitar la eliminación, contacta con la agencia en el correo indicado debajo.',
      'El formulario de contacto prepara una consulta para WhatsApp o correo. La consulta solo se envía al elegir uno de esos canales y completar el envío.',
      'Las imágenes y tipografías pueden cargarse desde Unsplash y Google Fonts. Esos servicios reciben la información de red necesaria para entregar los recursos. No introduzcas datos de pago reales en esta demostración.'
    ] : [
      'Esta aplicación es una demostración funcional. Las tarifas, conversiones de moneda, contenidos de programas y políticas del servicio requieren la validación de Buganvilla Tours antes de operar comercialmente.',
      'La experiencia UTV en Huacachina dispone de un proceso de reserva en línea de demostración. Los pagos son simulados. Las demás experiencias y programas se preparan como consultas y requieren confirmación de la agencia.',
      'Guardar o descargar una propuesta no crea una reserva, no aparta cupos y no garantiza disponibilidad. Las estimaciones de los programas se muestran por separado como alternativas.',
      'Los horarios definitivos, puntos de encuentro, edades mínimas, seguros y condiciones de cancelación se deben confirmar con el operador antes del viaje.'
    ];
    if ($('#legal-content')) $('#legal-content').innerHTML = paragraphs.map(paragraph => `<p>${escape(paragraph)}</p>`).join('') + `<a href="mailto:${escape(getEmail())}">${escape(getEmail())}</a>`;
    showDialog('legal-dialog');
  }

  function prepareContact(event) {
    event.preventDefault();
    const form = $('#contact-form'); if (!form) return;
    const values = { name: $('#cf-name')?.value.trim() || '', email: $('#cf-email')?.value.trim() || '', destination: $('#cf-destination')?.selectedOptions?.[0]?.textContent || $('#cf-destination')?.value || '', date: $('#cf-date')?.value || '', pax: Number($('#cf-pax')?.value), message: $('#cf-message')?.value.trim() || '' };
    const consent = $('#cf-consent')?.checked;
    const valid = form.checkValidity() && values.name.length >= 2 && values.name.length <= 100 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email) && values.email.length <= 254 && Core.validDate(values.date) && Number.isInteger(values.pax) && values.pax >= 2 && values.pax <= 9 && values.message.length <= 2000 && consent;
    const error = $('#contact-error');
    if (!valid) { if (error) { error.textContent = t('inquiryError'); error.hidden = false; } form.reportValidity(); return; }
    if (error) { error.hidden = true; error.textContent = ''; }
    const message = Core.inquiry(values, state.language);
    if ($('#contact-preview-content')) $('#contact-preview-content').innerHTML = `<h3>${escape(t('inquiryHeading'))}</h3><pre class="contact-message">${escape(message)}</pre><p>${escape(t('inquiryNote'))}</p>`;
    if ($('#contact-send-WA')) $('#contact-send-WA').href = waURL(message);
    const emailLink = $('#contact-send-email');
    if (emailLink) emailLink.href = `mailto:${getEmail()}?subject=${encodeURIComponent(`${t('contact')} | ${values.destination}`)}&body=${encodeURIComponent(message)}`;
    showDialog('contact-preview-dialog');
  }

  async function submitNewsletter(event) {
    event.preventDefault(); if (state.newsletterBusy) return;
    const form = $('#newsletter-form'), input = $('#newsletter-email'), feedback = $('#newsletter-feedback') || $('.newsletter-feedback');
    if (!form || !input) return;
    const email = input.value.trim();
    const valid = form.checkValidity() && Core.newsletterValid(email, $('#newsletter-consent')?.checked);
    if (!valid) { if (feedback) { feedback.textContent = t('newsletterError'); feedback.setAttribute('role', 'alert'); feedback.hidden = false; } form.reportValidity(); return; }
    state.newsletterBusy = true;
    const button = form.querySelector('button[type="submit"]');
    if (button) { button.disabled = true; button.setAttribute('aria-busy', 'true'); }
    if (feedback) { feedback.textContent = t('querySending'); feedback.setAttribute('role', 'status'); feedback.hidden = false; }
    try {
      const response = await scope.fetch('/api/newsletter', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, locale: state.language, consent: true }) });
      const result = await response.json(); if (!response.ok || result.ok !== true) throw new Error('newsletter');
      if (feedback) { feedback.textContent = t(result.alreadySubscribed ? 'newsletterExisting' : 'newsletterSuccess'); feedback.setAttribute('role', 'status'); feedback.hidden = false; }
      form.reset();
    } catch { if (feedback) { feedback.textContent = t('offline'); feedback.setAttribute('role', 'alert'); feedback.hidden = false; } }
    finally { state.newsletterBusy = false; if (button) { button.disabled = false; button.removeAttribute('aria-busy'); } }
  }

  function setLanguage(language) {
    if (!['es', 'en'].includes(language)) return;
    if ($('#detail-dialog')?.open) state.detailContext = { ...state.context, ...detailInputs() };
    state.language = language; write('premium_language', language);
    syncTranslations(); renderCatalog(); renderPackages(); renderReview(); syncCounters();
    if ($('#detail-dialog')?.open) { renderDetail(); updateAvailability(); }
    if ($('#compare-dialog')?.open) renderCompare();
    if ($('#plan-dialog')?.open) renderPlan();
  }

  function setCurrency(currency) {
    if (!['PEN', 'USD', 'EUR'].includes(currency)) return;
    if ($('#detail-dialog')?.open) state.detailContext = { ...state.context, ...detailInputs() };
    state.currency = currency; write('premium_currency', currency);
    try { scope.localStorage.setItem('bgv_currency', Core.legacyCurrency(currency)); } catch {}
    syncTranslations(); renderCatalog(); renderPackages(); syncCounters();
    if ($('#detail-dialog')?.open) { renderDetail(); updateAvailability(); }
    if ($('#compare-dialog')?.open) renderCompare();
    if ($('#plan-dialog')?.open) renderPlan();
    if (currency === 'EUR') toast(checkoutCurrencyNote());
  }

  function bindMenu() {
    const header = $('#head'), menu = $('#menuBtn'), nav = $('#nav'); if (!header || !menu || !nav) return;
    const small = scope.matchMedia('(max-width: 980px)');
    const background = [...document.querySelectorAll('main, footer, #compare-bar')];
    const setMenu = open => {
      const expanded = open && small.matches;
      menu.setAttribute('aria-expanded', String(expanded)); menu.setAttribute('aria-label', t(expanded ? 'menuClose' : 'menuOpen'));
      nav.classList.toggle('open', expanded); header.classList.toggle('menu-open', expanded);
      nav.inert = small.matches && !expanded;
      background.forEach(element => { element.inert = expanded; });
      document.body.classList.toggle('menu-open', expanded);
    };
    state.closeMenu = () => setMenu(false);
    menu.addEventListener('click', () => setMenu(menu.getAttribute('aria-expanded') !== 'true'));
    nav.addEventListener('click', event => { if (event.target.closest('a')) setMenu(false); });
    document.addEventListener('click', event => { if (!header.contains(event.target) && menu.getAttribute('aria-expanded') === 'true') setMenu(false); });
    document.addEventListener('keydown', event => {
      if (menu.getAttribute('aria-expanded') !== 'true') return;
      if (event.key === 'Escape') { setMenu(false); menu.focus(); }
      if (event.key === 'Tab') {
        const controls = [...header.querySelectorAll('a[href], button:not([disabled]), select')].filter(element => element.getClientRects().length && !element.closest('[inert]'));
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    });
    small.addEventListener('change', () => setMenu(false)); setMenu(false);
    let queued = false;
    const onScroll = () => { if (queued) return; queued = true; scope.requestAnimationFrame(() => { header.classList.toggle('scrolled', scope.scrollY > 30); header.classList.toggle('solid', scope.scrollY > 30); queued = false; }); };
    scope.addEventListener('scroll', onScroll, { passive: true }); onScroll();
    if ('IntersectionObserver' in scope) {
      const links = [...nav.querySelectorAll('a[href^="#"]')];
      const observer = new IntersectionObserver(entries => { entries.filter(entry => entry.isIntersecting).forEach(entry => { links.forEach(link => { const active = link.getAttribute('href') === `#${entry.target.id}`; link.classList.toggle('active', active); if (active) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current'); }); }); }, { rootMargin: '-20% 0px -60% 0px', threshold: 0 });
      links.forEach(link => { const target = document.getElementById(link.getAttribute('href').slice(1)); if (target) observer.observe(target); });
    }
  }

  function observeReveals() {
    const elements = $$('.reveal');
    if (scope.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in scope)) { elements.forEach(element => element.classList.add('visible', 'in-view')); return; }
    const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('visible', 'in-view'); observer.unobserve(entry.target); } }), { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });
    document.documentElement.classList.add('motion-ready');
    elements.forEach((element, index) => { element.style.setProperty('--reveal-delay', `${Math.min(index % 4, 3) * 80}ms`); observer.observe(element); });
  }

  function init() {
    const ids = allItems().map(item => item.id);
    state.saved = Array.isArray(state.saved) ? [...new Set(state.saved)].filter(id => ids.includes(id)) : [];
    state.plan = Array.isArray(state.plan) ? [...new Set(state.plan)].filter(id => ids.includes(id)) : [];
    try { scope.localStorage.setItem('bgv_currency', Core.legacyCurrency(state.currency)); } catch {}
    if ($('#year')) $('#year').textContent = Core.today().slice(0, 4);
    if ($('#q-fecha')) { dateLimits($('#q-fecha')); $('#q-fecha').value = state.context.date; }
    if ($('#q-pax')) $('#q-pax').value = String(state.context.pax);
    dateLimits($('#cf-date')); if ($('#cf-date') && !$('#cf-date').value) $('#cf-date').value = state.context.date;
    if ($('#cf-pax')) $('#cf-pax').value = String(state.context.pax);
    if ($('#cf-destination')) $('#cf-destination').value = state.context.destination;
    syncTranslations(); renderCatalog(); renderPackages(); renderReview(); syncCounters(); bindMenu(); observeReveals();
    $('#language-select')?.addEventListener('change', event => setLanguage(event.target.value));
    $('#currency-select')?.addEventListener('change', event => setCurrency(event.target.value));
    $('#search-form')?.addEventListener('submit', event => {
      event.preventDefault(); const form = event.currentTarget;
      const input = { destination: $('#q-dest')?.value, date: $('#q-fecha')?.value, pax: Number($('#q-pax')?.value) };
      if (!form.checkValidity() || !Core.validDate(input.date) || !Number.isInteger(input.pax) || input.pax < 2 || input.pax > 9) { $('#q-fecha')?.setCustomValidity(!Core.validDate(input.date) ? t('invalidDate') : ''); form.reportValidity(); return; }
      $('#q-fecha')?.setCustomValidity(''); state.context = Core.context(input); persistContext();
      if ($('#cf-date')) $('#cf-date').value = state.context.date; if ($('#cf-pax')) $('#cf-pax').value = String(state.context.pax);
      if ($('#cf-destination')) $('#cf-destination').value = state.context.destination;
      renderCatalog(); $('#destinos')?.scrollIntoView({ behavior: scope.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    });
    $('#q-fecha')?.addEventListener('input', event => event.target.setCustomValidity(''));
    $('#catalog-search')?.addEventListener('input', event => { state.query = event.target.value; renderCatalog(); });
    $('#catalog-sort')?.addEventListener('change', event => { state.sort = event.target.value; renderCatalog(); });
    $('#only-saved')?.addEventListener('change', event => { state.savedOnly = event.target.checked; renderCatalog(); });
    $('#open-compare')?.addEventListener('click', () => { renderCompare(); showDialog('compare-dialog'); });
    $('#clear-compare')?.addEventListener('click', () => { state.compare = []; syncCounters(); });
    $('#open-plan')?.addEventListener('click', () => { renderPlan(); showDialog('plan-dialog'); });
    $('#review-prev')?.addEventListener('click', () => { state.review--; renderReview(); });
    $('#review-next')?.addEventListener('click', () => { state.review++; renderReview(); });
    $('#contact-form')?.addEventListener('submit', prepareContact);
    $('#newsletter-form')?.addEventListener('submit', submitNewsletter);
    document.addEventListener('click', event => {
      const button = event.target.closest('button, a[data-legal]'); if (!button) return;
      if (button.matches('[data-detail]')) openDetail(button.dataset.detail);
      else if (button.matches('[data-save]')) toggleSaved(button.dataset.save);
      else if (button.matches('[data-plan]')) togglePlan(button.dataset.plan);
      else if (button.matches('[data-filter]')) { state.context.destination = button.dataset.filter; persistContext(); renderCatalog(); }
      else if (button.matches('[data-reset-filters]')) resetFilters();
      else if (button.matches('[data-tab]')) selectTab(button);
      else if (button.matches('[data-close-dialog]')) closeDialog(button.closest('dialog'));
      else if (button.matches('[data-remove-compare]')) toggleComparison(button.dataset.removeCompare);
      else if (button.matches('[data-compare-detail], [data-plan-detail]')) { const id = button.dataset.compareDetail || button.dataset.planDetail; closeDialog(button.closest('dialog')); openDetail(id); }
      else if (button.matches('[data-legal]')) { event.preventDefault(); renderLegal(button.dataset.legal); }
    });
    document.addEventListener('change', event => {
      const target = event.target;
      if (target.matches('[data-compare]')) toggleComparison(target.dataset.compare);
      else if (target.matches('#detail-date, #detail-pax')) { updateDetailActions(); updateAvailability(); }
      else if (target.matches('#plan-date, #plan-pax')) {
        const date = $('#plan-date')?.value, pax = Number($('#plan-pax')?.value);
        if (!Core.validDate(date)) { $('#plan-date')?.setCustomValidity(t('invalidDate')); $('#plan-date')?.reportValidity(); return; }
        $('#plan-date')?.setCustomValidity(''); state.context = Core.context({ ...state.context, date, pax }); persistContext();
        if ($('#q-fecha')) $('#q-fecha').value = state.context.date; if ($('#q-pax')) $('#q-pax').value = String(state.context.pax);
        renderPlan(); renderCatalog();
      }
    });
    $('#detail-dialog')?.addEventListener('keydown', event => {
      if (!event.target.matches('[data-tab]')) return;
      const tabs = [...$('#detail-dialog').querySelectorAll('[data-tab]')], index = tabs.indexOf(event.target);
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      if (next !== undefined) { event.preventDefault(); selectTab(tabs[next], true); }
    });
    $$('dialog').forEach(dialog => {
      dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog(dialog); } });
      dialog.addEventListener('close', () => { if (dialog.id === 'detail-dialog') state.availabilityRequest++; document.body.classList.toggle('dialog-open', Boolean($('dialog[open]'))); });
    });
    scope.addEventListener('focus', () => {
      const previousDate = state.context.date;
      ['#q-fecha', '#cf-date', '#detail-date', '#plan-date'].forEach(selector => dateLimits($(selector)));
      state.context = Core.context(state.context);
      if (state.context.date !== previousDate) { persistContext(); renderCatalog(); if ($('#plan-dialog')?.open) renderPlan(); }
      if ($('#detail-dialog')?.open) { updateDetailActions(); updateAvailability(); }
    });
  }

  scope.Premium = { state, init, money, setLanguage, setCurrency, openDetail, renderCatalog, renderPlan, planText };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})(typeof window !== 'undefined' ? window : globalThis);



