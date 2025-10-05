// server.js
const express = require('express');
const morgan = require('morgan');
const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const app = express();
const PORT = 3000;

// Папки
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
const GALLERIES_FILE = path.join(__dirname, 'galleries.json');
const BOOKMARKS_FILE = path.join(__dirname, 'data', 'bookmarks.json');
const CATEGORIES_FILE = path.join(__dirname, 'data', 'categories.json');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(GALLERIES_FILE)) fs.writeFileSync(GALLERIES_FILE, '[]');
if (!fs.existsSync(path.dirname(BOOKMARKS_FILE))) fs.mkdirSync(path.dirname(BOOKMARKS_FILE), { recursive: true });
if (!fs.existsSync(BOOKMARKS_FILE)) fs.writeFileSync(BOOKMARKS_FILE, '[]');
if (!fs.existsSync(CATEGORIES_FILE)) fs.writeFileSync(CATEGORIES_FILE, '["Работа", "Образование", "Игры", "Новости", "Развлечения", "Социальные сети", "Спорт", "Технологии"]');

let galleries = JSON.parse(fs.readFileSync(GALLERIES_FILE, 'utf8'));
let bookmarks = JSON.parse(fs.readFileSync(BOOKMARKS_FILE, 'utf8'));
let categories = JSON.parse(fs.readFileSync(CATEGORIES_FILE, 'utf8'));

// Middleware
app.use(morgan('dev'));
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Хранилище для multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'public', 'uploads', 'temp'));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

if (!fs.existsSync(path.join(__dirname, 'public', 'uploads', 'temp'))) {
  fs.mkdirSync(path.join(__dirname, 'public', 'uploads', 'temp'), { recursive: true });
}

const upload = multer({
  storage,
  limits: {
    files: 3000,
    fileSize: 500 * 1024 * 1024,
    fieldSize: 500 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|svg|bmp|tiff|avif|heif/;
    const ext = file.originalname.split('.').pop().toLowerCase();
    const mimeType = file.mimetype;
    if (allowedTypes.test(ext)) {
      return cb(null, true);
    }
    if (mimeType === 'application/octet-stream') {
      return cb(null, true);
    }
    cb(new Error('Неподдерживаемый формат файла'));
  }
});

// Роуты
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/gallery', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'gallery.html'));
});

app.get('/favorites', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'bookmarks.html'));
});

app.get('/github', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'github.html'));
});

app.get('/parallax', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'parallax.html'));
});

// API
app.get('/galleries', (req, res) => {
  res.json(galleries);
});

app.post('/create-gallery', (req, res) => {
  const { name } = req.body;
  const folderPath = path.join('public/uploads', name);
  if (galleries.some(g => g.name === name)) {
    return res.status(400).json({ error: 'Папка с таким именем уже существует' });
  }
  fs.mkdirSync(path.join(__dirname, folderPath), { recursive: true });
  galleries.push({ name, folderPath, images: [] });
  fs.writeFileSync(GALLERIES_FILE, JSON.stringify(galleries, null, 2));
  res.json({ success: true, name });
});

app.post('/upload', upload.array('images', 3000), async (req, res) => {
  const { gallery, urls } = req.body;
  const files = req.files || [];
  const galleryIndex = galleries.findIndex(g => g.name === gallery);
  if (galleryIndex === -1) {
    return res.status(404).json({ success: false, error: 'Папка не найдена' });
  }

  const newImages = [];

  // Обработка нескольких ссылок
  if (urls && urls.trim()) {
    const urlList = urls.split('\n')
      .map(url => url.trim())
      .filter(url => url.length > 0);

    for (const url of urlList) {
      try {
        new URL(url);
        newImages.push({
          path: url,
          name: '',
          isExternal: true,
          width: 300,
          height: 300
        });
      } catch (e) {
        console.warn('Неверный URL:', url);
      }
    }
  }

  // Обработка файлов с уникальными именами
  for (const file of files) {
    const originalName = file.originalname;
    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext);

    let finalName = originalName;
    let counter = 1;
    let targetPath = path.join(__dirname, 'public', 'uploads', gallery, finalName);

    while (fs.existsSync(targetPath)) {
      finalName = `${baseName}-${counter}${ext}`;
      targetPath = path.join(__dirname, 'public', 'uploads', gallery, finalName);
      counter++;
    }

    fs.renameSync(file.path, targetPath);
    try {
      const metadata = await sharp(targetPath).metadata();
      newImages.push({
        path: `/uploads/${gallery}/${finalName}`,
        width: metadata.width,
        height: metadata.height
      });
    } catch (err) {
      console.error('Ошибка чтения метаданных:', err);
    }
  }

  galleries[galleryIndex].images.unshift(...newImages);
  fs.writeFileSync(GALLERIES_FILE, JSON.stringify(galleries, null, 2));

  res.json({ success: true, images: newImages });
});

app.post('/rename', (req, res) => {
  const { gallery, oldPath, newName } = req.body;
  const galleryIndex = galleries.findIndex(g => g.name === gallery);
  if (galleryIndex === -1) return res.status(404).json({ success: false, error: 'Галерея не найдена' });
  const image = galleries[galleryIndex].images.find(i => i.path === oldPath);
  if (!image) return res.status(404).json({ success: false, error: 'Изображение не найдено' });
  image.name = newName;
  fs.writeFileSync(GALLERIES_FILE, JSON.stringify(galleries, null, 2));
  res.json({ success: true });
});

app.post('/delete-image', (req, res) => {
  const { gallery, path } = req.body;
  const galleryIndex = galleries.findIndex(g => g.name === gallery);
  if (galleryIndex === -1) return res.status(404).json({ success: false, error: 'Галерея не найдена' });
  const imageIndex = galleries[galleryIndex].images.findIndex(i => i.path === path);
  if (imageIndex === -1) return res.status(404).json({ success: false, error: 'Изображение не найдено' });
  galleries[galleryIndex].images.splice(imageIndex, 1);
  fs.writeFileSync(GALLERIES_FILE, JSON.stringify(galleries, null, 2));
  res.json({ success: true });
});

app.get('/bookmarks', (req, res) => {
  res.json(bookmarks);
});

app.post('/bookmarks', (req, res) => {
  const { title, url, category } = req.body;
  const bookmark = {
    id: Date.now(),
    title,
    url,
    category,
    createdAt: new Date().toISOString()
  };
  bookmarks.push(bookmark);
  fs.writeFileSync(BOOKMARKS_FILE, JSON.stringify(bookmarks, null, 2));
  res.json(bookmark);
});

app.delete('/bookmarks/:id', (req, res) => {
  const id = parseInt(req.params.id);
  bookmarks = bookmarks.filter(bookmark => bookmark.id !== id);
  fs.writeFileSync(BOOKMARKS_FILE, JSON.stringify(bookmarks, null, 2));
  res.json({ message: 'Bookmark deleted' });
});

app.get('/categories', (req, res) => {
  res.json(categories);
});

app.listen(PORT, () => {
  console.log(`✅ Сервер запущен: http://localhost:${PORT}`);
});