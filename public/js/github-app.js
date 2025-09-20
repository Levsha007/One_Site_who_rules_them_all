// public/js/github-app.js
let currentProfile = 'Levsha007'; // ← замените!
const myUsername = 'Levsha007'; // Ваш фиксированный логин

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
  t.textContent = txt;
  t.classList.add('show');
  clearTimeout(t._hide);
  t._hide = setTimeout(() => t.classList.remove('show'), ms);
}

// Тема
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

themeToggle.addEventListener('click', () => {
  const cur = localStorage.getItem('theme') || 'dark';
  setTheme(cur === 'dark' ? 'light' : 'dark');
});

// Правильное декодирование Base64 → UTF-8 (для кириллицы!)
function decodeBase64(str) {
  try {
    return decodeURIComponent(atob(str).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
  } catch (e) {
    console.warn('Base64 decode failed:', e);
    return atob(str);
  }
}

function getFileType(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  if (['md', 'markdown'].includes(ext)) return 'markdown';
  if (['js', 'jsx', 'ts', 'tsx', 'json', 'html', 'css', 'py', 'java', 'cpp', 'c', 'go', 'rb'].includes(ext)) return 'code';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
  return 'text';
}

function openFileModal(filename, content, type) {
  const modal = document.getElementById('file-modal');
  const contentEl = document.getElementById('file-modal-content');
  document.getElementById('file-modal-filename').textContent = filename;

  let htmlContent = '';

  if (type === 'markdown') {
    htmlContent = simpleMarkdown(content);
  } else if (type === 'code') {
    htmlContent = `<pre><code>${escapeHtml(content)}</code></pre>`;
  } else if (type === 'image') {
    htmlContent = `<img src="${content}" alt="${filename}" style="max-width:100%;border-radius:8px;" />`;
  } else {
    htmlContent = `<pre style="white-space: pre-wrap;">${escapeHtml(content)}</pre>`;
  }

  contentEl.innerHTML = htmlContent;
  modal.style.display = 'flex';
}

function closeFileModal() {
  document.getElementById('file-modal').style.display = 'none';
}

function simpleMarkdown(md) {
  return md
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/!\[(.*?)\]\((.*?)\)/g, '<img alt="$1" src="$2">')
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>')
    .replace(/\n/g, '<br>');
}

async function fetchAndShowFile(fullName, path) {
  const [owner, repo] = fullName.split('/');
  const url = path 
    ? `https://api.github.com/repos/${owner}/${repo}/contents/${path}`
    : `https://api.github.com/repos/${owner}/${repo}/contents`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Не удалось загрузить');

    const data = await res.json();

    if (Array.isArray(data)) {
      const files = data
        .filter(f => f.type === 'file')
        .map(f => `<li onclick="fetchAndShowFile('${fullName}', '${f.name}')">📄 ${f.name}</li>`)
        .join('');
      openFileModal(`${repo}/`, `<ul>${files}</ul>`, 'text');
      return;
    }

    if (data.content) {
      const binContent = decodeBase64(data.content);
      const fileType = getFileType(data.name);

      if (fileType === 'image') {
        openFileModal(data.name, data.download_url, 'image');
      } else {
        openFileModal(data.name, binContent, fileType);
      }
    }
  } catch (err) {
    console.error(err);
    openFileModal('Ошибка', 'Не удалось загрузить файл.', 'text');
  }
}

async function loadGitHubData(username = currentProfile) {
  try {
    const [userRes, reposRes, starredRes, followingRes] = await Promise.all([
      fetch(`https://api.github.com/users/${username}`),
      fetch(`https://api.github.com/users/${username}/repos?per_page=100&type=public`),
      fetch(`https://api.github.com/users/${username}/starred?per_page=100`),
      fetch(`https://api.github.com/users/${username}/following?per_page=100`)
    ]);

    const [userData, reposData, starredData, followingData] = await Promise.all([
      userRes.json(),
      reposRes.json(),
      starredRes.json(),
      followingRes.json()
    ]);

    renderProfile(userData);
    renderPublicRepos(reposData);
    renderStarredRepos(starredData);
    renderFollowing(followingData);

    if (username !== myUsername) {
      document.getElementById('back-btn-container').style.display = 'block';
    } else {
      document.getElementById('back-btn-container').style.display = 'none';
    }
  } catch (err) {
    console.error(err);
    showToast('❌ Не удалось загрузить данные. Возможно, такого пользователя нет.');
  }
}

