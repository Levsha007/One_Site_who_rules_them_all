// public/js/gallery-page.js — только галерея
if (!document.getElementById('gallery-grid')) {
  // Не на странице галереи → выходим
  console.log('[Gallery] Страница не загружена.');
  exit;
}

// === Универсальные утилиты (локально) ===
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
  history.replaceState(null, '', `?gallery=${encodeURIComponent(name)}&page=${currentPage}`);
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

document.getElementById('create-gallery-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const name = formData.get('name');
  if (!name.trim()) {
    showToast('Введите имя папки');
    return;
  }
  try {
    const res = await fetch('/create-gallery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(`Папка "${data.name}" создана`);
      e.target.reset();
      loadGalleries();
    } else {
      showToast('Ошибка: ' + (data.error || 'неизвестна'));
    }
  } catch (err) {
    console.error(err);
    showToast('Ошибка сети при создании папки');
  }
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

// ✅ Исправление бага с кнопкой мыши (back/forward)
window.addEventListener('popstate', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const gallery = urlParams.get('gallery') || localStorage.getItem('currentGallery') || 'all';
  const page = parseInt(urlParams.get('page') || '0');
  currentPage = isNaN(page) ? 0 : page;
  loadGalleries(gallery);
});