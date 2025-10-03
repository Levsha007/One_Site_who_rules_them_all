// === Red Matrix Rain Effect ===
const canvas = document.getElementById('matrix');
const ctx = canvas.getContext('2d');

// 🌶️ Цвета: красно-оранжевая палитра
const redShades = [
    '#c0392b', '#e74c3c', '#d35400', 
    '#e67e22', '#f39c12', '#f1c40f',
    '#b34e2a', '#9b3f22', '#d95e2c'
];

// Символы
const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+{}[]|;:,.<>?';
const fontSize = 16;
let drops = [];
let columns;

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    columns = Math.floor(canvas.width / fontSize);
    drops = Array.from({ length: columns }, () => Math.floor(Math.random() * -100)); // за экраном
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

function draw() {
    // Частичное затухание (оставляет след)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = `${fontSize}px monospace`;
    ctx.textAlign = 'center';

    for (let i = 0; i < drops.length; i++) {
    // Случайный символ
    const char = characters[Math.floor(Math.random() * characters.length)];
    // Случайный оттенок из красной палитры
    const color = redShades[Math.floor(Math.random() * redShades.length)];
    ctx.fillStyle = color;

    // Позиция
    const x = i * fontSize + fontSize / 2;
    const y = drops[i] * fontSize;

    ctx.fillText(char, x, y);

    // Пропуски и сброс
    if (Math.random() > 0.8) continue;
    drops[i]++;
    if (y > canvas.height && Math.random() > 0.95) {
        drops[i] = 0;
    }
    }

    requestAnimationFrame(draw);
}

draw();

// === Тема (на всякий случай, если понадобится потом) ===
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'light') {
    document.body.setAttribute('data-theme', 'light');
} else {
    document.body.removeAttribute('data-theme');
}