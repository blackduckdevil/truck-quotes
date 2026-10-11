const quoteEl = document.getElementById("quote");
const button = document.getElementById("random-btn");
const catContainer = document.getElementById("categories");

const categoryLabels = {
    care: "ห่วงใย",
    love: "ความรัก",
    notice: "ประกาศ",
    funny: "ตลก"
};

let catButtons = [];
let curQuote = null;
let isAnimating = false;
let currentCategory = "care";
let quotes = [];

const favBtn = document.getElementById("fav-btn");
const favList = document.getElementById("fav-list");
const favCount = document.getElementById("fav-count");

const copyBtn = document.getElementById("copy-btn");

const STORAGE_KEY = "truck-quotes-favorites";
let favorites = [];

const canvas = document.getElementById("sticker");
const ctx = canvas.getContext('2d');

const segmenter = new Intl.Segmenter('th', { granularity: 'word' });

const palettes = [
    { bg: '#FFD23F', text: '#1B1B1B' },  // เหลือง-ดำ
    { bg: '#1B1B1B', text: '#FFD23F' },  // ดำ-เหลือง
    { bg: '#E63946', text: '#FFFFFF' },  // แดง-ขาว
    { bg: '#2A9D8F', text: '#FFFFFF' },  // เขียว-ขาว
    { bg: '#F1FAEE', text: '#1D3557' },  // ครีม-กรมท่า
];
let curPalette = null;

function pickPalette() {
    let next;
    do {
        next = palettes[Math.floor(Math.random() * palettes.length)];
    } while (next === curPalette && palettes.length > 1);
    curPalette = next;
    return next;
}

function splitWords(text) {
    return [...segmenter.segment(text)].map(s => s.segment);
}

function wrapText(text, maxWidth) {
    const words = splitWords(text);
    const lines = [];
    let line = "";

    for (const word of words) {
        const test = line + word;
        if (ctx.measureText(test).width > maxWidth && line !== "") {
            lines.push(line.trim());
            line = word.trimStart();
        } else {
            line = test;
        }
    }
    if (line.trim() !== '') lines.push(line.trim());
    return lines;
}

function fitText(text, maxWidth, maxLines) {
    let size = 120;
    while (size > 30) {
        ctx.font = `600 ${size}px Kanit`;
        const lines = wrapText(text, maxWidth);
        const widest = Math.max(...lines.map(l => ctx.measureText(l).width));
        if (lines.length <= maxLines && widest <= maxWidth) {
            return { lines, size };
        }
        size -= 6;
    }
    ctx.font = `600 ${size}px Kanit`;
    return { lines: wrapText(text, maxWidth), size };
}

function drawQuote(text, palette) {
    const maxWidth = canvas.width - 200;
    const { lines, size } = fitText(text, maxWidth, 5);
    const lineHeight = size * 1.5;
    const totalHeight = lines.length * lineHeight;

    ctx.fillStyle = palette.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let y = (canvas.height - totalHeight) / 2 + lineHeight / 2;
    for (const line of lines) {
        ctx.fillText(line, canvas.width / 2, y);
        y += lineHeight;
    }

    const watermark = "@funnytruckstickers";
    ctx.font = `400 36px Kanit`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(watermark, canvas.width - 75, canvas.height - 55);
}

function drawBackground(palette) {
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = palette.text;
    ctx.lineWidth = 24;
    ctx.beginPath();
    ctx.roundRect(40, 40, canvas.width - 80, canvas.height - 80, 60);
    ctx.stroke();
}

async function renderSticker(text) {
    await document.fonts.load('600 60px Kanit');
    await document.fonts.load('400 36px Kanit');
    const palette = pickPalette();
    drawBackground(palette);
    drawQuote(text, palette);
}

function makeFileName(text) {
    const firstWords = splitWords(text).slice(0, 4).join('');
    const safe = firstWords
        .replace(/[\\/:*?"<>|]/g, '')   // ลบตัวต้องห้าม
        .trim()
        .replace(/\s+/g, '-');           // ช่องว่างกลายเป็น -
    return (safe || 'sticker') + '.png';
}

function loadFavorites() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        favorites = saved ? JSON.parse(saved) : [];
    } catch (error) {
        console.error("อ่านรายการโปรดไม่ได้:", error);
        favorites = [];
    }
}

function saveFavorites() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
    } catch (error) {
        console.error("บันทึกรายการโปรดไม่ได้:", error);
    }
}

function isFavorite(quote) {
    return favorites.some(fav => fav.text === quote.text);
}

function removeFavorite(text) {
    favorites = favorites.filter(fav => fav.text !== text);
    saveFavorites();
    renderFavorites();
    updateFavButton();
}

function toggleFavorite() {
    if (!curQuote) return;

    if (isFavorite(curQuote)) {
        removeFavorite(curQuote.text);
        return;
    }
    favorites.push({ text: curQuote.text, category: curQuote.category });
    saveFavorites();
    renderFavorites();
    updateFavButton();
}

