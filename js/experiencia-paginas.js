// Efectos visuales de reserva UTV, "Mi reserva" y panel del operador.
// Solo observa el DOM que generan booking.js, voucher.js y admin.js; no altera su lógica.
(() => {
  'use strict';

  const root = document.documentElement;
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const safely = (name, task) => { try { task(); } catch (error) { console.warn(`[experiencia-paginas] ${name}`, error); } };
  const watch = (element, callback, options = { childList: true, subtree: true, characterData: true, attributes: true }) => {
    if (!element || !window.MutationObserver) return;
    new MutationObserver(callback).observe(element, options);
  };
  if (!reducedMotion.matches) root.classList.add('pg-motion');

  /* ---------- Scroll: barra de progreso y cabecera que se oculta al bajar ---------- */
  function chrome() {
    const bar = $('#page-progress');
    let lastY = window.scrollY, queued = false;
    const update = () => {
      queued = false;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (bar) bar.style.transform = `scaleX(${max > 0 ? clamp(window.scrollY / max) : 0})`;
      const head = $('.site-header');
      if (head) {
        const y = window.scrollY, delta = y - lastY;
        const keep = y < 300 || head.contains(document.activeElement) || $('#nav-links.open');
        if (keep || delta < -4) head.classList.remove('head-hidden');
        else if (delta > 6) head.classList.add('head-hidden');
        lastY = y;
      }
      timelineProgress();
    };
    window.addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }

  /* ---------- Título gigante letra a letra ---------- */
  function giantTitle() {
    const giant = $('.hero-giant');
    if (!giant) return;
    const text = giant.textContent.trim();
    giant.setAttribute('aria-label', text);
    giant.innerHTML = [...text.toUpperCase()].map((character, index) => `<span class="ch" aria-hidden="true" style="--i:${index}">${character}</span>`).join('');
    // Ajusta el tamaño para que el nombre ocupe el ancho del contenedor.
    const fit = () => {
      const available = giant.parentElement.clientWidth;
      giant.style.fontSize = '100px';
      const width = [...giant.children].reduce((sum, letter) => sum + letter.offsetWidth, 0) || 1;
      giant.style.fontSize = `${Math.min(window.innerHeight * 0.3, (100 * available * 0.985) / width).toFixed(1)}px`;
    };
    fit();
    window.addEventListener('resize', fit);
    document.fonts?.ready.then(fit);
  }

  /* ---------- Arena en suspensión ---------- */
  function sand() {
    const canvas = $('#page-sand');
    const host = canvas?.parentElement;
    if (!canvas || !host || reducedMotion.matches) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    let width = 0, height = 0, particles = [], running = false, visible = true, frame = 0;
    const pointer = { x: -9999, y: -9999 };
    const spawn = anywhere => ({ x: anywhere ? Math.random() * width : width + Math.random() * 60, y: height * (0.2 + Math.random() * 0.8), r: Math.random() * 1.5 + 0.35, vx: -(Math.random() * 1.1 + 0.25), vy: (Math.random() - 0.6) * 0.25, a: Math.random() * 0.45 + 0.12, phase: Math.random() * Math.PI * 2 });
    const resize = () => {
      const rect = host.getBoundingClientRect(), ratio = Math.min(2, window.devicePixelRatio || 1);
      width = rect.width; height = rect.height;
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      particles = Array.from({ length: Math.min(180, Math.round((width * height) / 9000)) }, () => spawn(true));
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
      const shouldRun = visible && !document.hidden;
      if (shouldRun && !running) { running = true; frame = requestAnimationFrame(draw); }
      if (!shouldRun && running) { running = false; cancelAnimationFrame(frame); }
    };
    resize();
    window.addEventListener('resize', resize);
    host.addEventListener('pointermove', event => { const rect = canvas.getBoundingClientRect(); pointer.x = event.clientX - rect.left; pointer.y = event.clientY - rect.top; });
    host.addEventListener('pointerleave', () => { pointer.x = pointer.y = -9999; });
    document.addEventListener('visibilitychange', toggle);
    if ('IntersectionObserver' in window) new IntersectionObserver(entries => { visible = entries[0].isIntersecting; toggle(); }).observe(host);
    toggle();
  }

  /* ---------- Botones magnéticos ---------- */
  function magnetic() {
    if (!finePointer.matches || reducedMotion.matches) return;
    $$('.magnetic').forEach(element => {
      element.addEventListener('pointermove', event => {
        const rect = element.getBoundingClientRect();
        element.style.transform = `translate(${((event.clientX - rect.left - rect.width / 2) * 0.22).toFixed(1)}px, ${((event.clientY - rect.top - rect.height / 2) * 0.32).toFixed(1)}px)`;
      });
      element.addEventListener('pointerleave', () => { element.style.transform = ''; });
    });
  }

  /* ---------- Itinerario y ficha técnica que aparecen en cascada ---------- */
  function cascades() {
    const groups = [['#timeline', '.tl-item'], ['#feature-row', '.feature-item']];
    const mark = () => groups.forEach(([selector, child]) => { const host = $(selector); host?.querySelectorAll(child).forEach((item, index) => item.style.setProperty('--d', index)); });
    mark();
    groups.forEach(([selector]) => watch($(selector), mark, { childList: true }));
    if (!('IntersectionObserver' in window) || reducedMotion.matches) { groups.forEach(([selector]) => $(selector)?.classList.add('is-in')); return; }
    const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('is-in'); observer.unobserve(entry.target); } }), { threshold: 0.2 });
    groups.forEach(([selector]) => { const host = $(selector); if (host) observer.observe(host); });
  }

  function timelineProgress() {
    const timeline = $('#timeline');
    if (!timeline || reducedMotion.matches) return;
    const rect = timeline.getBoundingClientRect();
    timeline.style.setProperty('--tl-progress', clamp((window.innerHeight * 0.75 - rect.top) / (rect.height || 1)).toFixed(3));
  }

  /* ---------- Widget de reserva: progreso, precio y rebotes ---------- */
  function bookingWidget() {
    const booking = $('#reservar');
    if (!booking) return;
    const fill = $('#bk-progress-fill'), label = $('#bk-progress-label');
    const update = () => {
      const date = Boolean($('#calendar .cal-day.selected'));
      const slot = Boolean($('#slots .slot.selected'));
      const button = $('#bk-continue');
      const ready = Boolean(button && !button.disabled && date && slot);
      const done = [date, slot, ready, ready];
      const progress = done.filter(Boolean).length / 4;
      if (fill) booking.style.setProperty('--bk-progress', Math.max(0.04, progress).toFixed(3));
      $$('#reservar [data-bk-step]').forEach(step => step.classList.toggle('is-done', done[Number(step.dataset.bkStep) - 1]));
      if (label) label.textContent = !date ? 'Paso 1 de 4 · Elige la fecha' : !slot ? 'Paso 2 de 4 · Elige el turno' : !ready ? 'Paso 3 de 4 · Revisa los pasajeros' : '¡Todo listo! Revisa el total y continúa';
    };
    ['#calendar', '#slots', '#summary'].forEach(selector => watch($(selector), update));
    watch($('#bk-continue'), update, { attributes: true, attributeFilter: ['disabled'] });
    update();

    const heroPrice = $('#hero-price'), from = $('#bk-from');
    const mirror = () => { if (heroPrice && from && from.textContent.trim() && from.textContent.trim() !== '—') heroPrice.textContent = from.textContent.trim(); };
    watch(from, mirror); mirror();

    const bump = element => { if (!element || reducedMotion.matches) return; element.classList.remove('bump'); void element.offsetWidth; element.classList.add('bump'); };
    ['#adult-count', '#child-count'].forEach(selector => watch($(selector), () => bump($(selector)), { childList: true, characterData: true, subtree: true }));
    let lastTotal = '';
    watch($('#summary'), () => { const total = $('#bk-total'); if (total && total.textContent !== lastTotal) { if (lastTotal) bump(total); lastTotal = total.textContent; } }, { childList: true });
  }

  /* ---------- Tarjeta de pago con relieve ---------- */
  function cardPreview() {
    const card = $('.card-preview');
    if (!card || !finePointer.matches || reducedMotion.matches) return;
    const host = card.closest('[data-method-pane]') || card;
    host.addEventListener('pointermove', event => {
      const rect = card.getBoundingClientRect();
      const x = clamp((event.clientX - rect.left) / rect.width), y = clamp((event.clientY - rect.top) / rect.height);
      card.classList.add('is-tilting');
      card.style.setProperty('--cry', `${((x - 0.5) * 16).toFixed(2)}deg`);
      card.style.setProperty('--crx', `${((0.5 - y) * 12).toFixed(2)}deg`);
      card.style.setProperty('--cmx', `${(x * 100).toFixed(1)}%`);
      card.style.setProperty('--cmy', `${(y * 100).toFixed(1)}%`);
    });
    host.addEventListener('pointerleave', () => { card.classList.remove('is-tilting'); ['--cry', '--crx'].forEach(name => card.style.removeProperty(name)); });
  }

  /* ---------- Confeti al confirmar una reserva ---------- */
  function confetti() {
    if (reducedMotion.matches) return;
    const canvas = document.createElement('canvas');
    canvas.className = 'confetti-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    const context = canvas.getContext('2d');
    const colors = ['#0e7a71', '#3fd3c1', '#eab562', '#ffe2a1', '#ff9e45', '#fbf6ee'];
    const burst = () => {
      if (!context) return;
      document.body.append(canvas);
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = window.innerWidth * ratio; canvas.height = window.innerHeight * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const pieces = Array.from({ length: 170 }, () => ({
        x: window.innerWidth / 2 + (Math.random() - 0.5) * 120, y: window.innerHeight * 0.38,
        vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 15 - 5, r: Math.random() * 6 + 4,
        spin: Math.random() * 0.3 - 0.15, angle: Math.random() * Math.PI, color: colors[Math.floor(Math.random() * colors.length)], shape: Math.random() > 0.5,
      }));
      const started = performance.now();
      const step = now => {
        const elapsed = now - started;
        context.clearRect(0, 0, window.innerWidth, window.innerHeight);
        pieces.forEach(piece => {
          piece.vy += 0.38; piece.vx *= 0.99; piece.x += piece.vx; piece.y += piece.vy; piece.angle += piece.spin;
          context.save(); context.globalAlpha = clamp(1 - (elapsed - 1800) / 900);
          context.translate(piece.x, piece.y); context.rotate(piece.angle); context.fillStyle = piece.color;
          if (piece.shape) context.fillRect(-piece.r / 2, -piece.r / 4, piece.r, piece.r / 2);
          else { context.beginPath(); context.arc(0, 0, piece.r / 2.4, 0, Math.PI * 2); context.fill(); }
          context.restore();
        });
        if (elapsed < 2700) requestAnimationFrame(step); else canvas.remove();
      };
      requestAnimationFrame(step);
    };
    let lastCode = '';
    const check = host => {
      const success = host.querySelector('.success-ico:not(.pending)');
      const code = host.querySelector('.ticket-code')?.textContent || '';
      if (success && code && code !== lastCode) { lastCode = code; window.setTimeout(burst, 350); }
    };
    ['#voucher', '#voucher-result'].forEach(selector => { const host = $(selector); watch(host, () => check(host), { childList: true }); });
  }

  /* ---------- Panel: cifras enteras con conteo ---------- */
  function adminCounters() {
    const kpis = $('#kpis');
    if (!kpis || reducedMotion.matches) return;
    watch(kpis, () => {
      kpis.querySelectorAll('.kpi strong').forEach(strong => {
        const original = strong.textContent, match = original.match(/^(\D*?)(\d+)(\D*)$/);
        const target = match ? Number(match[2]) : 0;
        if (!target) return;
        const started = performance.now();
        const step = now => {
          const progress = clamp((now - started) / 900);
          strong.textContent = progress < 1 ? `${match[1]}${Math.round(target * (1 - Math.pow(1 - progress, 3)))}${match[3]}` : original;
          if (progress < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    }, { childList: true });
  }

  const start = () => {
    safely('giantTitle', giantTitle);
    safely('chrome', chrome);
    safely('sand', sand);
    safely('magnetic', magnetic);
    safely('cascades', cascades);
    safely('bookingWidget', bookingWidget);
    safely('cardPreview', cardPreview);
    safely('confetti', confetti);
    safely('adminCounters', adminCounters);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
