'use strict';

/* =========================================================================
   КОНФИГУРАЦИЯ ИГРЫ
   Все игровые параметры вынесены сюда для удобной настройки баланса.
   ========================================================================= */
const CONFIG = {
  // Логическое разрешение игрового поля (canvas), реальный размер на экране
  // подгоняется CSS-трансформацией в resizeStage().
  width: 400,
  height: 700,

  // Физика
  gravity: 0.32,            // ускорение свободного падения (px/кадр^2)
  jumpVelocity: -12.6,      // импульс прыжка при приземлении на платформу
  moveSpeed: 4.4,           // максимальная горизонтальная скорость (px/кадр)
  moveAccel: 0.85,          // ускорение при нажатой клавише
  moveFriction: 0.86,       // затухание скорости без нажатой клавиши

  // Игрок
  playerWidth: 62,
  playerHeight: 100,

  // Платформы-облака
  platformWidth: 78,
  platformHeight: 34,
  platformGapMin: 78,       // минимальное расстояние по вертикали между платформами
  platformGapMax: 150,      // максимальное расстояние по вертикали между платформами
  platformSpawnMargin: 260, // насколько выше видимой области заранее генерировать платформы
  platformDespawnMargin: 140, // насколько ниже экрана удалять платформы

  // Коллекционные предметы
  itemSize: 46,
  itemSpawnChance: 0.35,      // вероятность появления предмета у платформы
  // Каждый вид предмета попадается игроку только один раз за игру —
  // после того как он либо собран, либо пропущен и скрылся с экрана,
  // повторно он уже не появляется.

  // Счёт
  scorePerWorldPixel: 1,      // 1 очко = 1 пиксель подъёма по миру

  // Идентификаторы типов предметов
  itemTypes: ['mash', 'holodec'],
};

const ITEM_INFO = {
  mash: {
    title: 'Мажь на хлеб с арахисом',
    image: 'assets/mash_orig.png',
    desc: 'Мажь на хлеб — это вкусное и питательное блюдо, которое представляет собой мясную пасту или крем, приготовленную из различных видов мяса. Она обладает богатым мясным вкусом и может использоваться как самостоятельное блюдо или как начинка для хлеба, крекеров или тостов.\n\nМажь на хлеб с арахисом — это совершенно новый продукт в линейке Окраины! Он идеально подходит для вкусного и сытного завтрака, а также перекуса в любом месте и в любое время. Ведь под крышкой мы приготовили специальную ложку, которая позволит вашим рукам и ножам оставаться чистыми. Для приготовления использованы отборная свинина и ароматный арахис. Получился совершенно новый продукт, который не похож на классический паштет ни внешне, ни по вкусу.',
  },
  holodec: {
    title: 'Холодец Домашний',
    image: 'assets/holodec_orig.png',
    desc: 'Холодец домашний знают все. Много говядины и свинины, ароматный прозрачный бульон и немного специй — и все это в удобном лотке весом 300 граммов. Вкус холодца умеренный, позволяющий насладиться сочными мясными волокнами. Холодец плотной консистенции, отлично держит форму и будет привлекательно смотреться на праздничном столе. Но не стоит ждать праздника, чтобы побаловать себя замечательным блюдом — холодец домашний одинаково вкусен в любое время суток.',
  },
};

const RECORD_KEY = 'vitaliy_jump_record';

/* =========================================================================
   ЗАГРУЗКА РЕСУРСОВ
   ========================================================================= */
const ASSET_SOURCES = {
  player: 'assets/vitaliy.png',
  background: 'assets/polya.png',
  mash: 'assets/mash.png',
  holodec: 'assets/holodec.png',
  sausage: 'assets/sausage.png',
  cloud1: 'assets/cloud1.png',
  cloud2: 'assets/cloud2.png',
  cloud3: 'assets/cloud3.png',
};

const images = {};

function loadImages(sources) {
  const keys = Object.keys(sources);
  let loaded = 0;
  return new Promise((resolve) => {
    if (keys.length === 0) resolve();
    keys.forEach((key) => {
      const img = new Image();
      img.onload = () => {
        loaded++;
        if (loaded === keys.length) resolve();
      };
      img.onerror = () => {
        loaded++;
        console.error('Не удалось загрузить изображение:', sources[key]);
        if (loaded === keys.length) resolve();
      };
      img.src = sources[key];
      images[key] = img;
    });
  });
}

/* =========================================================================
   ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
   ========================================================================= */
function randRange(min, max) {
  return min + Math.random() * (max - min);
}

function randInt(min, max) {
  return Math.floor(randRange(min, max + 1));
}

function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

/* =========================================================================
   DOM ССЫЛКИ
   ========================================================================= */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const gameFrame = document.getElementById('game-frame');
const startScreen = document.getElementById('start-screen');
const startBtn = document.getElementById('startBtn');
const loadingText = document.getElementById('loadingText');

