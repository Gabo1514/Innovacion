(() => {
  'use strict';

  const territories = [
    { id: 'huacachina', place: 'Huacachina', image: 'utv', number: '01', item: 'utv-huacachina', accent: '#ffb547', coords: { es: '14°05′S · 75°46′O', en: '14°05′S · 75°46′W' }, es: { line: 'en UTV.', label: 'Desierto costero', action: 'Elegir mi turno' }, en: { line: 'by UTV.', label: 'Coastal desert', action: 'Choose my departure' } },
    { id: 'paracas', place: 'Paracas', image: 'paracas', number: '02', item: 'ballestas-paracas', accent: '#4fd8d0', coords: { es: '13°50′S · 76°15′O', en: '13°50′S · 76°15′W' }, es: { line: 'por mar.', label: 'Costa del Pacífico', action: 'Ver el recorrido' }, en: { line: 'by sea.', label: 'Pacific coast', action: 'View the itinerary' } },
    { id: 'nasca', place: 'Nasca', image: 'nasca', number: '03', item: 'lineas-nasca', accent: '#ff8f5c', coords: { es: '14°50′S · 74°56′O', en: '14°50′S · 74°56′W' }, es: { line: 'desde el aire.', label: 'Líneas y geoglifos', action: 'Ver el recorrido' }, en: { line: 'from the air.', label: 'Lines and geoglyphs', action: 'View the itinerary' } },
    { id: 'ica', place: 'Ica', image: 'introMain', number: '04', item: 'ruta-pisco', accent: '#c8a6ff', coords: { es: '14°04′S · 75°44′O', en: '14°04′S · 75°44′W' }, es: { line: 'entre bodegas.', label: 'Bodegas y pisco', action: 'Ver el recorrido' }, en: { line: 'among wineries.', label: 'Wineries and pisco', action: 'View the itinerary' } },
  ];
  const SLIDE_DURATION = 7000;

  const init = () => {
    const premium = window.Premium;
    const hero = document.getElementById('reserva');
    const action = document.getElementById('cover-action');
    const placeElement = document.getElementById('cover-title-place');
    const lineElement = document.getElementById('cover-title-line-one');
    if (!premium || !hero || !action || !placeElement) return;

    const root = document.documentElement;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const catalog = () => window.PremiumCatalog || {};
    const language = () => premium.state.language === 'en' ? 'en' : 'es';
    const localized = value => typeof value === 'object' && value !== null ? String(value[language()] ?? value.es ?? value.en ?? '') : String(value ?? '');
    const setText = (id, value) => { const element = document.getElementById(id); if (element) element.textContent = value; };
    const slides = [...hero.querySelectorAll('.hero-slide')];
    const autoplayButton = document.getElementById('hero-autoplay');

    let current = Math.max(0, territories.findIndex(entry => entry.id === premium.state.context.destination));
    let lastDestination = premium.state.context.destination;
    let shown = -1;
    let ready = !root.classList.contains('intro');

    const imageURL = key => {
      const entry = catalog().images?.[key];
      let source = typeof entry === 'string' ? entry : entry?.url || entry?.src || '';
      if (/^https:\/\/images\.unsplash\.com\//.test(source)) source = source.replace(/([?&])w=\d+/, '$1w=2000');
      return source;
    };

    const prepareSlide = index => {
      const slide = slides.find(entry => entry.dataset.slide === territories[index].id);
      const image = slide?.querySelector('img');
      if (image && !image.getAttribute('src')) image.src = imageURL(image.dataset.heroImage);
      return { slide, image };
    };

    const decoded = image => {
      if (!image) return Promise.resolve();
      const wait = image.complete ? Promise.resolve() : new Promise(resolve => { image.addEventListener('load', resolve, { once: true }); image.addEventListener('error', resolve, { once: true }); });
      return Promise.race([wait.then(() => image.decode?.().catch(() => {})), new Promise(resolve => setTimeout(resolve, 1400))]);
    };

    // Ajusta el nombre del destino para que ocupe el ancho disponible sin desbordar.
    const fitPlace = () => {
      const chars = placeElement.querySelector('.chars');
      if (!chars) return;
      const available = placeElement.parentElement.clientWidth;
      placeElement.style.setProperty('--place-size', '100px');
      const measured = chars.getBoundingClientRect().width || 1;
      const cap = Math.min(260, window.innerHeight * (window.innerWidth < 720 ? 0.2 : 0.26));
      const size = Math.max(44, Math.min(cap, (100 * available * 0.99) / measured));
      placeElement.style.setProperty('--place-size', `${size.toFixed(1)}px`);
    };

    const animateTitle = () => {
      if (!ready || reducedMotion.matches) return;
      [placeElement, lineElement].forEach(element => { element.classList.remove('is-entering'); void element.offsetWidth; element.classList.add('is-entering'); });
    };

    const renderTitle = (territory, animate) => {
      const name = territory.place.toUpperCase();
      placeElement.innerHTML = `<span class="sr-only">${territory.place}</span><span class="chars" aria-hidden="true">${[...name].map((character, index) => `<span class="ch" style="--i:${index}">${character}</span>`).join('')}</span>`;
      lineElement.textContent = territory[language()].line;
      fitPlace();
      if (animate) animateTitle();
    };

    // Videos reales de la agencia: solo en pantallas amplias, sin ahorro de datos ni movimiento reducido.
    const wideScreen = window.matchMedia('(min-width: 768px)');
    let heroVisible = true;
    const videoAllowed = () => wideScreen.matches && !reducedMotion.matches && !navigator.connection?.saveData && !/2g$/.test(navigator.connection?.effectiveType || '');
    const ensureVideo = entry => {
      let video = entry.querySelector('video');
      if (video) return video;
      video = document.createElement('video');
      video.muted = true; video.loop = true; video.playsInline = true; video.preload = 'auto'; video.disablePictureInPicture = true;
      ['muted', 'playsinline'].forEach(name => video.setAttribute(name, ''));
      video.setAttribute('aria-hidden', 'true');
      const shown = () => entry.dataset.slide === territories[current].id;
      // Se muestra solo cuando el navegador estima que puede reproducirlo sin cortes; si se atasca, vuelve la foto.
      const reveal = () => {
        if (video.paused || video.readyState < 4) return;
        entry.classList.add('has-video');
        if (shown()) hero.classList.add('video-on');
      };
      video.addEventListener('canplaythrough', reveal);
      video.addEventListener('playing', reveal);
      video.addEventListener('waiting', () => { entry.classList.remove('has-video'); if (shown()) hero.classList.remove('video-on'); });
      video.src = entry.dataset.video;
      entry.append(video);
      return video;
    };

    const syncVideos = () => {
      const active = territories[current].id, next = territories[(current + 1) % territories.length].id;
      let videoOn = false;
      slides.forEach(entry => {
        const usable = Boolean(entry.dataset.video) && videoAllowed();
        if (entry.dataset.slide === active && usable && heroVisible && !document.hidden) {
          ensureVideo(entry).play().catch(() => {});
          videoOn = entry.classList.contains('has-video');
          return;
        }
        entry.querySelector('video')?.pause();
        // Precarga el video del siguiente destino para que el cambio sea inmediato.
        if (entry.dataset.slide === next && usable && heroVisible) ensureVideo(entry);
      });
      hero.classList.toggle('video-on', videoOn);
    };

    const showSlide = index => {
      const { slide, image } = prepareSlide(index);
      if (!slide) return;
      prepareSlide((index + 1) % territories.length);
      const previous = slides.find(entry => entry.classList.contains('is-active') && entry !== slide);
      const swap = () => {
        slides.forEach(entry => { if (entry !== slide && entry !== previous) entry.classList.remove('is-active', 'is-leaving', 'is-first'); });
        if (previous) { previous.classList.remove('is-active', 'is-first'); previous.classList.add('is-leaving'); }
        slide.classList.remove('is-leaving', 'is-active', 'is-first'); void slide.offsetWidth; slide.classList.add('is-active');
        if (previous) window.setTimeout(() => previous.classList.remove('is-leaving'), 1450);
      };
      if (reducedMotion.matches) { swap(); return; }
      decoded(image).then(() => { if (shown === index) swap(); });
    };

    const render = ({ animate = true } = {}) => {
      const territory = territories[current];
      const lang = language();
      const copy = territory[lang];
      const item = catalog().tours?.find(entry => entry.id === territory.item);
      const changed = shown !== current;

      hero.dataset.dest = territory.id;
      root.style.setProperty('--dest', territory.accent);
      if (changed || !placeElement.querySelector('.chars') || placeElement.querySelector('.sr-only')?.textContent !== territory.place) renderTitle(territory, animate && changed);
      else lineElement.textContent = copy.line;
      setText('cover-title-line-two', '');
      setText('cover-label', `${territory.number} / ${copy.label}`);
      setText('cover-coords', territory.coords[lang]);
      setText('cover-description', localized(item?.description));
      setText('cover-fact-duration', localized(item?.duration));
      setText('cover-fact-group-label', territory.id === 'huacachina' ? lang === 'en' ? 'Per UTV' : 'Por UTV' : lang === 'en' ? 'Group' : 'Grupo');
      setText('cover-fact-group', territory.id === 'huacachina' ? lang === 'en' ? 'Up to 3 travellers' : 'Hasta 3 viajeros' : `${item?.paxMin || 1}–${item?.paxMax || 9} ${lang === 'en' ? 'travellers' : 'viajeros'}`);
      setText('cover-fact-mode', localized(item?.mode));

      const metadata = catalog().imageMetadata?.[territory.image];
      const slideVideo = slides.find(entry => entry.dataset.slide === territory.id)?.dataset.video;
      const credit = slideVideo && videoAllowed()
        ? `${lang === 'en' ? 'Video by Buganvilla Tours' : 'Video de Buganvilla Tours'} · ${territory.place}`
        : metadata?.credit === 'Buganvilla Tours'
        ? `${lang === 'en' ? 'Photography by Buganvilla Tours' : 'Fotografía de Buganvilla Tours'}${metadata?.location ? ` · ${metadata.location}` : ''}`
        : `${lang === 'en' ? 'Photograph' : 'Fotografía'} · ${metadata?.credit || 'Unsplash'}${metadata?.location ? ` · ${metadata.location}` : ''}`;
      setText('cover-credit', credit);

      const label = action.querySelector('span');
      if (label) { label.removeAttribute('data-i18n'); label.textContent = copy.action; }
      if (territory.id === 'huacachina') {
        action.href = `tour-utv.html?date=${encodeURIComponent(premium.state.context.date)}&pax=${premium.state.context.pax}#reservar`;
        if (premium.state.currency === 'EUR') action.title = lang === 'en' ? 'EUR prices are indicative. The UTV checkout uses Peruvian soles (PEN).' : 'Los importes en EUR son referenciales. La reserva UTV se completa en soles peruanos (PEN).';
        else action.removeAttribute('title');
      } else {
        action.href = '#destinos';
        action.removeAttribute('title');
      }

      document.querySelectorAll('[data-territory]').forEach(button => {
        const selected = button.dataset.territory === territory.id;
        button.classList.toggle('selected', selected);
        button.setAttribute('aria-pressed', String(selected));
      });

      if (changed) { shown = current; showSlide(current); }
      syncVideos();
      autoplay.restart();
    };

    // Presentación automática: se detiene fuera de pantalla, con la pestaña oculta, con foco o puntero en los controles y a petición.
    const autoplay = (() => {
      let timer = null, startedAt = 0, remaining = SLIDE_DURATION, visible = true, hovering = false, focused = false, userPaused = false;
      const enabled = () => !reducedMotion.matches && ready;
      const blocked = () => !visible || hovering || focused || userPaused || document.hidden || Boolean(document.querySelector('dialog[open]'));
      const clear = () => { if (timer) window.clearTimeout(timer); timer = null; };
      const tick = () => { clear(); remaining = SLIDE_DURATION; current = (current + 1) % territories.length; render(); };
      const update = () => {
        hero.classList.toggle('is-autoplay', enabled() && !userPaused);
        hero.style.setProperty('--slide-duration', `${SLIDE_DURATION}ms`);
        if (autoplayButton) {
          autoplayButton.hidden = reducedMotion.matches;
          const key = userPaused ? 'heroPlay' : 'heroPause';
          autoplayButton.dataset.i18nAria = key;
          autoplayButton.setAttribute('aria-label', (window.PremiumI18n?.[language()] || {})[key] || key);
          autoplayButton.setAttribute('aria-pressed', String(userPaused));
          autoplayButton.querySelector('use')?.setAttribute('href', userPaused ? '#i-play' : '#i-pause');
        }
        if (!enabled() || blocked()) {
          if (timer) { remaining = Math.max(400, remaining - (Date.now() - startedAt)); clear(); }
          hero.classList.toggle('is-paused', enabled() && !userPaused);
          return;
        }
        hero.classList.remove('is-paused');
        if (!timer) { startedAt = Date.now(); timer = window.setTimeout(tick, remaining); }
      };
      return {
        update,
        restart() { clear(); remaining = SLIDE_DURATION; update(); },
        stop() { userPaused = true; clear(); update(); },
        toggle() { userPaused = !userPaused; if (!userPaused) remaining = SLIDE_DURATION; clear(); update(); },
        set(key, value) { ({ visible: () => { visible = value; }, hovering: () => { hovering = value; }, focused: () => { focused = value; } })[key]?.(); update(); },
      };
    })();

    const choose = index => {
      if (index < 0 || index >= territories.length) return;
      current = index;
      premium.state.context.destination = territories[current].id;
      lastDestination = premium.state.context.destination;
      try { window.localStorage.setItem('premium_context', JSON.stringify(premium.state.context)); } catch {}
      const contactDestination = document.getElementById('cf-destination');
      if (contactDestination) contactDestination.value = territories[current].id;
      premium.renderCatalog();
      render();
    };

    const sync = () => {
      const destination = premium.state.context.destination;
      if (destination === lastDestination) { render({ animate: false }); return; }
      lastDestination = destination;
      const next = territories.findIndex(entry => entry.id === destination);
      if (next >= 0) current = next;
      render();
    };

    document.getElementById('cover-next')?.addEventListener('click', () => { autoplay.stop(); choose((current + 1) % territories.length); });
    autoplayButton?.addEventListener('click', () => autoplay.toggle());
    action.addEventListener('click', event => {
      if (territories[current].id !== 'huacachina') { event.preventDefault(); premium.openDetail(territories[current].item); }
    });
    document.querySelectorAll('[data-territory]').forEach(button => button.addEventListener('click', () => { autoplay.stop(); choose(territories.findIndex(entry => entry.id === button.dataset.territory)); }));
    document.getElementById('language-select')?.addEventListener('change', () => render({ animate: false }));
    document.getElementById('currency-select')?.addEventListener('change', () => render({ animate: false }));
    document.getElementById('search-form')?.addEventListener('submit', sync);

    const controls = hero.querySelector('.hero-dests');
    controls?.addEventListener('pointerenter', () => autoplay.set('hovering', true));
    controls?.addEventListener('pointerleave', () => autoplay.set('hovering', false));
    hero.addEventListener('focusin', () => autoplay.set('focused', true));
    hero.addEventListener('focusout', event => { if (!hero.contains(event.relatedTarget)) autoplay.set('focused', false); });
    document.addEventListener('visibilitychange', () => autoplay.update());
    document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('close', () => autoplay.update()));
    document.addEventListener('click', () => window.setTimeout(() => autoplay.update(), 0));
    if ('IntersectionObserver' in window) new IntersectionObserver(entries => { heroVisible = entries[0].isIntersecting; syncVideos(); autoplay.set('visible', heroVisible); }, { threshold: 0.35 }).observe(hero);
    document.addEventListener('visibilitychange', syncVideos);
    wideScreen.addEventListener?.('change', () => render({ animate: false }));
    reducedMotion.addEventListener?.('change', () => autoplay.update());

    const grid = document.getElementById('tour-grid');
    if (grid && window.MutationObserver) new window.MutationObserver(sync).observe(grid, { childList: true });
    document.addEventListener('change', event => { if (event.target.matches('#plan-date, #plan-pax')) render({ animate: false }); });

    let resizeFrame = 0;
    window.addEventListener('resize', () => { cancelAnimationFrame(resizeFrame); resizeFrame = requestAnimationFrame(fitPlace); });
    document.fonts?.ready.then(fitPlace);
    document.addEventListener('bgv:ready', () => { ready = true; animateTitle(); autoplay.restart(); }, { once: true });

    const firstSlide = slides.find(entry => entry.dataset.slide === territories[current].id);
    firstSlide?.classList.add('is-active', 'is-first');
    slides.forEach(entry => { if (entry !== firstSlide) entry.classList.remove('is-active', 'is-first'); });
    const firstImage = prepareSlide(current).image;
    if (firstImage && current !== 0) firstImage.setAttribute('fetchpriority', 'high');
    shown = current;
    prepareSlide((current + 1) % territories.length);
    render({ animate: false });
    if (ready) animateTitle();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
