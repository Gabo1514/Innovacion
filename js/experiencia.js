// Efectos de la portada "Experiencia": introducción, arena, reloj y atardecer de Ica,
// cinta, manifiesto, contadores, historia UTV horizontal, mapa, parallax y microinteracciones.
(() => {
  'use strict';

  const root = document.documentElement;
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const premium = () => window.Premium;
  const language = () => premium()?.state.language === 'en' ? 'en' : 'es';
  const t = key => (window.PremiumI18n?.[language()] || {})[key] ?? (window.PremiumI18n?.es || {})[key] ?? key;
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const imageURL = (key, width) => {
    const entry = window.PremiumCatalog?.images?.[key];
    const source = typeof entry === 'string' ? entry : entry?.url || entry?.src || '';
    return width && /^https:\/\/images\.unsplash\.com\//.test(source) ? source.replace(/([?&])w=\d+/, `$1w=${width}`) : source;
  };
  const safely = (name, task) => { try { task(); } catch (error) { console.warn(`[experiencia] ${name}`, error); } };

  /* ---------- Planificador de cuadros: un único bucle para todo lo que depende del scroll ---------- */
  const frameTasks = new Set();
  let frameQueued = false;
  const requestFrame = () => {
    if (frameQueued) return;
    frameQueued = true;
    requestAnimationFrame(() => { frameQueued = false; frameTasks.forEach(task => safely('frame', task)); });
  };
  window.addEventListener('scroll', requestFrame, { passive: true });
  window.addEventListener('resize', requestFrame);

  /* ---------- Introducción ---------- */
  function intro() {
    const preloader = $('#preloader');
    const finish = () => {
      root.classList.add('is-ready');
      root.classList.remove('intro');
      try { sessionStorage.setItem('bgv_intro', '1'); } catch {}
      document.dispatchEvent(new CustomEvent('bgv:ready'));
    };
    if (!root.classList.contains('intro') || !preloader) return;
    const counter = $('#preloader-count');
    const started = performance.now(), duration = 1700;
    const step = now => {
      const progress = clamp((now - started) / duration);
      if (counter) counter.textContent = String(Math.round((1 - Math.pow(1 - progress, 3)) * 100)).padStart(2, '0');
      if (progress < 1) { requestAnimationFrame(step); return; }
      preloader.classList.add('is-done');
      window.setTimeout(finish, 380);
      window.setTimeout(() => preloader.remove(), 1200);
    };
    requestAnimationFrame(step);
  }

  /* ---------- Progreso de lectura y encabezado que se oculta al bajar ---------- */
  function chrome() {
    const bar = $('#scroll-progress'), head = $('#head');
    let lastY = window.scrollY;
    frameTasks.add(() => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (bar) bar.style.transform = `scaleX(${max > 0 ? clamp(window.scrollY / max) : 0})`;
      if (!head) return;
      const y = window.scrollY, delta = y - lastY;
      const keep = head.classList.contains('menu-open') || head.contains(document.activeElement) || y < window.innerHeight * 0.7;
      if (keep || delta < -4) head.classList.remove('head-hidden');
      else if (delta > 6) head.classList.add('head-hidden');
      lastY = y;
    });
    head?.addEventListener('focusin', () => head.classList.remove('head-hidden'));
  }

  /* ---------- Hora en Ica y atardecer real en Huacachina ---------- */
  function sunsetUTC(date, latitude, longitude) {
    // Ecuación del amanecer (NOAA simplificada). Devuelve milisegundos UTC del ocaso.
    const rad = Math.PI / 180;
    const julianDay = date.getTime() / 86400000 + 2440587.5;
    const n = Math.ceil(julianDay - 2451545 + 0.0008);
    const meanNoon = n - longitude / 360;
    const anomaly = (357.5291 + 0.98560028 * meanNoon) % 360;
    const center = 1.9148 * Math.sin(anomaly * rad) + 0.02 * Math.sin(2 * anomaly * rad) + 0.0003 * Math.sin(3 * anomaly * rad);
    const ecliptic = (anomaly + center + 180 + 102.9372) % 360;
    const transit = 2451545 + meanNoon + 0.0053 * Math.sin(anomaly * rad) - 0.0069 * Math.sin(2 * ecliptic * rad);
    const declination = Math.asin(Math.sin(ecliptic * rad) * Math.sin(23.4397 * rad));
    const hourAngle = Math.acos((Math.sin(-0.833 * rad) - Math.sin(latitude * rad) * Math.sin(declination)) / (Math.cos(latitude * rad) * Math.cos(declination)));
    return (transit + hourAngle / (2 * Math.PI) - 2440587.5) * 86400000;
  }

  function liveInfo() {
    const clock = $('#lima-clock'), sunset = $('#sunset-time');
    if (!clock && !sunset) return;
    const format = value => new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Lima' }).format(value);
    const update = () => {
      const now = new Date();
      if (clock) clock.textContent = format(now);
      if (sunset) sunset.textContent = format(new Date(sunsetUTC(now, -14.087, -75.763)));
    };
    update();
    window.setInterval(update, 15000);
  }

  /* ---------- Arena en suspensión sobre la portada ---------- */
  function sand() {
    const canvas = $('#hero-sand'), hero = $('#reserva');
    if (!canvas || !hero || reducedMotion.matches) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    let width = 0, height = 0, ratio = 1, particles = [], running = false, visible = true, frame = 0;
    const pointer = { x: -9999, y: -9999 };
    const spawn = (anywhere = true) => ({
      x: anywhere ? Math.random() * width : width + Math.random() * 60,
      y: height * (0.25 + Math.random() * 0.75),
      r: Math.random() * 1.5 + 0.35,
      vx: -(Math.random() * 1.1 + 0.25),
      vy: (Math.random() - 0.6) * 0.25,
      a: Math.random() * 0.45 + 0.12,
      phase: Math.random() * Math.PI * 2,
    });
    const resize = () => {
      const rect = hero.getBoundingClientRect();
      ratio = 1; // Partículas pequeñas y difusas: no necesitan alta densidad y así se ahorra trabajo de la GPU.
      width = rect.width; height = rect.height;
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const count = Math.min(140, Math.round((width * height) / 11000));
      particles = Array.from({ length: count }, () => spawn());
    };
    const draw = () => {
      if (!running) return;
      context.clearRect(0, 0, width, height);
      const gust = 1 + Math.sin(performance.now() / 2600) * 0.35;
      for (const particle of particles) {
        particle.phase += 0.02;
        const dx = particle.x - pointer.x, dy = particle.y - pointer.y, distance = Math.hypot(dx, dy);
        if (distance < 140) { const force = (140 - distance) / 140; particle.x += (dx / (distance || 1)) * force * 4; particle.y += (dy / (distance || 1)) * force * 4; }
        particle.x += particle.vx * gust;
        particle.y += particle.vy + Math.sin(particle.phase) * 0.18;
        if (particle.x < -20 || particle.y < -20 || particle.y > height + 20) Object.assign(particle, spawn(false));
        context.beginPath();
        context.fillStyle = `rgba(255, 228, 186, ${particle.a})`;
        context.ellipse(particle.x, particle.y, particle.r * (1 + Math.abs(particle.vx) * 0.8), particle.r, -0.12, 0, Math.PI * 2);
        context.fill();
      }
      frame = requestAnimationFrame(draw);
    };
    const toggle = () => {
      const shouldRun = visible && !document.hidden && !reducedMotion.matches;
      if (shouldRun && !running) { running = true; frame = requestAnimationFrame(draw); }
      if (!shouldRun && running) { running = false; cancelAnimationFrame(frame); }
    };
    resize();
    window.addEventListener('resize', () => { resize(); });
    hero.addEventListener('pointermove', event => { const rect = canvas.getBoundingClientRect(); pointer.x = event.clientX - rect.left; pointer.y = event.clientY - rect.top; });
    hero.addEventListener('pointerleave', () => { pointer.x = pointer.y = -9999; });
    document.addEventListener('visibilitychange', toggle);
    if ('IntersectionObserver' in window) new IntersectionObserver(entries => { visible = entries[0].isIntersecting; toggle(); }).observe(hero);
    toggle();
  }

  /* ---------- Cinta de destinos con inercia del scroll ---------- */
  function marquee() {
    $$('.mq-photo[data-bg]').forEach(element => { const url = imageURL(element.dataset.bg, 500); if (url) element.style.backgroundImage = `url("${url}")`; });
    const track = $('.marquee-track'), group = $('.marquee-group');
    if (!track || !group || reducedMotion.matches) return;
    let offset = 0, velocity = 0, lastY = window.scrollY, visible = true, running = false;
    const loop = () => {
      if (!visible) { running = false; return; }
      const delta = window.scrollY - lastY; lastY = window.scrollY;
      velocity += (delta * 0.35 - velocity) * 0.08;
      const width = group.offsetWidth || 1;
      offset -= 0.9 + Math.abs(velocity);
      if (offset <= -width) offset += width;
      track.style.transform = `translate3d(${offset}px, 0, 0) skewX(${clamp(-velocity * 0.35, -10, 10)}deg)`;
      requestAnimationFrame(loop);
    };
    const start = () => { if (!running && visible) { running = true; lastY = window.scrollY; requestAnimationFrame(loop); } };
    if ('IntersectionObserver' in window) new IntersectionObserver(entries => { visible = entries[0].isIntersecting; start(); }).observe(track);
    start();
  }

  /* ---------- Manifiesto que se ilumina palabra a palabra ---------- */
  function manifesto() {
    const element = $('[data-split-key]');
    if (!element) return;
    const accents = new Set(['desierto', 'mar', 'pampa', 'desert', 'sea', 'plains', 'luz', 'light']);
    let words = [];
    const split = () => {
      const text = t(element.dataset.splitKey) || element.textContent;
      element.innerHTML = text.split(/\s+/).filter(Boolean).map(word => `<span class="w${accents.has(word.toLowerCase().replace(/[^\p{L}]/gu, '')) ? ' w-accent' : ''}">${escapeHTML(word)}</span>`).join(' ');
      words = [...element.querySelectorAll('.w')];
      requestFrame();
    };
    split();
    $('#language-select')?.addEventListener('change', split);
    if (reducedMotion.matches) { words.forEach(word => word.classList.add('lit')); return; }
    frameTasks.add(() => {
      const rect = element.getBoundingClientRect();
      const progress = clamp((window.innerHeight * 0.88 - rect.top) / (rect.height + window.innerHeight * 0.3));
      const lit = Math.round(progress * words.length * 1.1);
      words.forEach((word, index) => word.classList.toggle('lit', index < lit));
    });
  }

  /* ---------- Contadores ---------- */
  function counters() {
    const elements = $$('[data-count]');
    const catalog = window.PremiumCatalog || {};
    elements.forEach(element => {
      if (element.dataset.countSource === 'catalog') element.dataset.count = String((catalog.tours?.length || 0) + (catalog.packages?.length || 0));
      element.textContent = element.dataset.count;
    });
    if (reducedMotion.matches || !('IntersectionObserver' in window)) return;
    const run = element => {
      const target = Number(element.dataset.count), from = Number(element.dataset.countFrom || 0), started = performance.now(), duration = 1800;
      const step = now => {
        const progress = clamp((now - started) / duration), eased = 1 - Math.pow(2, -10 * progress);
        element.textContent = String(Math.round(from + (target - from) * (progress === 1 ? 1 : eased)));
        if (progress < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { observer.unobserve(entry.target); run(entry.target); } }), { threshold: 0.6 });
    elements.forEach(element => { element.textContent = element.dataset.countFrom || '0'; observer.observe(element); });
  }

  /* ---------- Historia UTV: scroll vertical convertido en recorrido horizontal ---------- */
  function story() {
    const section = $('#experiencias'), track = $('#story-track'), viewport = $('.story-viewport');
    if (!section || !track) return;
    const panels = [...track.children], progressBar = $('#story-progress'), label = $('#story-step');
    const wide = window.matchMedia('(min-width: 900px) and (min-height: 600px)');
    let distance = 0, pinned = false;
    const measure = () => {
      pinned = wide.matches && !reducedMotion.matches;
      section.classList.toggle('is-pinned', pinned);
      if (!pinned) { track.style.transform = ''; section.style.removeProperty('--story-height'); return; }
      distance = Math.max(0, track.scrollWidth - window.innerWidth);
      section.style.setProperty('--story-height', `${window.innerHeight + distance}px`);
    };
    const update = () => {
      let progress;
      if (pinned) {
        const top = section.getBoundingClientRect().top;
        progress = distance ? clamp(-top / distance) : 0;
        track.style.transform = `translate3d(${-progress * distance}px, 0, 0)`;
      } else {
        const max = viewport.scrollWidth - viewport.clientWidth;
        progress = max > 0 ? clamp(viewport.scrollLeft / max) : 0;
      }
      progressBar?.style.setProperty('--p', progress.toFixed(4));
      const center = window.innerWidth / 2;
      let nearest = panels[0], best = Infinity;
      panels.forEach(panel => {
        const rect = panel.getBoundingClientRect(), mid = rect.left + rect.width / 2;
        const gap = Math.abs(mid - center);
        if (gap < best) { best = gap; nearest = panel; }
        panel.style.setProperty('--shift', `${clamp((mid - center) / window.innerWidth, -1, 1) * -36}px`);
      });
      const step = nearest.dataset.step || (nearest.classList.contains('story-cta') ? '4' : '1');
      if (label) label.textContent = `0${step} / 04`;
    };
    measure();
    frameTasks.add(update);
    viewport?.addEventListener('scroll', requestFrame, { passive: true });
    window.addEventListener('resize', () => { measure(); requestFrame(); });
    track.querySelectorAll('img').forEach(image => image.addEventListener('load', () => { measure(); requestFrame(); }, { once: true }));
    document.fonts?.ready.then(() => { measure(); requestFrame(); });
    reducedMotion.addEventListener?.('change', () => { measure(); requestFrame(); });
  }

  /* ---------- Mapa del territorio ---------- */
  const places = {
    huacachina: { n: '01', tour: 'utv-huacachina', image: 'utv', km: '≈ 5 km', time: '10 min', coords: { es: '14°05′S · 75°46′O', en: '14°05′S · 75°46′W' } },
    paracas: { n: '02', tour: 'ballestas-paracas', image: 'paracas', km: '≈ 75 km', time: '1 h 15 min', coords: { es: '13°50′S · 76°15′O', en: '13°50′S · 76°15′W' } },
    nasca: { n: '03', tour: 'lineas-nasca', image: 'nasca', km: '≈ 145 km', time: '2 h 30 min', coords: { es: '14°50′S · 74°56′O', en: '14°50′S · 74°56′W' } },
    ica: { n: '04', tour: 'ruta-pisco', image: 'introMain', km: '0 km', time: '', coords: { es: '14°04′S · 75°44′O', en: '14°04′S · 75°44′W' } },
  };

  function territoryMap() {
    const map = $('#map'), card = $('#map-card');
    if (!map || !card) return;
    let active = 'paracas';
    const select = (id, { focusCard = false } = {}) => {
      const place = places[id]; if (!place) return;
      active = id;
      $$('.map-place').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mapPlace === id)));
      map.querySelectorAll('.map-pin').forEach(pin => pin.classList.toggle('is-active', pin.dataset.mapPlace === id));
      const name = id === 'ica' ? 'Ica' : id.charAt(0).toUpperCase() + id.slice(1);
      $('#map-card-title').textContent = name;
      $('#map-card-kicker').textContent = `${place.n} · ${t(`territory${id}`)}`;
      $('#map-card-distance').textContent = id === 'ica' ? t('mapBase') : `${place.km} · ${place.time}`;
      $('#map-card-coords').textContent = place.coords[language()];
      const image = $('#map-card-image'), url = imageURL(place.image, 700);
      if (image && url && image.getAttribute('src') !== url) { image.style.opacity = '0'; image.onload = () => { image.style.opacity = '1'; }; image.src = url; }
      $('#map-card-action').dataset.detail = place.tour;
      card.classList.remove('is-changing'); void card.offsetWidth; card.classList.add('is-changing');
      if (focusCard) $('#map-card-action')?.focus({ preventScroll: true });
    };
    $$('.map-place').forEach(button => button.addEventListener('click', () => select(button.dataset.mapPlace)));
    map.querySelectorAll('.map-pin').forEach(pin => pin.addEventListener('click', () => select(pin.dataset.mapPlace)));
    $$('[data-map-distance]').forEach(element => { const place = places[element.dataset.mapDistance]; if (place) element.textContent = place.km; });
    $('#language-select')?.addEventListener('change', () => select(active));
    select(active);

    // La ruta Lima → Pisco → Ica → Nasca se dibuja al recorrer la sección.
    const base = map.querySelector('.map-route-base'), traveller = $('#map-traveller'), section = $('#mapa');
    const total = base?.getTotalLength?.() || 0;
    if (reducedMotion.matches) { map.style.setProperty('--route', '0'); if (traveller && total) { const end = base.getPointAtLength(total); traveller.setAttribute('cx', end.x); traveller.setAttribute('cy', end.y); } return; }
    frameTasks.add(() => {
      if (!section || !total) return;
      const rect = section.getBoundingClientRect();
      const progress = clamp((window.innerHeight * 0.9 - rect.top) / (rect.height * 0.85));
      map.style.setProperty('--route', (1 - progress).toFixed(4));
      const point = base.getPointAtLength(progress * total);
      traveller?.setAttribute('cx', point.x.toFixed(1));
      traveller?.setAttribute('cy', point.y.toFixed(1));
    });
  }

  /* ---------- Parallax de fotografías ---------- */
  function parallax() {
    if (reducedMotion.matches) return;
    const items = $$('.parallax').map(element => ({ element, image: element.querySelector('img'), speed: Number(element.dataset.speed) || 0.1 }));
    frameTasks.add(() => {
      items.forEach(({ element, image, speed }) => {
        const rect = element.getBoundingClientRect();
        if (rect.bottom < -100 || rect.top > window.innerHeight + 100 || !image) return;
        const slack = Math.max(0, (image.offsetHeight - element.offsetHeight) / 2);
        const offset = clamp((rect.top + rect.height / 2 - window.innerHeight / 2) * speed, -slack, slack);
        element.style.setProperty('--parallax', `${(-slack + offset).toFixed(1)}px`);
      });
    });
  }

  /* ---------- Letras del pie que emergen ---------- */
  function wordmark() {
    const element = $('.footer-wordmark');
    if (!element) return;
    const letters = [...element.children];
    const fit = () => {
      element.style.setProperty('--wordmark-size', '100px');
      const width = letters.reduce((sum, letter) => sum + letter.getBoundingClientRect().width, 0) || 1;
      const available = element.clientWidth - parseFloat(getComputedStyle(element).paddingLeft) * 2;
      element.style.setProperty('--wordmark-size', `${(100 * available * 0.98 / width).toFixed(1)}px`);
    };
    fit();
    window.addEventListener('resize', fit);
    document.fonts?.ready.then(fit);
    if (reducedMotion.matches) return;
    frameTasks.add(() => {
      const rect = element.getBoundingClientRect();
      if (rect.top > window.innerHeight + 50) return;
      const progress = clamp((window.innerHeight - rect.top) / (rect.height * 0.95), 0, 1.2);
      letters.forEach((letter, index) => letter.style.setProperty('--wp', clamp(progress * 1.6 - index * 0.06).toFixed(3)));
    });
  }

  /* ---------- Tarjetas con inclinación y foco de luz ---------- */
  function cards() {
    if (!finePointer.matches || reducedMotion.matches) return;
    const reset = card => { card.classList.remove('is-tilting'); card.style.removeProperty('--rx'); card.style.removeProperty('--ry'); };
    ['#tour-grid', '#package-grid'].forEach(selector => {
      const grid = $(selector); if (!grid) return;
      grid.addEventListener('pointermove', event => {
        const card = event.target.closest('.route-card'); if (!card) return;
        const rect = card.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width, y = (event.clientY - rect.top) / rect.height;
        card.classList.add('is-tilting');
        card.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
        card.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
        card.style.setProperty('--rx', `${((0.5 - y) * 4).toFixed(2)}deg`);
        card.style.setProperty('--ry', `${((x - 0.5) * 5).toFixed(2)}deg`);
      });
      grid.addEventListener('pointerout', event => {
        const card = event.target.closest('.route-card');
        if (card && !card.contains(event.relatedTarget)) reset(card);
      });
    });
  }

  /* ---------- Botones magnéticos ---------- */
  function magnetic() {
    if (!finePointer.matches || reducedMotion.matches) return;
    $$('.magnetic').forEach(element => {
      element.addEventListener('pointermove', event => {
        const rect = element.getBoundingClientRect();
        const x = event.clientX - rect.left - rect.width / 2, y = event.clientY - rect.top - rect.height / 2;
        element.style.transform = `translate(${(x * 0.22).toFixed(1)}px, ${(y * 0.32).toFixed(1)}px)`;
      });
      element.addEventListener('pointerleave', () => { element.style.transform = ''; });
    });
  }

  /* ---------- Burbuja "Ver" sobre las fotografías ---------- */
  function cursorBubble() {
    const bubble = $('#cursor-bubble');
    if (!bubble || !finePointer.matches || reducedMotion.matches) return;
    let x = -200, y = -200, targetX = -200, targetY = -200, on = false, running = false;
    const loop = () => {
      x += (targetX - x) * 0.22; y += (targetY - y) * 0.22;
      bubble.style.setProperty('--cx', `${x.toFixed(1)}px`);
      bubble.style.setProperty('--cy', `${y.toFixed(1)}px`);
      if (on || Math.abs(targetX - x) > 0.5) requestAnimationFrame(loop); else running = false;
    };
    document.addEventListener('pointermove', event => {
      targetX = event.clientX; targetY = event.clientY;
      const over = Boolean(event.target.closest?.('[data-cursor]')) && !event.target.closest('.save-btn, .chip, button:not(.route-image-button)');
      if (over !== on) { on = over; bubble.classList.toggle('is-on', on); }
      if (on && x === -200) { x = targetX; y = targetY; }
      if (!running) { running = true; requestAnimationFrame(loop); }
    }, { passive: true });
    document.addEventListener('pointerleave', () => { on = false; bubble.classList.remove('is-on'); });
    $('#package-grid')?.addEventListener('click', event => {
      const media = event.target.closest('.ticket-media');
      if (media && !event.target.closest('button')) premium()?.openDetail(media.closest('.ticket')?.dataset.tour);
    });
  }

  /* ---------- Más experiencias publicadas por la agencia ---------- */
  const uploads = 'https://buganvillatours.com/wp-content/uploads/';
  const moreTours = [
    { region: 'ica', es: 'Cañón de los Perdidos', en: 'Cañón de los Perdidos (Lost Canyon)', image: '2024/05/Canon-de-los-Perdidosclientes-400x284.jpg', page: 'canon-de-los-perdidos' },
    { region: 'nasca', es: 'Tour Museo Antonini', en: 'Antonini Museum tour', image: '2020/03/Museo-Antonini-Nasca-400x284.jpg', page: 'tour-museo-antonini' },
    { region: 'ica', es: 'Tambo Colorado desde Ica', en: 'Tambo Colorado from Ica', image: '2017/08/Experiencia-Tambo-Colorado-400x284.jpg', page: 'tambo-colorado-desde-ica' },
    { region: 'nasca', es: 'Miradores de Nasca desde Ica', en: 'Nasca viewpoints from Ica', image: '2020/02/Mirador-Met%C3%A1lico-400x284.jpg', page: 'full-day-solo-miradores-en-nasca-desde-ica' },
    { region: 'paracas', es: 'Diversión marina y cultural en Paracas', en: 'Marine and cultural fun in Paracas', image: '2018/05/DIVERSI%C3%93N-MARINA-Y-CULTURAL-EN-PARACAS2-400x284.jpg', page: 'diversion-marina-y-cultural-en-paracas' },
    { region: 'paracas', es: 'Atardecer mágico en Paracas', en: 'Magical sunset in Paracas', image: '2018/05/ATARDECER-M%C3%81GICO2-400x284.jpg', page: 'atardecer-magico-en-paracas' },
    { region: 'chincha', es: 'Full day Lunahuaná desde Chincha', en: 'Lunahuaná day trip from Chincha', image: '2019/01/Fotos-productoslunahuana-400x284.jpg', page: 'full-day-lunahuana-desde-chincha' },
    { region: 'nasca', es: 'Cementerio de Chauchilla', en: 'Chauchilla Cemetery', image: '2017/08/Chauchilla-Nasca-400x284.jpg', page: 'tour-cementerio-chauchilla' },
    { region: 'chincha', es: 'Islas Ballestas desde Chincha', en: 'Ballestas Islands from Chincha', image: '2018/04/Tour-Islas-Ballestas-Chincha-400x284.jpg', page: 'tour-islas-ballestas-chincha' },
    { region: 'ica', es: 'Museo Científico Javier Cabrera', en: 'Javier Cabrera Scientific Museum', image: '2018/04/Vision-de-la-tierra-hace-millones-de-a%C3%B1os-400x284.jpg', page: 'museo-cientifico-javier-cabrera' },
    { region: 'nasca', es: 'Tour Cahuachi', en: 'Cahuachi tour', image: '2017/08/Tours-Cahuachi-Nasca-400x284.jpg', page: 'tour-cahuachi' },
    { region: 'chincha', es: 'Reserva de Paracas desde Chincha', en: 'Paracas Reserve from Chincha', image: '2018/04/paracas-desde-chincha-400x284.jpg', page: 'tour-reserva-nacional-de-paracas-desde-chincha' },
    { region: 'ica', es: 'City tour Ica tradicional', en: 'Traditional Ica city tour', image: '2017/04/City-Tour-Ica-400x284.jpg', page: 'city-tour-ica-tradicional' },
    { region: 'nasca', es: 'Tour arqueológico en Nasca', en: 'Nasca archaeological tour', image: '2017/04/Acueductos-de-Cantayoc-Nasca-400x284.jpg', page: 'tour-arqueologico-nasca-desde-nasca' },
    { region: 'paracas', es: 'Tambo Colorado desde Pisco', en: 'Tambo Colorado from Pisco', image: '2017/03/Tambo-Colorado-400x284.jpg', page: 'tambo-colorado-pisco' },
    { region: 'ica', es: 'Tour agrícola desde Lima', en: 'Farm tour from Lima', image: '2018/05/TOURAGRI3-400x284.jpg', page: 'tour-agricola-desde-lima' },
    { region: 'chincha', es: 'Ruta del Pisco Chincha', en: 'Chincha pisco route', image: '2017/03/Ruta-del-Pisco-Chincha-400x284.jpg', page: 'ruta-del-pisco-chincha' },
    { region: 'chincha', es: 'City tour Chincha', en: 'Chincha city tour', image: '2017/03/City-Tour-Chincha-400x284.jpg', page: 'city-tour-chincha' },
  ];
  const regionName = { ica: 'Ica', paracas: 'Paracas', nasca: 'Nasca', chincha: 'Chincha' };
  const videoAllowed = () => !reducedMotion.matches && !navigator.connection?.saveData && !/2g$/.test(navigator.connection?.effectiveType || '');

  function moreExperiences() {
    const rail = $('#more-rail');
    if (!rail) return;
    let filter = 'all';
    const glampingVideo = `${uploads}2024/06/Glamping-En-El-Desierto-De-Ica.mp4`;
    const render = () => {
      const lang = language();
      const feature = `<article class="more-card more-feature" data-region="ica">
        <figure class="more-media"><video muted loop playsinline preload="metadata" src="${glampingVideo}#t=2.5" aria-hidden="true"></video><span class="chip chip-live"><i aria-hidden="true"></i>${escapeHTML(t('moreFeatured'))}</span></figure>
        <div class="more-body"><p class="more-region">Ica · ${escapeHTML(t('videoCredit'))}</p><h3>${escapeHTML(t('glampingTitle'))}</h3><p class="more-copy">${escapeHTML(t('glampingCopy'))}</p>
          <div class="more-actions"><button type="button" class="btn btn-glow btn-sm" data-more-ask="${escapeHTML(t('glampingTitle'))}" data-more-dest="ica">${escapeHTML(t('moreAsk'))}<svg class="ico" aria-hidden="true"><use href="#i-arrow"/></svg></button></div></div>
      </article>`;
      rail.innerHTML = feature + moreTours.map(tour => `<article class="more-card" data-region="${tour.region}">
        <figure class="more-media"><img src="${uploads}${tour.image}" alt="${escapeHTML(tour[lang])}" width="400" height="284" loading="lazy" decoding="async"><span class="chip chip-glass">${regionName[tour.region]}</span></figure>
        <div class="more-body"><h3>${escapeHTML(tour[lang])}</h3><p class="more-region">${escapeHTML(t('moreOnRequest'))}</p>
          <div class="more-actions"><button type="button" class="btn btn-glow btn-sm" data-more-ask="${escapeHTML(tour[lang])}" data-more-dest="${tour.region === 'chincha' ? 'all' : tour.region}">${escapeHTML(t('moreAsk'))}</button><a class="link-button" href="https://buganvillatours.com/project/${tour.page}/" target="_blank" rel="noopener noreferrer">${escapeHTML(t('moreSource'))}<svg class="ico" aria-hidden="true"><use href="#i-diagonal"/></svg></a></div></div>
      </article>`).join('');
      applyFilter();
      setupVideo();
    };
    const applyFilter = () => {
      rail.querySelectorAll('.more-card').forEach(card => { card.hidden = filter !== 'all' && card.dataset.region !== filter; });
      $$('[data-more-filter]').forEach(button => { const on = button.dataset.moreFilter === filter; button.classList.toggle('active', on); button.setAttribute('aria-pressed', String(on)); });
      rail.scrollTo({ left: 0, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    };
    const setupVideo = () => {
      const video = rail.querySelector('.more-feature video');
      if (!video || !videoAllowed() || !('IntersectionObserver' in window)) return;
      new IntersectionObserver(entries => entries.forEach(entry => {
        if (entry.isIntersecting) { video.preload = 'auto'; video.play().catch(() => {}); } else video.pause();
      }), { threshold: 0.4 }).observe(video);
    };
    $$('[data-more-filter]').forEach(button => button.addEventListener('click', () => { filter = button.dataset.moreFilter; applyFilter(); }));
    const page = direction => rail.scrollBy({ left: direction * Math.max(280, rail.clientWidth * 0.8), behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    $('#more-prev')?.addEventListener('click', () => page(-1));
    $('#more-next')?.addEventListener('click', () => page(1));

    // Arrastrar para desplazar con el mouse, sin bloquear los clics.
    let drag = null;
    rail.addEventListener('pointerdown', event => { if (event.pointerType !== 'mouse' || event.button !== 0) return; drag = { x: event.clientX, left: rail.scrollLeft, moved: false }; });
    window.addEventListener('pointermove', event => {
      if (!drag) return;
      const dx = event.clientX - drag.x;
      if (Math.abs(dx) > 6) { drag.moved = true; rail.classList.add('is-dragging'); }
      if (drag.moved) rail.scrollLeft = drag.left - dx;
    });
    window.addEventListener('pointerup', () => { if (drag?.moved) window.setTimeout(() => rail.classList.remove('is-dragging'), 0); drag = null; });
    rail.addEventListener('click', event => {
      if (rail.classList.contains('is-dragging')) { event.preventDefault(); event.stopPropagation(); return; }
      const ask = event.target.closest('[data-more-ask]');
      if (!ask) return;
      const destination = $('#cf-destination'), message = $('#cf-message');
      if (destination) destination.value = ask.dataset.moreDest;
      if (message) message.value = `${t('moreInterest')}${ask.dataset.moreAsk}. `;
      $('#contacto')?.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'start' });
      window.setTimeout(() => $('#cf-name')?.focus({ preventScroll: true }), reducedMotion.matches ? 0 : 700);
    }, true);
    rail.addEventListener('dragstart', event => event.preventDefault());
    $('#language-select')?.addEventListener('change', render);
    render();
  }

  /* ---------- Reseñas con transición ---------- */
  function reviews() {
    const quote = $('#review-summary');
    if (!quote || !window.MutationObserver) return;
    new MutationObserver(() => { quote.classList.remove('is-changing'); void quote.offsetWidth; quote.classList.add('is-changing'); }).observe(quote, { childList: true, characterData: true, subtree: true });
  }

  const start = () => {
    safely('intro', intro);
    safely('chrome', chrome);
    safely('liveInfo', liveInfo);
    safely('sand', sand);
    safely('marquee', marquee);
    safely('manifesto', manifesto);
    safely('counters', counters);
    safely('story', story);
    safely('territoryMap', territoryMap);
    safely('parallax', parallax);
    safely('wordmark', wordmark);
    safely('cards', cards);
    safely('magnetic', magnetic);
    safely('cursorBubble', cursorBubble);
    safely('reviews', reviews);
    safely('moreExperiences', moreExperiences);
    if (root.classList.contains('intro') && !$('#preloader')) { root.classList.remove('intro'); document.dispatchEvent(new CustomEvent('bgv:ready')); }
    requestFrame();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