const itemModal = document.getElementById('item-modal');
const itemTitleEl = document.getElementById('itemTitle');
const itemImageEl = document.getElementById('itemImage');
const itemDescEl = document.getElementById('itemDesc');
const continueBtn = document.getElementById('continueBtn');

const gameoverScreen = document.getElementById('gameover-screen');
const finalScoreEl = document.getElementById('finalScore');
const finalRecordEl = document.getElementById('finalRecord');
const newRecordBadge = document.getElementById('newRecordBadge');
const restartBtn = document.getElementById('restartBtn');

const scoreValueEl = document.getElementById('scoreValue');
const recordValueEl = document.getElementById('recordValue');
const itemsValueEl = document.getElementById('itemsValue');

const touchLeft = document.getElementById('touch-left');
const touchRight = document.getElementById('touch-right');

/* =========================================================================
   МАСШТАБИРОВАНИЕ СЦЕНЫ ПОД ЭКРАН
   ========================================================================= */
function resizeStage() {
  const scale = Math.min(
    window.innerWidth / CONFIG.width,
    window.innerHeight / CONFIG.height
  );
  gameFrame.style.transform = `scale(${scale})`;
}
window.addEventListener('resize', resizeStage);

/* =========================================================================
   СОСТОЯНИЕ ИГРЫ
   ========================================================================= */
const STATE = {
  START: 'start',
  PLAYING: 'playing',
  PAUSED_ITEM: 'paused_item',
  GAME_OVER: 'game_over',
};

let gameState = STATE.START;

let player, platforms, items, cameraTop, score, record, collectedCount;
let spawnedTypes; // Set: виды предметов, уже появлявшиеся в текущей игре
let cloudKeys = ['cloud1', 'cloud2', 'cloud3'];
let itemIdCounter = 0;
let platformIdCounter = 0;

const keys = { left: false, right: false };

/* =========================================================================
   ИНИЦИАЛИЗАЦИЯ / СБРОС ИГРЫ
   ========================================================================= */
function resetGame() {
  cameraTop = 0;
  score = 0;
  collectedCount = 0;
  spawnedTypes = new Set(); // виды предметов, которые уже появлялись в этой игре
  platforms = [];
  items = [];

  player = {
    x: CONFIG.width / 2 - CONFIG.playerWidth / 2,
    y: CONFIG.height - 160,
    vx: 0,
    vy: -6,
    width: CONFIG.playerWidth,
    height: CONFIG.playerHeight,
    facing: 1,
    squash: 1, // визуальный коэффициент "сплющивания" при приземлении
  };

  // Стартовая платформа прямо под игроком
  spawnPlatform(CONFIG.width / 2 - CONFIG.platformWidth / 2, CONFIG.height - 40, false);

  // Заполняем экран платформами вверх от стартовой
  let lastY = CONFIG.height - 40;
  while (lastY > -CONFIG.platformSpawnMargin) {
    lastY -= randRange(CONFIG.platformGapMin, CONFIG.platformGapMax);
    spawnPlatform(
      randRange(10, CONFIG.width - CONFIG.platformWidth - 10),
      lastY,
      true
    );
  }

  record = Number(localStorage.getItem(RECORD_KEY)) || 0;
  updateHud();
}

function spawnPlatform(x, y, allowItem) {
  const platform = {
    id: platformIdCounter++,
    x, y,
    width: CONFIG.platformWidth,
    height: CONFIG.platformHeight,
    cloudKey: cloudKeys[randInt(0, cloudKeys.length - 1)],
  };
  platforms.push(platform);

  if (allowItem) {
    maybeAttachItem(platform);
  }
  return platform;
}

function maybeAttachItem(platform) {
  // Каждый вид предмета может появиться в игре только один раз.
  // Как только он заспавнен (собран он будет или пропущен — неважно),
  // повторно этот вид больше не генерируется.
  const available = CONFIG.itemTypes.filter((t) => !spawnedTypes.has(t));
  if (available.length === 0) return;
  if (Math.random() >= CONFIG.itemSpawnChance) return;

  const type = available[randInt(0, available.length - 1)];
  spawnedTypes.add(type);

  items.push({
    id: itemIdCounter++,
    type,
    x: platform.x + platform.width / 2 - CONFIG.itemSize / 2 + randRange(-14, 14),
    y: platform.y - CONFIG.itemSize - 18,
    width: CONFIG.itemSize,
    height: CONFIG.itemSize,
    collected: false,
    bobPhase: Math.random() * Math.PI * 2,
  });
}

/* =========================================================================
   ГЕНЕРАЦИЯ И УДАЛЕНИЕ ПЛАТФОРМ ПО МЕРЕ ПОДЪЁМА
   ========================================================================= */
