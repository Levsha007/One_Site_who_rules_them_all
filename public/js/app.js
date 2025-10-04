// public/js/app.js — общие утилиты
function escapeHtml(s) {
  if (s === undefined || s === null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToast(txt, ms = 3000) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = txt;
  t.classList.add('show');
  clearTimeout(t._hide);
  t._hide = setTimeout(() => t.classList.remove('show'), ms);
}

// === Тема ===
const themeToggle = document.getElementById('theme-toggle');
function setTheme(theme) {
  if (theme === 'dark') {
    document.body.removeAttribute('data-theme');
    themeToggle.textContent = '☀️';
    localStorage.setItem('theme', 'dark');
  } else {
    document.body.setAttribute('data-theme', 'light');
    themeToggle.textContent = '🌙';
    localStorage.setItem('theme', 'light');
  }
}

const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'light') setTheme('light');
else setTheme('dark');

themeToggle?.addEventListener('click', () => {
  const cur = localStorage.getItem('theme') || 'dark';
  setTheme(cur === 'dark' ? 'light' : 'dark');
});

// === Кнопка "Главная" — работает везде ===
document.getElementById('home-btn')?.addEventListener('click', () => {
  window.location.href = '/';
});