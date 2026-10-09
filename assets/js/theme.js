(() => {
  'use strict';
  const themes = ['simple', 'tech', 'schizo', 'hexdump', 'monograph'];
  const key = 'nacl-theme';
  let theme = 'simple';
  try {
    const saved = localStorage.getItem(key);
    if (themes.includes(saved)) theme = saved;
  } catch {
    // Theme switching still works when browser storage is unavailable.
  }
  document.documentElement.dataset.theme = theme;
  document.addEventListener('DOMContentLoaded', () => {
    const picker = document.querySelector('.theme-picker');
    if (!picker) return;
    const buttons = picker.querySelectorAll('.theme-swatch');
    const name = document.getElementById('theme-name');
    const update = () => {
      for (const button of buttons) {
        const selected = button.value === theme;
        button.setAttribute('aria-pressed', String(selected));
        if (selected) name.textContent = button.getAttribute('aria-label');
      }
    };
    update();
    picker.hidden = false;
    picker.addEventListener('click', (event) => {
      const button = event.target.closest('.theme-swatch');
      if (!button || !picker.contains(button) || !themes.includes(button.value)) return;
      theme = button.value;
      document.documentElement.dataset.theme = theme;
      update();
      try { localStorage.setItem(key, theme); } catch {}
    });
  }, { once: true });
})();