function updatePlatforms() {
  // Находим самую верхнюю (наименьший y) платформу
  let topY = CONFIG.height;
  for (const p of platforms) {
    if (p.y < topY) topY = p.y;
  }

  // Пока верхняя платформа недостаточно высоко над видимой областью — добавляем новые
  const visibleTop = cameraTop;
  while (topY > visibleTop - CONFIG.platformSpawnMargin) {
    topY -= randRange(CONFIG.platformGapMin, CONFIG.platformGapMax);
    spawnPlatform(randRange(10, CONFIG.width - CONFIG.platformWidth - 10), topY, true);
  }

  // Удаляем платформы, ушедшие далеко за нижнюю границу экрана
  const despawnBelow = cameraTop + CONFIG.height + CONFIG.platformDespawnMargin;
  platforms = platforms.filter((p) => p.y < despawnBelow);
}

function updateItems() {
  const despawnBelow = cameraTop + CONFIG.height + CONFIG.platformDespawnMargin;
  // Пропущенный (не собранный) предмет просто исчезает — его вид уже
  // отмечен как использованный и повторно в игре не появится.
  items = items.filter((item) => !item.collected && item.y <= despawnBelow);
}

/* =========================================================================
   ФИЗИКА ИГРОКА
   ========================================================================= */
function updatePlayer() {
  // Горизонтальное управление с небольшим ускорением/торможением
  if (keys.left && !keys.right) {
    player.vx = Math.max(player.vx - CONFIG.moveAccel, -CONFIG.moveSpeed);
    player.facing = -1;
  } else if (keys.right && !keys.left) {
    player.vx = Math.min(player.vx + CONFIG.moveAccel, CONFIG.moveSpeed);
    player.facing = 1;
  } else {
    player.vx *= CONFIG.moveFriction;
    if (Math.abs(player.vx) < 0.05) player.vx = 0;
  }

  player.x += player.vx;

  // Прохождение сквозь боковые границы экрана (как в оригинальном Doodle Jump)
  if (player.x + player.width < 0) player.x = CONFIG.width;
  if (player.x > CONFIG.width) player.x = -player.width;

  // Гравитация
  const prevBottom = player.y + player.height;
  player.vy += CONFIG.gravity;
  player.y += player.vy;
  const newBottom = player.y + player.height;

  // Приземление: только при падении (vy > 0) и только сверху на платформу
  if (player.vy > 0) {
    for (const platform of platforms) {
      const platformTop = platform.y;
      const withinX =
        player.x + player.width * 0.28 < platform.x + platform.width &&
        player.x + player.width * 0.72 > platform.x;
      const crossedTop = prevBottom <= platformTop + 1 && newBottom >= platformTop;

      if (withinX && crossedTop) {
        player.y = platformTop - player.height;
        player.vy = CONFIG.jumpVelocity;
        player.squash = 0.7; // визуальный эффект приземления: кратковременное сплющивание
        break;
      }
    }
  }

  // Плавное восстановление после эффекта приземления
  player.squash += (1 - player.squash) * 0.25;

  // Камера следует за игроком вверх и никогда не опускается обратно
  const followThreshold = CONFIG.height * 0.42;
  const desiredCameraTop = player.y - followThreshold;
  if (desiredCameraTop < cameraTop) {
    cameraTop = desiredCameraTop;
  }

  // Счёт растёт только за подъём вверх (монотонно неубывающая величина)
  const climbed = Math.max(0, -cameraTop);
  score = Math.floor(climbed * CONFIG.scorePerWorldPixel);
}

function checkItemCollisions() {
  for (const item of items) {
    if (item.collected) continue;
    if (
      rectsOverlap(
        player.x, player.y, player.width, player.height,
        item.x, item.y, item.width, item.height
      )
    ) {
      item.collected = true;
      collectedCount++;
      showItemModal(item.type);
      break; // одновременно обрабатываем только один предмет
    }
  }
}

function checkGameOver() {
  const screenY = player.y - cameraTop;
  if (screenY > CONFIG.height + player.height) {
    triggerGameOver();
  }
}

/* =========================================================================
   ОТРИСОВКА
   ========================================================================= */
function drawBackground() {
  const bg = images.background;
  if (!bg || !bg.width) return;
  // Фон статичен и не привязан к позиции камеры — просто заполняет экран.
  ctx.drawImage(bg, 0, 0, CONFIG.width, CONFIG.height);
}

function drawPlatforms() {
  for (const p of platforms) {
    const screenY = p.y - cameraTop;
    if (screenY > CONFIG.height || screenY + p.height < 0) continue;
    const img = images[p.cloudKey];
    if (img && img.width) {
      ctx.drawImage(img, p.x, screenY, p.width, p.height);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(p.x, screenY, p.width, p.height);
    }
  }
}