function renderProfile(user) {
  const container = document.getElementById('profile-section');
  container.innerHTML = `
    <div class="profile-card">
      <div class="profile-header">Профиль</div>
      <div class="profile-body">
        <img src="${user.avatar_url}" alt="${user.login}" style="width:100px;border-radius:50%;">
        <h2><a href="${user.html_url}" target="_blank" style="color:var(--accent);">${escapeHtml(user.login)}</a></h2>
        <p>${escapeHtml(user.name || '')}</p>
        <p>${escapeHtml(user.bio || 'Нет био')}</p>
      </div>
      <div class="profile-footer">
        <div class="stat-item">
          <div class="stat-label">Репозитории</div>
          <div class="stat-value">${user.public_repos}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Звёзды</div>
          <div class="stat-value">${document.querySelectorAll('#starred-list .card').length}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Фолловеры</div>
          <div class="stat-value">${user.followers}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Фолловит</div>
          <div class="stat-value">${user.following}</div>
        </div>
      </div>
    </div>
  `;
}

function renderPublicRepos(repos) {
  const container = document.getElementById('repos-list');
  container.innerHTML = '';

  repos.forEach(repo => {
    const card = document.createElement('div');
    card.className = 'card';

    const fileTree = `
      <div class="file-tree">
        <ul>
          <li onclick="fetchAndShowFile('${repo.full_name}', 'README.md')">📝 README.md</li>
          <li onclick="fetchAndShowFile('${repo.full_name}', '')">🗎 Все файлы</li>
        </ul>
      </div>
    `;

    card.innerHTML = `
      <div class="card-header">
        <a href="${repo.html_url}" target="_blank" style="color:white;text-decoration:none;">
          ${escapeHtml(repo.name)}
        </a>
      </div>
      <div class="card-body">
        ${escapeHtml(repo.description || 'Нет описания')}
      </div>
      <div class="card-footer">
        <div class="stat-item">
          <div class="stat-label">Язык</div>
          <div class="stat-value">${repo.language || '—'}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Звёзды</div>
          <div class="stat-value">${repo.stargazers_count}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Форки</div>
          <div class="stat-value">${repo.forks_count}</div>
        </div>
      </div>
      ${fileTree}
    `;
    container.appendChild(card);
  });
}

function renderStarredRepos(repos) {
  const container = document.getElementById('starred-list');
  container.innerHTML = '';

  repos.forEach(repo => {
    const card = document.createElement('div');
    card.className = 'card';

    const fileTree = `
      <div class="file-tree">
        <ul>
          <li onclick="fetchAndShowFile('${repo.full_name}', 'README.md')">📝 README.md</li>
          <li onclick="fetchAndShowFile('${repo.full_name}', '')">🗎 Все файлы</li>
        </ul>
      </div>
    `;

    card.innerHTML = `
      <div class="card-header">
        <a href="${repo.html_url}" target="_blank" style="color:white;text-decoration:none;">
          ${escapeHtml(repo.name)}
        </a>
      </div>
      <div class="card-body">
        ${escapeHtml(repo.description || 'Нет описания')}
        <small>Автор: <a href="${repo.owner.html_url}" target="_blank">${repo.owner.login}</a></small>
      </div>
      <div class="card-footer">
        <div class="stat-item">
          <div class="stat-label">Язык</div>
          <div class="stat-value">${repo.language || '—'}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Звёзды</div>
          <div class="stat-value">${repo.stargazers_count}</div>
        </div>
      </div>
      ${fileTree}
    `;
    container.appendChild(card);
  });
}

function renderFollowing(users) {
  const container = document.getElementById('following-list');
  container.innerHTML = '';

  users.forEach(user => {
    const card = document.createElement('div');
    card.className = 'card following-card';
    card.onclick = (e) => {
      if (e.target.tagName === 'A') return;
      currentProfile = user.login;
      loadGitHubData(user.login);
    };

    card.innerHTML = `
      <div class="card-header">${escapeHtml(user.login)}</div>
      <div class="card-body">
        <img src="${user.avatar_url}" alt="${user.login}" style="width: 60px; border-radius: 50%; display: block; margin: 0 auto;">
        <p><a href="${user.html_url}" target="_blank">Перейти на профиль</a></p>
      </div>
    `;
    container.appendChild(card);
  });
}

function goBackToMyProfile() {
  currentProfile = myUsername;
  loadGitHubData(myUsername);
}

// Поиск профиля по логину
function searchUser() {
  const input = document.getElementById('search-user-input');
  const username = input.value.trim();
  if (!username) {
    showToast('Введите логин');
    return;
  }
  currentProfile = username;
  loadGitHubData(username);
  input.value = ''; // очистить после поиска
}

// === КНОПКА "НАЗАД НА ГЛАВНУЮ" ===
document.getElementById('home-btn')?.addEventListener('click', () => {
  window.location.href = '/';
});

// Загрузка при старте
document.addEventListener('DOMContentLoaded', () => {
  loadGitHubData();
});