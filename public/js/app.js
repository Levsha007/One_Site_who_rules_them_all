// public/js/app.js

// === Универсальные утилиты ===
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

// === Переключение темы ===
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

// === Кнопка "Главная" (всегда работает) ===
document.getElementById('home-btn')?.addEventListener('click', () => {
  window.location.href = '/';
});

// === Если на странице галереи — подключаем её логику ===
if (document.getElementById('gallery-grid')) {
  // === Сохранение имён ===
  function readOverrides() {
    try {
      return JSON.parse(localStorage.getItem('nameOverrides') || '{}');
    } catch {
      return {};
    }
  }
  function writeOverrides(o) {
    localStorage.setItem('nameOverrides', JSON.stringify(o));
  }

  // === Избранное ===
  function readFavorites() {
    try {
      return new Set(JSON.parse(localStorage.getItem('favorites') || '[]'));
    } catch {
      return new Set();
    }
  }
  function writeFavorites(set) {
    localStorage.setItem('favorites', JSON.stringify(Array.from(set)));
  }

  // === Masonry + загрузка галерей ===
  let masonry;
  const grid = document.getElementById('gallery-grid');
  let currentPage = 0;
  const itemsPerPage = 150;

  async function loadGalleries(filter = 'all') {
    try {
      const res = await fetch('/galleries');
      if (!res.ok) throw new Error('Ошибка получения /galleries: ' + res.status);
      const allGalleries = await res.json();

      // select
      const select = document.querySelector('select[name="gallery"]');
      select.innerHTML = '<option value="" disabled selected>Выберите папку</option>';
      allGalleries.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g.name;
        opt.textContent = g.name;
        select.appendChild(opt);
      });

      // nav
      const nav = document.getElementById('gallery-nav');
      nav.innerHTML = '<button data-gallery="all">Все</button>';
      allGalleries.forEach(g => {
        const btn = document.createElement('button');
        btn.dataset.gallery = g.name;
        btn.textContent = g.name;
        nav.appendChild(btn);
      });

      // очистка
      document.querySelectorAll('.grid-item:not(.grid-sizer)').forEach(el => el.remove());

      let images = [];
      if (filter === 'all') {
        const allImages = [];
        allGalleries.forEach(g => {
          (g.images || []).forEach(img => {
            allImages.push(Object.assign({}, img, { gallery: g.name }));
          });
        });
        const shuffled = allImages.sort(() => 0.5 - Math.random());
        images = shuffled.slice(0, itemsPerPage);
      } else if (filter === 'favorites') {
        const favorites = readFavorites();
        const allImages = [];
        allGalleries.forEach(g => {
          (g.images || []).forEach(img => {
            if (favorites.has(img.path)) {
              allImages.push(Object.assign({}, img, { gallery: g.name }));
            }
          });
        });
        images = allImages;
      } else {
        const g = allGalleries.find(x => x.name === filter);
        (g?.images || []).forEach(img => images.push(Object.assign({}, img, { gallery: g.name })));
      }

      const overrides = readOverrides();
      const favorites = readFavorites();

      // Показываем только текущую страницу
      const start = currentPage * itemsPerPage;
      const end = (currentPage + 1) * itemsPerPage;
      const visibleImages = images.slice(start, end);

      const fragment = document.createDocumentFragment();
      visibleImages.forEach((img, index) => {
        const displayName = overrides[img.path] || img.name || '';
        const isFavorite = favorites.has(img.path);
        const item = document.createElement('div');
        item.className = 'grid-item';
        const isExternal = img.isExternal ? 'external' : '';
        item.innerHTML = `
          <img src="${escapeHtml(img.path || '')}" 
               alt="${escapeHtml(displayName)}" 
               title="${escapeHtml(displayName)}" 
               data-name="${escapeHtml(displayName)}" 
               data-original-name="${escapeHtml(img.name || '')}" 
               data-gallery="${escapeHtml(img.gallery || '')}" 
               data-path="${escapeHtml(img.path || '')}"
               data-index="${start + index}"
               class="${isExternal}"
               loading="lazy">
          <button class="favorite-heart ${isFavorite ? 'favorited' : ''}" aria-label="Добавить в избранное">❤️</button>
          <button class="delete-btn" aria-label="Удалить">✕</button>
          <button class="rename-btn" aria-label="Переименовать">✏️</button>
          <div class="img-overlay">${escapeHtml(displayName)}</div>
          <div class="index-badge">${start + index + 1}</div>
        `;
        fragment.appendChild(item);
      });
      grid.appendChild(fragment);

      // Удаляем старый Masonry
      if (masonry) masonry.destroy();

      setTimeout(() => {
        masonry = new Masonry('.grid', {
          itemSelector: '.grid-item',
          columnWidth: '.grid-sizer',
          percentPosition: true,
          gutter: 16
        });
      }, 220);

      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            img.src = img.dataset.src || img.src;
            observer.unobserve(img);
            img.onload = () => {
              if (masonry) {
                masonry.layout();
              }
            };
          }
        });
      }, { threshold: 0.1 });

      document.querySelectorAll('img[loading="lazy"]').forEach(img => {
        observer.observe(img);
      });

      updatePaginationControls(images.length);
      updateCurrentGalleryTitle(filter);
      localStorage.setItem('currentGallery', filter);
      localStorage.setItem('currentPage', String(currentPage));
    } catch (err) {
      console.error(err);
      showToast('Ошибка загрузки галерей. Проверь сервер.');
    }
  }

  function updateCurrentGalleryTitle(name) {
    const currentGalleryEl = document.getElementById('current-gallery-title');
    if (currentGalleryEl) {
      currentGalleryEl.textContent = name === 'all' ? 'Все изображения' : 
                                     name === 'favorites' ? 'Избранное' : name;
    }
    history.pushState(null, '', `?gallery=${encodeURIComponent(name)}&page=${currentPage}`);
  }

  function updatePaginationControls(totalItems) {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const currentPageNum = currentPage + 1;

    document.getElementById('page-info-top').textContent = `Страница ${currentPageNum} из ${totalPages}`;
    document.getElementById('prev-page-top').disabled = currentPage === 0;
    document.getElementById('next-page-top').disabled = currentPage >= totalPages - 1;

    document.getElementById('page-info-bottom').textContent = `Страница ${currentPageNum} из ${totalPages}`;
    document.getElementById('prev-page-bottom').disabled = currentPage === 0;
    document.getElementById('next-page-bottom').disabled = currentPage >= totalPages - 1;
  }

  document.getElementById('prev-page-top').addEventListener('click', () => {
    if (currentPage > 0) {
      currentPage--;
      const gallery = localStorage.getItem('currentGallery') || 'all';
      loadGalleries(gallery);
    }
  });

  document.getElementById('next-page-top').addEventListener('click', () => {
    const gallery = localStorage.getItem('currentGallery') || 'all';
    fetch('/galleries')
      .then(res => res.json())
      .then(allGalleries => {
        const totalImages = allGalleries.reduce((acc, g) => acc + (g.images?.length || 0), 0);
        const totalPages = Math.ceil(totalImages / itemsPerPage);
        if (currentPage < totalPages - 1) {
          currentPage++;
          loadGalleries(gallery);
        }
      })
      .catch(err => {
        console.error(err);
        showToast('Не удалось получить количество изображений');
      });
  });

  document.getElementById('prev-page-bottom').addEventListener('click', () => {
    if (currentPage > 0) {
      currentPage--;
      const gallery = localStorage.getItem('currentGallery') || 'all';
      loadGalleries(gallery);
    }
  });

  document.getElementById('next-page-bottom').addEventListener('click', () => {
    const gallery = localStorage.getItem('currentGallery') || 'all';
    fetch('/galleries')
      .then(res => res.json())
      .then(allGalleries => {
        const totalImages = allGalleries.reduce((acc, g) => acc + (g.images?.length || 0), 0);
        const totalPages = Math.ceil(totalImages / itemsPerPage);
        if (currentPage < totalPages - 1) {
          currentPage++;
          loadGalleries(gallery);
        }
      })
      .catch(err => {
        console.error(err);
        showToast('Не удалось получить количество изображений');
      });
  });

  document.getElementById('gallery-nav').addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (btn) {
      const galleryName = btn.dataset.gallery;
      localStorage.setItem('currentGallery', galleryName);
      currentPage = 0;
      loadGalleries(galleryName);
    }
  });

  document.getElementById('favorites-btn').addEventListener('click', () => {
    localStorage.setItem('currentGallery', 'favorites');
    currentPage = 0;
    loadGalleries('favorites');
  });

  document.getElementById('upload-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    document.getElementById('loading').style.display = 'inline';
    try {
      const res = await fetch('/upload', { method: 'POST', body: fd });
      const r = await res.json();
      if (r.success) {
        showToast(`Загружено ${r.images.length}`);
        loadGalleries();
      } else {
        showToast('Ошибка: ' + (r.error || 'неизвестно'));
      }
    } catch (err) {
      console.error(err);
      showToast('Ошибка сети при загрузке');
    }
    document.getElementById('loading').style.display = 'none';
  });

  document.addEventListener('click', async (e) => {
    if (e.target.classList.contains('favorite-heart')) {
      const parent = e.target.closest('.grid-item');
      if (!parent) return;
      const img = parent.querySelector('img');
      const path = img.dataset.path;
      const favorites = readFavorites();
      if (favorites.has(path)) {
        favorites.delete(path);
        e.target.classList.remove('favorited');
        showToast('Удалено из избранного');
      } else {
        favorites.add(path);
        e.target.classList.add('favorited');
        showToast('Добавлено в избранное');
      }
      writeFavorites(favorites);
    }
    if (e.target.classList.contains('rename-btn')) {
      const parent = e.target.closest('.grid-item');
      if (!parent) return;
      if (parent.querySelector('.rename-input')) return;
      const img = parent.querySelector('img');
      const current = img.dataset.name || img.dataset.originalName || '';
      const wrap = document.createElement('div');
      wrap.className = 'rename-input';
      const input = document.createElement('input');
      input.type = 'text';
      input.value = current;
      const save = document.createElement('button');
      save.type = 'button';
      save.textContent = '✓';
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.textContent = '✖';
      wrap.append(input, save, cancel);
      parent.appendChild(wrap);
      input.focus();
      input.select();
      cancel.addEventListener('click', () => wrap.remove());
      input.addEventListener('keydown', ev => {
        if (ev.key === 'Enter') save.click();
        if (ev.key === 'Escape') wrap.remove();
      });
      save.addEventListener('click', async () => {
        const newName = input.value.trim();
        if (!newName) {
          showToast('Имя не может быть пустым');
          return;
        }
        try {
          const res = await fetch('/rename', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gallery: img.dataset.gallery, oldPath: img.dataset.path, newName })
          });
          if (res.ok) {
            let json;
            try { json = await res.json(); } catch { json = { success: true }; }
            if (json && json.success !== false) {
              applyNameToElement(img, newName);
              showToast('Имя сохранено на сервере');
              wrap.remove();
              return;
            } else {
              saveLocalOverride(img.dataset.path, newName);
              applyNameToElement(img, newName);
              showToast('Сервер вернул ошибку — имя сохранено локально');
              wrap.remove();
              return;
            }
          } else if (res.status === 404) {
            saveLocalOverride(img.dataset.path, newName);
            applyNameToElement(img, newName);
            showToast('Эндпоинт /rename не найден — имя сохранено локально');
            wrap.remove();
            return;
          } else {
            const txt = await res.text();
            showToast('Ошибка сервера: ' + res.status + ' ' + txt);
            return;
          }
        } catch (err) {
          console.warn('rename network error', err);
          saveLocalOverride(img.dataset.path, newName);
          applyNameToElement(img, newName);
          showToast('Сетевая ошибка — имя сохранено локально');
          wrap.remove();
          return;
        }
      });
    }
    if (e.target.classList.contains('delete-btn')) {
      const parent = e.target.closest('.grid-item');
      const img = parent.querySelector('img');
      const path = img.dataset.path;
      const gallery = img.dataset.gallery;
      if (!path || !gallery) return;
      if (!confirm('Удалить это изображение?')) return;
      try {
        const res = await fetch('/delete-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gallery, path })
        });
        if (res.ok) {
          parent.remove();
          showToast('Изображение удалено');
          if (masonry) {
            masonry.layout();
          }
        } else {
          const txt = await res.text();
          showToast('Ошибка: ' + txt);
        }
      } catch (err) {
        console.error(err);
        showToast('Ошибка сети');
      }
    }
  });

  function applyNameToElement(imgEl, newName) {
    const overlay = imgEl.parentElement.querySelector('.img-overlay');
    imgEl.dataset.name = newName;
    imgEl.title = newName;
    imgEl.alt = newName;
    if (overlay) overlay.textContent = newName;
    const modalImg = document.getElementById('modal-img');
    if (modalImg && modalImg.src === imgEl.src) {
      const cap = document.getElementById('modal-caption');
      cap.textContent = newName;
      cap.style.fontSize = '30px';
    }
  }

  function saveLocalOverride(path, newName) {
    if (!path) return;
    const overrides = readOverrides();
    overrides[path] = newName;
    writeOverrides(overrides);
  }

  // === Модалка ===
  let currentImageIndex = -1;
  const modal = document.getElementById('modal');
  const modalImg = document.getElementById('modal-img');
  const modalCaption = document.getElementById('modal-caption');
  const closeBtn = document.getElementById('close-btn');
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');

  function openModal(images, index) {
    currentImageIndex = index;
    const img = images[index];
    modalImg.src = img.path;
    modalImg.alt = img.alt || img.dataset.name || '';
    modalCaption.textContent = img.dataset.name || img.dataset.originalName || '';
    modalCaption.style.fontSize = '30px';
    const indexBadge = document.querySelector('.modal .index-badge');
    if (indexBadge) {
      indexBadge.textContent = index + 1;
    } else {
      const badge = document.createElement('div');
      badge.className = 'index-badge';
      badge.textContent = index + 1;
      modalImg.parentNode.insertBefore(badge, modalImg.nextSibling);
    }
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    modalImg.style.transform = 'scale(1)';
    modalImg.classList.remove('loaded');
    setTimeout(() => {
      modalImg.classList.add('loaded');
    }, 10);
  }

  function closeModal() {
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    currentImageIndex = -1;
  }

  document.addEventListener('click', e => {
    const img = e.target.closest('.grid-item img');
    if (img) {
      const items = document.querySelectorAll('.grid-item img');
      const index = Array.from(items).indexOf(img);
      const images = Array.from(items).map(el => ({
        path: el.src,
        alt: el.alt,
        dataset: el.dataset
      }));
      openModal(images, index);
    }
  });

  document.addEventListener('keydown', e => {
    if (currentImageIndex === -1) return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prevIndex = (currentImageIndex - 1 + document.querySelectorAll('.grid-item img').length) % document.querySelectorAll('.grid-item img').length;
      const images = Array.from(document.querySelectorAll('.grid-item img')).map(el => ({
        path: el.src,
        alt: el.alt,
        dataset: el.dataset
      }));
      openModal(images, prevIndex);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      const nextIndex = (currentImageIndex + 1) % document.querySelectorAll('.grid-item img').length;
      const images = Array.from(document.querySelectorAll('.grid-item img')).map(el => ({
        path: el.src,
        alt: el.alt,
        dataset: el.dataset
      }));
      openModal(images, nextIndex);
    } else if (e.key === 'Escape') {
      closeModal();
    }
  });

  prevBtn?.addEventListener('click', () => {
    if (currentImageIndex === -1) return;
    const prevIndex = (currentImageIndex - 1 + document.querySelectorAll('.grid-item img').length) % document.querySelectorAll('.grid-item img').length;
    const images = Array.from(document.querySelectorAll('.grid-item img')).map(el => ({
      path: el.src,
      alt: el.alt,
      dataset: el.dataset
    }));
    openModal(images, prevIndex);
  });

  nextBtn?.addEventListener('click', () => {
    if (currentImageIndex === -1) return;
    const nextIndex = (currentImageIndex + 1) % document.querySelectorAll('.grid-item img').length;
    const images = Array.from(document.querySelectorAll('.grid-item img')).map(el => ({
      path: el.src,
      alt: el.alt,
      dataset: el.dataset
    }));
    openModal(images, nextIndex);
  });

  closeBtn?.addEventListener('click', closeModal);
  modal?.addEventListener('click', e => {
    if (e.target.id === 'modal') {
      closeModal();
    }
  });

  // === Тач для мобильных ===
  let touchStartX = 0;
  let touchEndX = 0;
  modal?.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });
  modal?.addEventListener('touchend', e => {
    touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;
    if (diff > 50) {
      const nextIndex = (currentImageIndex + 1) % document.querySelectorAll('.grid-item img').length;
      const images = Array.from(document.querySelectorAll('.grid-item img')).map(el => ({
        path: el.src,
        alt: el.alt,
        dataset: el.dataset
      }));
      openModal(images, nextIndex);
    } else if (diff < -50) {
      const prevIndex = (currentImageIndex - 1 + document.querySelectorAll('.grid-item img').length) % document.querySelectorAll('.grid-item img').length;
      const images = Array.from(document.querySelectorAll('.grid-item img')).map(el => ({
        path: el.src,
        alt: el.alt,
        dataset: el.dataset
      }));
      openModal(images, prevIndex);
    }
  }, { passive: true });

  // === Ползунок размера плиток ===
  const sliderContainer = document.querySelector('.slider-container');
  const sliderFill = document.querySelector('.slider-fill');
  const sliderThumb = document.querySelector('.slider-thumb');
  const sizeValue = document.getElementById('sizeValue');
  const savedPercent = (() => {
    const v = localStorage.getItem('tileScalePercent');
    const n = Number(v);
    return (Number.isFinite(n) && n >= 10 && n <= 100) ? n : 100;
  })();
  updateSlider(savedPercent);

  sliderContainer?.addEventListener('mousedown', (e) => {
    const rect = sliderContainer.getBoundingClientRect();
    const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    updateSlider(percent);
  });

  sliderThumb?.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startPercent = parseFloat(sliderFill.style.width) || 0;
    const move = (e) => {
      const dx = e.clientX - startX;
      const rect = sliderContainer.getBoundingClientRect();
      const newPercent = Math.max(0, Math.min(100, (startPercent / 100) * 100 + (dx / rect.width) * 100));
      updateSlider(newPercent);
    };
    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  });

  function updateSlider(percent) {
    const rounded = Math.round(percent);
    sliderFill.style.width = rounded + '%';
    sliderThumb.style.left = rounded + '%';
    sizeValue.textContent = rounded + '%';
    localStorage.setItem('tileScalePercent', String(rounded));
    applyScale(rounded);
  }

  function applyScale(percent) {
    const newWidth = (32.7 * percent / 100);
    document.documentElement.style.setProperty('--item-size', newWidth.toFixed(3) + '%');
    const scale = (percent / 100);
    document.documentElement.style.setProperty('--scale-factor', String(scale));
    if (masonry) {
      setTimeout(() => masonry.layout(), 220);
    }
  }

  // === Восстановление состояния ===
  window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const galleryParam = urlParams.get('gallery');
    const pageParam = parseInt(urlParams.get('page') || '0');
    const savedGallery = localStorage.getItem('currentGallery') || 'all';
    const currentGallery = galleryParam || savedGallery;
    currentPage = isNaN(pageParam) ? 0 : pageParam;

    const createDetails = document.getElementById('create-gallery-details');
    const uploadDetails = document.getElementById('upload-details');
    const galleriesDetails = document.getElementById('galleries-details');
    const createOpen = localStorage.getItem('createDetailsOpen') === 'true';
    const uploadOpen = localStorage.getItem('uploadDetailsOpen') === 'true';
    const galleriesOpen = localStorage.getItem('galleriesDetailsOpen') === 'true';
    createDetails.open = createOpen;
    uploadDetails.open = uploadOpen;
    galleriesDetails.open = galleriesOpen;

    createDetails.addEventListener('toggle', () => {
      localStorage.setItem('createDetailsOpen', String(createDetails.open));
    });
    uploadDetails.addEventListener('toggle', () => {
      localStorage.setItem('uploadDetailsOpen', String(uploadDetails.open));
    });
    galleriesDetails.addEventListener('toggle', () => {
      localStorage.setItem('galleriesDetailsOpen', String(galleriesDetails.open));
    });

    loadGalleries(currentGallery);
  });
}

// === Если на странице закладок — подключаем её логику ===
if (document.getElementById('bookmarks-grid')) {
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
}