function updateFavButton() {
    const saved = curQuote !== null && isFavorite(curQuote);
    favBtn.textContent = saved ? "♥" : "♡";
    favBtn.classList.toggle("saved", saved);
    favBtn.disabled = curQuote === null;
}

function renderFavorites() {
    favList.innerHTML = "";
    favCount.textContent = `(${favorites.length})`;

    if (favorites.length === 0) {
        const li = document.createElement("li");
        li.className = "fav-empty";
        li.textContent = "ยังไม่มีคำคมโปรด กด ♡ เพื่อเก็บไว้";
        favList.appendChild(li);
        return;
    }

    favorites.forEach(fav => {
        const li = document.createElement("li");
        li.className = "fav-item";

        const text = document.createElement("span");
        text.textContent = fav.text;
        text.className = "fav-text";
        text.addEventListener("click", () => displayQuote(fav));
        
        const removeBtn = document.createElement("button");
        removeBtn.className = "fav-remove";
        removeBtn.textContent = "x";
        removeBtn.setAttribute("aria-label", "ลบออกจากรายการโปรด");
        removeBtn.addEventListener("click", () => removeFavorite(fav.text));

        li.append(text, removeBtn);
        favList.appendChild(li);
    });

}

async function copyQuote() {
    if (!curQuote) return;

    let ok = false;

    // แผน A: วิธีใหม่
    try {
        if (navigator.clipboard) {
            await navigator.clipboard.writeText(curQuote.text);
            ok = true;
        }
    } catch (error) {
        console.warn("คัดลอกแบบใหม่ไม่ได้ ลองแบบสำรอง:", error);
    }

    // แผน B: ถ้าแผน A ไม่สำเร็จ
    if (!ok) {
        ok = fallbackCopy(curQuote.text);
    }

    copyBtn.textContent = ok ? "คัดลอกแล้ว ✓" : "คัดลอกไม่ได้";

    setTimeout(() => {
        copyBtn.textContent = "คัดลอก";
    }, 1500);
}

async function loadQuotes() {
    try {
        const response = await fetch("quotes.json");
        if (!response.ok) {
            throw new Error("โหลดไฟล์ไม่สำเร็จ: " + response.status);
        }
        quotes = await response.json();
        button.disabled = false;
        renderCategoryButtons();
        showRandomQuote();
    } catch (error) {
        console.error("Error loading quotes:", error);
        quoteEl.textContent = "โหลดคำคมไม่ได้ ลองรีเฟรชอีกครั้งนะ";
    }
}

function renderCategoryButtons() {
    const categories = [...new Set(quotes.map(q => q.category))];

    if (!categories.includes(currentCategory)) {
        currentCategory = categories[0];
    }

    catContainer.innerHTML = "";

    categories.forEach(cat => {
        const btn = document.createElement("button");
        btn.className = "cat-btn";
        btn.dataset.category = cat;
        const label = categoryLabels[cat] ?? cat;
        const count = quotes.filter(q => q.category === cat).length;
        btn.textContent = `${label} (${count})`;

        if (cat === currentCategory) {
            btn.classList.add("active");
        }

        btn.addEventListener("click", () => selectCategory(btn));
        catContainer.appendChild(btn);
    });

    catButtons = catContainer.querySelectorAll(".cat-btn");
}

function selectCategory(btn) {
    if (isAnimating) return;
    if (btn.dataset.category === currentCategory) return;

    currentCategory = btn.dataset.category;

    catButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    showRandomQuote();
}

function displayQuote(quote) {
    if (isAnimating) return;

    curQuote = quote;

    isAnimating = true;
    button.disabled = true;
    catButtons.forEach(b => b.disabled = true);
    favBtn.disabled = true;
    quoteEl.classList.add("hide");

    setTimeout(() => {
        quoteEl.textContent = curQuote.text;
        quoteEl.classList.remove("hide");
        updateFavButton();

        if (curQuote.text !== '') renderSticker(curQuote.text);

        button.disabled = false;
        catButtons.forEach(b => b.disabled = false);
        isAnimating = false;
    }, 300);

}

function showRandomQuote() {
    const pool = quotes.filter(q => q.category === currentCategory);

    if (pool.length === 0) {
        quoteEl.textContent = "ไม่มีคำคมในหมวดนี้";
        curQuote = null;
        updateFavButton();
        return;
    }
    if (isAnimating) return;

    const index = Math.floor(Math.random()*pool.length);

    if (pool.length > 1 && curQuote && pool[index].text === curQuote.text) {
        showRandomQuote();
        return;
    }
    displayQuote(pool[index]);
}

document.querySelector('#download-btn').addEventListener('click', () => {
    canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = curQuote ? makeFileName(curQuote.text) : 'sticker.png';
        a.click();
        URL.revokeObjectURL(url);
    }, 'image/png');
});

button.addEventListener("click", showRandomQuote);
favBtn.addEventListener("click", toggleFavorite);
copyBtn.addEventListener("click", copyQuote);

loadFavorites();
renderFavorites();
loadQuotes();