function drawItems() {
  const t = performance.now() / 500;
  for (const item of items) {
    if (item.collected) continue;
    const screenY = item.y - cameraTop + Math.sin(t + item.bobPhase) * 4;
    if (screenY > CONFIG.height || screenY < -item.height) continue;
    const img = images[item.type];
    if (img && img.width) {
      ctx.drawImage(img, item.x, screenY, item.width, item.height);
    }
  }
}

function drawPlayer() {
  const screenY = player.y - cameraTop;
  const img = images.player;
  ctx.save();

  const cx = player.x + player.width / 2;
  const cy = screenY + player.height;
  ctx.translate(cx, cy);
  ctx.scale(player.facing * (2 - player.squash), player.squash);
  ctx.translate(-player.width / 2, -player.height);

  if (img && img.width) {
    ctx.drawImage(img, 0, 0, player.width, player.height);
  } else {
    ctx.fillStyle = '#e0a15c';
    ctx.fillRect(0, 0, player.width, player.height);
  }
  ctx.restore();
}

function render() {
  ctx.clearRect(0, 0, CONFIG.width, CONFIG.height);
  drawBackground();
  drawPlatforms();
  drawItems();
  drawPlayer();
}

/* =========================================================================
   HUD
   ========================================================================= */
function updateHud() {
  scoreValueEl.textContent = score;
  recordValueEl.textContent = record;
  itemsValueEl.textContent = collectedCount;
}

/* =========================================================================
   МОДАЛЬНОЕ ОКНО ПРЕДМЕТА
   ========================================================================= */
function showItemModal(type) {
  gameState = STATE.PAUSED_ITEM;
  const info = ITEM_INFO[type];
  itemTitleEl.textContent = info.title;
  itemImageEl.src = info.image;
  itemImageEl.alt = info.title;
  itemDescEl.textContent = info.desc;
  itemModal.classList.remove('hidden');
  updateHud();
}

function closeItemModal() {
  itemModal.classList.add('hidden');
  gameState = STATE.PLAYING;
  lastFrameTime = performance.now(); // избегаем скачка dt после паузы
}

/* =========================================================================
   GAME OVER
   ========================================================================= */
function triggerGameOver() {
  gameState = STATE.GAME_OVER;

  let isNewRecord = false;
  if (score > record) {
    record = score;
    localStorage.setItem(RECORD_KEY, String(record));
    isNewRecord = true;
  }

  finalScoreEl.textContent = score;
  finalRecordEl.textContent = record;
  newRecordBadge.classList.toggle('hidden', !isNewRecord);

  updateHud();
  gameoverScreen.classList.remove('hidden');
}

/* =========================================================================
   ОСНОВНОЙ ЦИКЛ
   ========================================================================= */
let lastFrameTime = 0;

function gameLoop(timestamp) {
  requestAnimationFrame(gameLoop);

  if (gameState !== STATE.PLAYING) {
    return;
  }

  updatePlayer();
  updatePlatforms();
  updateItems();
  checkItemCollisions();
  checkGameOver();
  updateHud();
  render();
}

/* =========================================================================
   УПРАВЛЕНИЕ (клавиатура + сенсор)
   ========================================================================= */
window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A' || e.key === 'ф' || e.key === 'Ф') {
    keys.left = true;
  }
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D' || e.key === 'в' || e.key === 'В') {
    keys.right = true;
  }
});
window.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A' || e.key === 'ф' || e.key === 'Ф') {
    keys.left = false;
  }
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D' || e.key === 'в' || e.key === 'В') {
    keys.right = false;
  }
});

function bindTouchZone(el, key) {
  const start = (e) => { e.preventDefault(); keys[key] = true; };
  const end = (e) => { e.preventDefault(); keys[key] = false; };
  el.addEventListener('touchstart', start, { passive: false });
  el.addEventListener('touchend', end, { passive: false });
  el.addEventListener('touchcancel', end, { passive: false });
  el.addEventListener('mousedown', start);
  el.addEventListener('mouseup', end);
  el.addEventListener('mouseleave', end);
}
bindTouchZone(touchLeft, 'left');
bindTouchZone(touchRight, 'right');

/* =========================================================================
   КНОПКИ / ЭКРАНЫ
   ========================================================================= */
function startGame() {
  resetGame();
  gameState = STATE.PLAYING;
  startScreen.classList.add('hidden');
  gameoverScreen.classList.add('hidden');
  itemModal.classList.add('hidden');
  lastFrameTime = performance.now();
}

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
continueBtn.addEventListener('click', closeItemModal);

/* =========================================================================
   СТАРТ
   ========================================================================= */
resizeStage();
record = Number(localStorage.getItem(RECORD_KEY)) || 0;
recordValueEl.textContent = record;

loadImages(ASSET_SOURCES).then(() => {
  loadingText.classList.add('ready');
  requestAnimationFrame(gameLoop);
});
