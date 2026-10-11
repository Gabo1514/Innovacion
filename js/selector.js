// Desplegables con la identidad de Buganvilla para cualquier <select> del sitio.
// El <select> original se conserva oculto: su valor, sus eventos y su validación siguen
// siendo la fuente de verdad para premium.js, booking.js y admin.js.
(() => {
  'use strict';
  if (typeof HTMLSelectElement === 'undefined') return;

  const valueDescriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
  const indexDescriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'selectedIndex');
  const supportsPopover = typeof HTMLElement.prototype.showPopover === 'function';
  const darkContexts = '.locale-controls, .detail-sidebar, .detail-controls, .site-head, .site-header';
  const destinationImages = { huacachina: 'utv', paracas: 'paracas', nasca: 'nasca', ica: 'introMain' };
  const normalize = value => String(value).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const check = '<svg class="sel-check" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
  let uid = 0, openInstance = null;

  const thumbURL = value => {
    const key = destinationImages[value];
    const entry = key && window.PremiumCatalog?.images?.[key];
    const url = typeof entry === 'string' ? entry : entry?.url || '';
    return /images\.unsplash\.com/.test(url) ? url.replace(/([?&])w=\d+/, '$1w=160') : url;
  };

  function enhance(select) {
    if (select.dataset.enhanced || select.multiple || select.size > 1 || select.hasAttribute('data-native-select')) return;
    select.dataset.enhanced = 'true';
    const id = ++uid;
    const wrap = document.createElement('span');
    wrap.className = 'sel';
    select.parentNode.insertBefore(wrap, select);
    wrap.append(select);

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.id = `sel-trigger-${id}`;
    trigger.className = ['sel-trigger', ...[...select.classList].filter(name => name !== 'sel-native' && name !== 'invalid')].join(' ');
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.innerHTML = '<span class="sel-value"></span><svg class="sel-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

    const list = document.createElement('div');
    list.id = `sel-list-${id}`;
    list.className = `sel-list${select.closest(darkContexts) ? ' sel-dark' : ''}${select.hasAttribute('data-sel-thumbs') ? ' sel-rich' : ''}`;
    list.setAttribute('role', 'listbox');
    list.tabIndex = -1;
    if (supportsPopover) list.setAttribute('popover', 'manual');
    trigger.setAttribute('aria-controls', list.id);
    wrap.append(trigger, list);

    select.classList.add('sel-native');
    select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');

    const label = select.id ? document.querySelector(`label[for="${CSS.escape(select.id)}"]`) : null;
    if (label) label.htmlFor = trigger.id;
    const name = () => select.getAttribute('aria-label') || label?.textContent.trim() || select.closest('label')?.querySelector('.sr-only')?.textContent.trim() || '';

    let active = -1, typed = '', typedTimer = 0;
    const options = () => [...select.options];
    const optionElements = () => [...list.querySelectorAll('.sel-option')];

    const refreshValue = () => {
      const index = indexDescriptor.get.call(select);
      const current = select.options[index];
      trigger.querySelector('.sel-value').textContent = current ? current.textContent : '';
      trigger.setAttribute('aria-label', `${name()}${name() ? ': ' : ''}${current ? current.textContent : ''}`);
      trigger.disabled = select.disabled;
      const invalid = select.classList.contains('invalid') || select.getAttribute('aria-invalid') === 'true';
      trigger.classList.toggle('invalid', invalid);
      if (invalid) trigger.setAttribute('aria-invalid', 'true'); else trigger.removeAttribute('aria-invalid');
      optionElements().forEach((element, position) => element.setAttribute('aria-selected', String(position === index)));
    };

    const render = () => {
      list.innerHTML = options().map((option, position) => {
        const thumb = select.hasAttribute('data-sel-thumbs') ? (thumbURL(option.value) ? `<i class="sel-thumb" style="background-image:url('${escapeHTML(thumbURL(option.value))}')"></i>` : '<i class="sel-thumb sel-thumb-all"></i>') : '';
        return `<div class="sel-option" role="option" id="${list.id}-${position}" data-index="${position}"${option.disabled ? ' aria-disabled="true"' : ''}>${thumb}<span>${escapeHTML(option.textContent)}</span>${check}</div>`;
      }).join('');
      refreshValue();
    };

    const highlight = (index, scroll = true) => {
      active = index;
      optionElements().forEach((element, position) => element.classList.toggle('is-active', position === index));
      const element = optionElements()[index];
      if (element) { list.setAttribute('aria-activedescendant', element.id); if (scroll) element.scrollIntoView({ block: 'nearest' }); }
      else list.removeAttribute('aria-activedescendant');
    };

    const step = (from, direction) => {
      const all = options();
      for (let index = from + direction; index >= 0 && index < all.length; index += direction) if (!all[index].disabled) return index;
      return from;
    };

    const position = () => {
      const rect = trigger.getBoundingClientRect();
      const width = Math.max(rect.width, list.classList.contains('sel-rich') ? 280 : 200);
      list.style.width = `${Math.min(width, window.innerWidth - 24)}px`;
      const height = Math.min(list.scrollHeight, 340);
      const below = window.innerHeight - rect.bottom - 12, above = rect.top - 12;
      const up = below < height && above > below;
      list.classList.toggle('is-above', up);
      list.style.maxHeight = `${Math.max(160, Math.min(340, up ? above : below))}px`;
      list.style.top = `${up ? Math.max(12, rect.top - Math.min(height, above) - 8) : rect.bottom + 8}px`;
      list.style.left = `${Math.min(Math.max(12, rect.left), window.innerWidth - Math.min(width, window.innerWidth - 24) - 12)}px`;
    };

    const onOutside = event => { if (!wrap.contains(event.target)) close(false); };
    const onViewport = event => { if (event.type === 'scroll' && list.contains(event.target)) return; position(); };

    const open = () => {
      if (trigger.disabled || wrap.classList.contains('is-open')) return;
      openInstance?.close(false);
      openInstance = instance;
      wrap.classList.add('is-open');
      trigger.setAttribute('aria-expanded', 'true');
      if (supportsPopover) { try { list.showPopover(); } catch {} }
      position();
      highlight(Math.max(0, indexDescriptor.get.call(select)));
      list.focus({ preventScroll: true });
      document.addEventListener('pointerdown', onOutside, true);
      window.addEventListener('scroll', onViewport, true);
      window.addEventListener('resize', onViewport);
    };

    const close = (returnFocus = true) => {
      if (!wrap.classList.contains('is-open')) return;
      wrap.classList.remove('is-open');
      trigger.setAttribute('aria-expanded', 'false');
      if (supportsPopover) { try { list.hidePopover(); } catch {} }
      document.removeEventListener('pointerdown', onOutside, true);
      window.removeEventListener('scroll', onViewport, true);
      window.removeEventListener('resize', onViewport);
      if (openInstance === instance) openInstance = null;
      if (returnFocus) trigger.focus({ preventScroll: true });
    };

    const choose = index => {
      const option = select.options[index];
      if (!option || option.disabled) return;
      const changed = index !== indexDescriptor.get.call(select);
      select.selectedIndex = index;
      close(true);
      if (changed) {
        select.dispatchEvent(new Event('input', { bubbles: true }));
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    };

    const typeahead = character => {
      window.clearTimeout(typedTimer);
      typed += normalize(character);
      typedTimer = window.setTimeout(() => { typed = ''; }, 700);
      const all = options(), start = Math.max(0, active);
      const ordered = [...all.slice(start + (typed.length === 1 ? 1 : 0)), ...all.slice(0, start + (typed.length === 1 ? 1 : 0))];
      const match = ordered.find(option => !option.disabled && normalize(option.textContent).startsWith(typed));
      if (match) highlight(all.indexOf(match));
    };

    trigger.addEventListener('click', () => (wrap.classList.contains('is-open') ? close(true) : open()));
    trigger.addEventListener('keydown', event => {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) { event.preventDefault(); open(); }
      else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) { open(); typeahead(event.key); }
    });
    list.addEventListener('keydown', event => {
      const all = options();
      if (event.key === 'ArrowDown') { event.preventDefault(); highlight(step(active, 1)); }
      else if (event.key === 'ArrowUp') { event.preventDefault(); highlight(step(active, -1)); }
      else if (event.key === 'Home') { event.preventDefault(); highlight(step(-1, 1)); }
      else if (event.key === 'End') { event.preventDefault(); highlight(step(all.length, -1)); }
      else if (event.key === 'PageDown') { event.preventDefault(); highlight(Math.min(all.length - 1, active + 5)); }
      else if (event.key === 'PageUp') { event.preventDefault(); highlight(Math.max(0, active - 5)); }
      else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(active); }
      else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); }
      else if (event.key === 'Tab') close(false);
      else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) typeahead(event.key);
    });
    list.addEventListener('pointermove', event => { const option = event.target.closest('.sel-option'); if (option) highlight(Number(option.dataset.index), false); });
    list.addEventListener('click', event => { const option = event.target.closest('.sel-option'); if (option) choose(Number(option.dataset.index)); });
    list.addEventListener('focusout', event => { if (!wrap.contains(event.relatedTarget)) close(false); });

    // Los scripts del sitio asignan .value directamente: se refleja en el desplegable sin eventos extra.
    Object.defineProperty(select, 'value', { configurable: true, get() { return valueDescriptor.get.call(this); }, set(value) { valueDescriptor.set.call(this, value); refreshValue(); } });
    Object.defineProperty(select, 'selectedIndex', { configurable: true, get() { return indexDescriptor.get.call(this); }, set(value) { indexDescriptor.set.call(this, value); refreshValue(); } });
    select.addEventListener('change', refreshValue);
    select.form?.addEventListener('reset', () => window.setTimeout(refreshValue, 0));
    new MutationObserver(records => {
      if (records.some(record => record.type !== 'attributes')) render(); else refreshValue();
    }).observe(select, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'aria-invalid', 'disabled', 'aria-label'] });
    if (label) new MutationObserver(refreshValue).observe(label, { childList: true, characterData: true, subtree: true });

    const instance = { close };
    render();
  }

  const enhanceAll = (root = document) => root.querySelectorAll?.('select').forEach(enhance);
  const start = () => {
    enhanceAll();
    new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
      if (node.nodeType !== 1) return;
      if (node.tagName === 'SELECT') enhance(node); else enhanceAll(node);
    }))).observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
