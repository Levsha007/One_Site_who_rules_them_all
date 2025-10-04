// public/js/bookmarks-page.js — только закладки
if (!document.getElementById('bookmarks-grid')) {
  console.log('[Bookmarks] Страница не загружена.');
  exit;
}

// === Режимы отображения ===
function setViewMode(mode) {
  document.body.classList.remove('masonry-mode', 'grid-mode', 'list-mode');
  document.body.classList.add(mode);
  document.querySelectorAll('.view-mode-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`.view-mode-btn[data-mode="${mode}"]`).classList.add('active');
  localStorage.setItem('viewMode', mode);
}

// === Загрузка категорий ===
async function loadCategories() {
  try {
    const res = await fetch('/categories');
    if (!res.ok) throw new Error('Ошибка получения категорий: ' + res.status);
    const categories = await res.json();
    const select = document.getElementById('bookmark-category');
    select.innerHTML = '';
    categories.forEach(category => {
      const opt = document.createElement('option');
      opt.value = category;
      opt.textContent = category;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error(err);
    showToast('Ошибка загрузки категорий. Проверь сервер.');
  }
}
loadCategories();

// === Загрузка закладок ===
let bookmarks = [];
let searchTimeout = null;

async function loadBookmarks() {
  try {
    const res = await fetch('/bookmarks');
    if (!res.ok) throw new Error('Ошибка получения закладок: ' + res.status);
    bookmarks = await res.json();
    applySort();
  } catch (err) {
    console.error(err);
    showToast('Ошибка загрузки закладок. Проверь сервер.');
  }
}
loadBookmarks();

// === Сортировка ===
function applySort() {
  const sortSelect = document.getElementById('sort-select');
  const sortValue = sortSelect ? sortSelect.value : 'name-asc';
  let sortedBookmarks = [...bookmarks];
  if (sortValue === 'name-asc') {
    sortedBookmarks.sort((a, b) => a.title.localeCompare(b.title));
  } else if (sortValue === 'name-desc') {
    sortedBookmarks.sort((a, b) => b.title.localeCompare(a.title));
  } else if (sortValue === 'category-asc') {
    sortedBookmarks.sort((a, b) => a.category.localeCompare(b.category));
  } else if (sortValue === 'category-desc') {
    sortedBookmarks.sort((a, b) => b.category.localeCompare(a.category));
  }
  renderBookmarks(sortedBookmarks);
}

// === Отрисовка ===
function renderBookmarks(bookmarks) {
  const grid = document.getElementById('bookmarks-grid');
  if (!grid) return;
  grid.innerHTML = '';
  bookmarks.forEach(bookmark => {
    const card = document.createElement('div');
    card.className = 'bookmark-card';
    card.innerHTML = `
      <div class="card-header">
        <img src="https://www.google.com/s2/favicons?domain=${escapeHtml(bookmark.url)}" alt="${escapeHtml(bookmark.title)}" class="site-icon">
        <h3 class="card-title">${escapeHtml(bookmark.title)}</h3>
        <div class="card-category">${escapeHtml(bookmark.category)}</div>
      </div>
      <div class="card-footer">
        <button class="btn-delete" data-id="${bookmark.id}">×</button>
      </div>
    `;
    card.addEventListener('click', (e) => {
      if (!e.target.closest('.btn-delete')) {
        window.open(escapeHtml(bookmark.url), '_blank');
      }
    });
    grid.appendChild(card);
  });
  addEventListeners();
}

// === Добавление событий ===
function addEventListeners() {
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      localStorage.setItem('bookmarkSort', sortSelect.value);
      applySort();
    });
  }

  document.querySelectorAll('.view-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      setViewMode(mode);
    });
  });

  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      if (confirm('Вы уверены, что хотите удалить эту закладку?')) {
        deleteBookmark(id);
      }
    });
  });

  const addBtn = document.getElementById('add-bookmark-btn');
  if (addBtn) {
    addBtn.addEventListener('click', openAddBookmarkModal);
  }
}

// === Поиск ===
document.getElementById('search-input')?.addEventListener('input', (e) => {
  if (searchTimeout) clearTimeout(searchTimeout);
  const query = e.target.value.trim().toLowerCase();
  if (!query) {
    applySort();
    return;
  }
  const filtered = bookmarks.filter(b =>
    b.title.toLowerCase().includes(query) ||
    b.url.toLowerCase().includes(query) ||
    b.category.toLowerCase().includes(query)
  );
  renderBookmarks(filtered);
});

// === Модальное окно добавления ===
function openAddBookmarkModal() {
  const modal = document.getElementById('add-bookmark-modal');
  modal.style.display = 'flex';
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  document.getElementById('add-bookmark-form').reset();
}

document.getElementById('close-add-modal')?.addEventListener('click', () => {
  const modal = document.getElementById('add-bookmark-modal');
  modal.style.display = 'none';
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
});

document.getElementById('add-bookmark-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const title = formData.get('title');
  const url = formData.get('url');
  const category = formData.get('category');
  try {
    const res = await fetch('/bookmarks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, url, category })
    });
    if (res.ok) {
      showToast('Закладка добавлена');
      loadBookmarks();
      document.getElementById('add-bookmark-modal').style.display = 'none';
      document.getElementById('add-bookmark-modal').setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    } else {
      const txt = await res.text();
      showToast('Ошибка: ' + txt);
    }
  } catch (err) {
    console.error(err);
    showToast('Ошибка сети при добавлении закладки');
  }
});

// === Удаление ===
async function deleteBookmark(id) {
  try {
    const res = await fetch(`/bookmarks/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Закладка удалена');
      loadBookmarks();
    } else {
      const txt = await res.text();
      showToast('Ошибка: ' + txt);
    }
  } catch (err) {
    console.error(err);
    showToast('Ошибка сети при удалении закладки');
  }
}

// === Инициализация после загрузки ===
document.addEventListener('DOMContentLoaded', () => {
  const savedViewMode = localStorage.getItem('viewMode') || 'grid-mode';
  setViewMode(savedViewMode);

  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    const savedSort = localStorage.getItem('bookmarkSort') || 'name-asc';
    sortSelect.value = savedSort;
  }

  loadBookmarks();
});