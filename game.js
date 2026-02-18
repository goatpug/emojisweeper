// ── Emojisweeper — game.js ──────────────────────────────────────────────────

// ── Config ──────────────────────────────────────────────────────────────────

const DIFFICULTIES = {
  easy: {
    rows: 16, cols: 16, hp: 30, maxLevel: 5,
    emojis: [0, 10, 8, 6, 4, 2], // index = emoji level
  },
  normal: {
    rows: 16, cols: 30, hp: 10, maxLevel: 5,
    emojis: [0, 33, 27, 20, 13, 6],
  },
  huge: {
    rows: 25, cols: 50, hp: 30, maxLevel: 9,
    emojis: [0, 52, 46, 40, 36, 30, 24, 18, 13, 1],
  },
};

// XP thresholds (cumulative total XP) to reach player level N.
// 999999 = gate placeholder — blocked until gateUnlocked flag is set.
// After gate: thresholds must exceed XP earned from clearing gate emojis.
//   Easy gate clears lv1-3: 10×1 + 8×2 + 6×4 = 50 XP → post-gate threshold 58
//   Normal gate clears lv1-3: 33×1 + 27×2 + 20×4 = 167 XP → post-gate threshold 175
//   Huge gate clears lv1-5: 52+92+160+288+480 = 1072 XP → post-gate threshold 1104
const XP_THRESHOLDS = {
  easy:   [0, 0,  3,  9,  999999,  58,  9999],
  normal: [0, 0,  3,  9,  999999, 175,  9999],
  huge:   [0, 0,  3,  9,  22,  50, 999999, 1104, 1168, 1296, 9999],
};

// Emoji themes
const THEMES = {
  fruit:   ['', '🍒', '🍏', '🍌', '🍍', '🍉'],
  birds:   ['', '🐤', '🦜', '🦅', '🐧', '🦩'],
  animals: ['', '🐒', '🐅', '🦍', '🦒', '🐘'],
  huge9:   ['', '🐭', '🐇', '🐈', '🦊', '🐺', '🦁', '🐘', '🦏', '🦣'],
};

const GATE_LEVEL = { easy: 3, normal: 3, huge: 5 }; // clear all up to this level to unlock next

// ── State ───────────────────────────────────────────────────────────────────

let G = {}; // game state

function initState(difficulty) {
  const cfg = DIFFICULTIES[difficulty];
  const theme = difficulty === 'huge' ? THEMES.huge9 : THEMES.fruit;

  G = {
    difficulty,
    cfg,
    theme,
    rows: cfg.rows,
    cols: cfg.cols,
    board: [],          // 2D array of cell objects
    state: 'new',       // 'new' | 'playing' | 'paused' | 'won' | 'dead'
    firstClick: true,

    // Player stats
    hp: cfg.hp,
    maxHp: cfg.hp,
    playerLevel: 1,
    xp: 0,
    damageTaken: 0,

    // Counters
    clicks: 0,
    remainingEmojis: [...cfg.emojis], // index = emoji level, value = count remaining
    sweptByLevel: new Array(cfg.maxLevel + 1).fill(0),
    totalByLevel: [...cfg.emojis],

    // Gate
    gateLevel: GATE_LEVEL[difficulty],
    gateUnlocked: false,

    // Timer
    elapsed: 0,
    timerInterval: null,
    timerStart: null,

    // UI
    selectedFlagLevel: null,  // for mobile marking
    hoveredTileIdx: null,

    // Score tracking
    totalEmojiCount: cfg.emojis.reduce((s, c) => s + c, 0),
  };
}

// ── Board Generation ─────────────────────────────────────────────────────────

function createEmptyBoard(rows, cols) {
  const board = [];
  for (let r = 0; r < rows; r++) {
    board.push([]);
    for (let c = 0; c < cols; c++) {
      board[r].push({
        r, c,
        emojiLevel: 0,   // 0 = safe tile
        revealed: false,
        flagged: 0,      // 0 = none, N = flagged as level N
        adjacentSum: 0,
        el: null,        // DOM element
        sumView: false,  // for revealed emoji tiles toggled to show sum
      });
    }
  }
  return board;
}

function placeEmojis(board, rows, cols, cfg, avoidR, avoidC) {
  // Collect all cells except the avoided one and its neighbors
  const avoid = new Set();
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const nr = avoidR + dr, nc = avoidC + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
        avoid.add(nr * cols + nc);
      }
    }
  }

  const candidates = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!avoid.has(r * cols + c)) candidates.push([r, c]);
    }
  }

  // Shuffle candidates
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  let idx = 0;
  for (let lvl = 1; lvl <= cfg.maxLevel; lvl++) {
    for (let k = 0; k < cfg.emojis[lvl]; k++) {
      if (idx >= candidates.length) break;
      const [r, c] = candidates[idx++];
      board[r][c].emojiLevel = lvl;
    }
  }
}

function computeAdjacentSums(board, rows, cols) {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r][c].emojiLevel > 0) continue;
      let sum = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
            sum += board[nr][nc].emojiLevel;
          }
        }
      }
      board[r][c].adjacentSum = sum;
    }
  }
}

function startNewGame() {
  const difficulty = document.getElementById('difficulty-select').value;
  clearInterval(G.timerInterval);
  initState(difficulty);

  G.board = createEmptyBoard(G.rows, G.cols);
  // Emojis placed on first click (for safety guarantee)

  G.state = 'new';
  renderBoard();
  renderLegend();
  updateTopBar();
  updateGateBanner();
  document.getElementById('pause-overlay').classList.remove('visible');
  document.getElementById('modal-overlay').classList.remove('visible');
  document.getElementById('pause-btn').textContent = '⏸';
}

// ── Rendering ────────────────────────────────────────────────────────────────

function renderBoard() {
  const grid = document.getElementById('grid');
  grid.style.gridTemplateColumns = `repeat(${G.cols}, 32px)`;
  grid.innerHTML = '';

  for (let r = 0; r < G.rows; r++) {
    for (let c = 0; c < G.cols; c++) {
      const cell = G.board[r][c];
      const tile = document.createElement('div');
      tile.className = 'tile hidden';
      tile.dataset.r = r;
      tile.dataset.c = c;

      tile.addEventListener('click', onTileClick);
      tile.addEventListener('contextmenu', onTileRightClick);
      tile.addEventListener('mouseenter', () => { G.hoveredTileIdx = r * G.cols + c; });
      tile.addEventListener('mouseleave', () => { G.hoveredTileIdx = null; });

      cell.el = tile;
      grid.appendChild(tile);
    }
  }
}

function updateTileEl(cell) {
  const t = cell.el;
  if (!t) return;
  t.className = 'tile';
  t.textContent = '';
  delete t.dataset.n;

  if (!cell.revealed) {
    if (cell.flagged) {
      t.classList.add('flagged');
      const isSafe = cell.flagged <= G.playerLevel;
      t.classList.add(isSafe ? 'safe-flag' : 'danger-flag');
      t.textContent = cell.flagged;
    } else {
      t.classList.add('hidden');
    }
    return;
  }

  // Revealed
  if (cell.emojiLevel > 0) {
    t.classList.add('revealed', 'emoji-tile');
    if (cell.sumView) {
      t.classList.add('sum-view');
      const n = cell.adjacentSum;
      t.dataset.n = n <= 12 ? String(n) : 'hi';
      t.textContent = n || '0';
    } else {
      t.textContent = G.theme[cell.emojiLevel] || '?';
    }
  } else {
    t.classList.add('revealed');
    const n = cell.adjacentSum;
    t.dataset.n = n <= 12 ? String(n) : 'hi';
    t.textContent = n > 0 ? n : '';
  }
}

function renderLegend() {
  const bar = document.getElementById('legend-bar');
  bar.innerHTML = '';
  for (let lvl = 1; lvl <= G.cfg.maxLevel; lvl++) {
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.dataset.level = lvl;
    const isSafe = lvl <= G.playerLevel;
    item.classList.add(isSafe ? 'safe' : 'danger');
    if (G.selectedFlagLevel === lvl) item.classList.add('selected');

    const remaining = G.remainingEmojis[lvl];
    const total = G.totalByLevel[lvl];

    item.innerHTML = `
      <span class="legend-level">${lvl}</span>
      <span class="legend-emoji">${G.theme[lvl]}</span>
      <span class="legend-count${remaining === 0 ? ' zero' : ''}">${remaining}/${total}</span>
    `;
    item.addEventListener('click', () => onLegendClick(lvl));
    bar.appendChild(item);
  }
}

function updateLegendCounts() {
  const items = document.querySelectorAll('.legend-item');
  items.forEach(item => {
    const lvl = parseInt(item.dataset.level);
    const remaining = G.remainingEmojis[lvl];
    const total = G.totalByLevel[lvl];
    const countEl = item.querySelector('.legend-count');
    if (countEl) {
      countEl.textContent = `${remaining}/${total}`;
      countEl.className = 'legend-count' + (remaining === 0 ? ' zero' : '');
    }
    const isSafe = lvl <= G.playerLevel;
    item.classList.remove('safe', 'danger', 'selected');
    item.classList.add(isSafe ? 'safe' : 'danger');
    if (G.selectedFlagLevel === lvl) item.classList.add('selected');
  });
}

function updateTopBar() {
  document.getElementById('level-emoji').textContent = G.theme[G.playerLevel] || '?';
  document.getElementById('level-val').textContent = G.playerLevel;

  const hpPct = Math.max(0, G.hp / G.maxHp * 100);
  document.getElementById('hp-bar-fill').style.width = hpPct + '%';
  document.getElementById('hp-text').textContent = `${G.hp} / ${G.maxHp}`;
  document.getElementById('hp-bar-fill').classList.toggle('low', hpPct <= 25);

  const thresholds = XP_THRESHOLDS[G.difficulty];
  const xpNeeded = thresholds[G.playerLevel + 1] ?? 9999;
  const xpThis = thresholds[G.playerLevel] ?? 0;
  const xpPct = xpNeeded === 999999 ? 99 : Math.min(100, (G.xp - xpThis) / (xpNeeded - xpThis) * 100);
  document.getElementById('xp-bar-fill').style.width = xpPct + '%';
  document.getElementById('xp-text').textContent = `${G.xp} / ${xpNeeded === 999999 ? '🔒' : xpNeeded}`;
}

function updateGateBanner() {
  const banner = document.getElementById('gate-banner');
  if (G.gateUnlocked || G.state === 'won' || G.state === 'dead') {
    banner.classList.remove('visible');
    return;
  }

  const gateLevel = G.gateLevel;
  // Show banner only when player has reached the level that hits the gate
  if (G.playerLevel < gateLevel) {
    banner.classList.remove('visible');
    return;
  }

  // We're at the gate level — count how many gate-eligible emojis remain
  let remaining = 0, total = 0;
  for (let lvl = 1; lvl <= gateLevel; lvl++) {
    remaining += G.remainingEmojis[lvl];
    total += G.totalByLevel[lvl];
  }
  const swept = total - remaining;
  banner.classList.add('visible');
  document.getElementById('gate-text').textContent =
    `Clear all Level 1–${gateLevel} emojis to unlock Level ${gateLevel + 1}`;
  document.getElementById('gate-count').textContent = `${swept} / ${total}`;
  document.getElementById('gate-progress-fill').style.width = (total > 0 ? swept / total * 100 : 0) + '%';
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ── Input Handling ────────────────────────────────────────────────────────────

function onTileClick(e) {
  e.preventDefault();
  if (G.state === 'paused' || G.state === 'won' || G.state === 'dead') return;

  const r = parseInt(e.currentTarget.dataset.r);
  const c = parseInt(e.currentTarget.dataset.c);
  const cell = G.board[r][c];

  // If tile is revealed and is an emoji, toggle sum view
  if (cell.revealed && cell.emojiLevel > 0) {
    cell.sumView = !cell.sumView;
    updateTileEl(cell);
    return;
  }
  if (cell.revealed) return;

  // Mobile: if a flag level is selected, place flag instead of reveal
  if (G.selectedFlagLevel !== null) {
    placeFlagOnCell(cell, G.selectedFlagLevel);
    G.selectedFlagLevel = null;
    updateLegendCounts();
    return;
  }

  // Safety: block reveal if tile is flagged at a dangerous level
  if (cell.flagged > G.playerLevel) {
    showToast('⚠️ Marked as dangerous — unflag first', 'damage');
    return;
  }

  revealCell(r, c);
}

function onTileRightClick(e) {
  e.preventDefault();
  if (G.state === 'paused' || G.state === 'won' || G.state === 'dead') return;

  const r = parseInt(e.currentTarget.dataset.r);
  const c = parseInt(e.currentTarget.dataset.c);
  const cell = G.board[r][c];
  if (cell.revealed) return;

  showFlagPopup(e.clientX, e.clientY, cell);
}

document.addEventListener('keydown', (e) => {
  if (G.state === 'paused' || G.state === 'won' || G.state === 'dead') return;
  const key = e.key;
  if ((key >= '0' && key <= '9') || key === 'Delete' || key === 'Backspace') {
    if (G.hoveredTileIdx !== null) {
      const r = Math.floor(G.hoveredTileIdx / G.cols);
      const c = G.hoveredTileIdx % G.cols;
      const cell = G.board[r][c];
      if (!cell.revealed) {
        const lvl = (key === 'Delete' || key === 'Backspace' || key === '0') ? 0 : parseInt(key);
        if (lvl === 0) {
          placeFlagOnCell(cell, 0);
        } else if (lvl <= G.cfg.maxLevel) {
          placeFlagOnCell(cell, lvl);
        }
        updateLegendCounts();
      }
    }
  }
});

function onLegendClick(lvl) {
  if (G.state !== 'playing' && G.state !== 'new') return;
  G.selectedFlagLevel = G.selectedFlagLevel === lvl ? null : lvl;
  updateLegendCounts();
}

function placeFlagOnCell(cell, lvl) {
  cell.flagged = lvl;
  updateTileEl(cell);
}

// ── Flag Popup ────────────────────────────────────────────────────────────────

let flagPopupCell = null;

function showFlagPopup(x, y, cell) {
  flagPopupCell = cell;
  const popup = document.getElementById('flag-popup');
  popup.innerHTML = '';

  // Options: levels above player level (dangerous), plus clear
  for (let lvl = G.playerLevel + 1; lvl <= G.cfg.maxLevel; lvl++) {
    const opt = document.createElement('div');
    opt.className = 'flag-option danger-option';
    opt.innerHTML = `<span class="fo-emoji">${G.theme[lvl]}</span><span class="fo-label">Level ${lvl}</span>`;
    opt.addEventListener('click', () => { placeFlagOnCell(cell, lvl); updateLegendCounts(); hideFlagPopup(); });
    popup.appendChild(opt);
  }

  // Also allow flagging safe levels for organizational purposes
  if (G.playerLevel > 1) {
    for (let lvl = 1; lvl <= G.playerLevel; lvl++) {
      const opt = document.createElement('div');
      opt.className = 'flag-option';
      opt.innerHTML = `<span class="fo-emoji">${G.theme[lvl]}</span><span class="fo-label">Level ${lvl} (safe)</span>`;
      opt.addEventListener('click', () => { placeFlagOnCell(cell, lvl); updateLegendCounts(); hideFlagPopup(); });
      popup.appendChild(opt);
    }
  }

  if (cell.flagged) {
    const sep = document.createElement('div'); sep.className = 'flag-popup-sep'; popup.appendChild(sep);
    const clear = document.createElement('div');
    clear.className = 'flag-option clear-option';
    clear.innerHTML = `<span class="fo-emoji">✕</span><span class="fo-label">Clear flag</span>`;
    clear.addEventListener('click', () => { placeFlagOnCell(cell, 0); updateLegendCounts(); hideFlagPopup(); });
    popup.appendChild(clear);
  }

  // Position popup
  const pw = 140, ph = popup.childElementCount * 34 + 12;
  const vw = window.innerWidth, vh = window.innerHeight;
  popup.style.left = Math.min(x, vw - pw - 8) + 'px';
  popup.style.top  = Math.min(y, vh - ph - 8) + 'px';
  popup.classList.add('visible');
}

function hideFlagPopup() {
  document.getElementById('flag-popup').classList.remove('visible');
  flagPopupCell = null;
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('#flag-popup')) hideFlagPopup();
});

// ── Core Game Logic ───────────────────────────────────────────────────────────

function revealCell(r, c) {
  const cell = G.board[r][c];
  if (cell.revealed || (cell.flagged > G.playerLevel)) return;

  // First click: place emojis now, guaranteed safe
  if (G.firstClick) {
    G.firstClick = false;
    placeEmojis(G.board, G.rows, G.cols, G.cfg, r, c);
    computeAdjacentSums(G.board, G.rows, G.cols);
    startTimer();
    G.state = 'playing';
  }

  G.clicks++;
  cell.revealed = true;

  if (cell.emojiLevel > 0) {
    // Hit an emoji
    handleEmojiReveal(cell);
  } else {
    // Safe tile
    updateTileEl(cell);
    if (cell.adjacentSum === 0) {
      // Flood fill
      floodFill(r, c);
    }
  }

  checkWin();
  updateTopBar();
  updateGateBanner();
  updateLegendCounts();
}

function handleEmojiReveal(cell) {
  const diff = cell.emojiLevel - G.playerLevel;

  if (diff <= 0) {
    // Safe sweep — earn XP, no damage
    sweepEmoji(cell);
  } else if (diff >= 5) {
    // Instant death — sweep the emoji then die
    sweepEmoji(cell, /*earnXP=*/false);
    takeDamage(G.hp, cell);
  } else {
    // Take damage — still sweep the emoji (you paid for it in HP, no XP)
    const dmg = 5 * Math.pow(2, Math.max(0, diff - 2));
    showToast(`💥 ${G.theme[cell.emojiLevel]} Lv${cell.emojiLevel} hit you for ${dmg} damage!`, 'damage');
    cell.el.style.animation = 'damage-flash 0.4s ease';
    setTimeout(() => { if (cell.el) cell.el.style.animation = ''; }, 400);
    sweepEmoji(cell, /*earnXP=*/false);
    takeDamage(dmg, cell);
  }
}

function sweepEmoji(cell, earnXP = true) {
  const lvl = cell.emojiLevel;
  if (earnXP) {
    const xpGained = Math.pow(2, lvl - 1);
    G.xp += xpGained;
  }
  G.remainingEmojis[lvl]--;
  G.sweptByLevel[lvl]++;

  cell.el.classList.add('sweep-pop');
  setTimeout(() => { if (cell.el) cell.el.classList.remove('sweep-pop'); }, 350);
  updateTileEl(cell);

  // Compute adjacentSum for this emoji tile too (for tap-to-reveal-sum)
  let sum = 0;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = cell.r + dr, nc = cell.c + dc;
      if (nr >= 0 && nr < G.rows && nc >= 0 && nc < G.cols) {
        sum += G.board[nr][nc].emojiLevel;
      }
    }
  }
  cell.adjacentSum = sum;

  checkLevelUp();
}

function takeDamage(amount, cell) {
  G.hp = Math.max(0, G.hp - amount);
  G.damageTaken += amount;

  if (G.hp <= 0) {
    // Dead
    G.state = 'dead';
    clearInterval(G.timerInterval);
    revealFullBoard();
    showGameOver(cell);
  }
  updateTopBar();
}

function floodFill(startR, startC) {
  const queue = [];
  const visited = new Set();
  const key = (r, c) => r * G.cols + c;

  const enqueue = (r, c) => {
    const k = key(r, c);
    if (visited.has(k)) return;
    visited.add(k);
    const cell = G.board[r][c];
    if (cell.revealed || cell.emojiLevel > 0) return;
    queue.push([r, c]);
  };

  // Add neighbors of start
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = startR + dr, nc = startC + dc;
      if (nr >= 0 && nr < G.rows && nc >= 0 && nc < G.cols) {
        enqueue(nr, nc);
      }
    }
  }

  while (queue.length > 0) {
    const [r, c] = queue.shift();
    const cell = G.board[r][c];
    if (cell.revealed) continue;
    cell.revealed = true;
    cell.flagged = 0;
    updateTileEl(cell);

    if (cell.adjacentSum === 0) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < G.rows && nc >= 0 && nc < G.cols) {
            enqueue(nr, nc);
          }
        }
      }
    }
  }
}

// ── Level Up ──────────────────────────────────────────────────────────────────

function checkLevelUp() {
  if (G.playerLevel >= G.cfg.maxLevel) return;

  const thresholds = XP_THRESHOLDS[G.difficulty];
  const nextThreshold = thresholds[G.playerLevel + 1];

  if (nextThreshold === 999999) {
    // Gate check
    checkGate();
    return;
  }

  if (G.xp >= nextThreshold) {
    doLevelUp();
  }
}

function checkGate() {
  const gateLevel = G.gateLevel;
  let allSwept = true;
  for (let lvl = 1; lvl <= gateLevel; lvl++) {
    if (G.remainingEmojis[lvl] > 0) { allSwept = false; break; }
  }
  if (allSwept && !G.gateUnlocked) {
    G.gateUnlocked = true;
    // Unlock level up — set XP threshold to current XP so it triggers immediately
    doLevelUp();
    updateGateBanner();
  }
}

function doLevelUp() {
  const oldEmoji = G.theme[G.playerLevel];
  G.playerLevel++;
  const newEmoji = G.theme[G.playerLevel] || '⭐';

  showToast(`Level Up! ${oldEmoji}→${newEmoji}`, 'levelup');
  const emojiEl = document.getElementById('level-emoji');
  emojiEl.textContent = newEmoji;
  emojiEl.classList.remove('levelup');
  void emojiEl.offsetWidth; // reflow
  emojiEl.classList.add('levelup');
  setTimeout(() => emojiEl.classList.remove('levelup'), 600);

  updateTopBar();
  updateLegendCounts();
  renderLegend();

  // Check if gate is now needed again at the next threshold
  checkLevelUp();
}

// ── Win / Loss ────────────────────────────────────────────────────────────────

function checkWin() {
  if (G.state === 'dead') return;
  // Win = all tiles revealed (every emoji click sweeps it, so revealed ⟺ swept for emojis)
  for (let r = 0; r < G.rows; r++) {
    for (let c = 0; c < G.cols; c++) {
      if (!G.board[r][c].revealed) return;
    }
  }
  G.state = 'won';
  clearInterval(G.timerInterval);
  showWin();
}

function revealFullBoard() {
  for (let r = 0; r < G.rows; r++) {
    for (let c = 0; c < G.cols; c++) {
      const cell = G.board[r][c];
      cell.revealed = true;
      updateTileEl(cell);
    }
  }
}

// ── Timer ─────────────────────────────────────────────────────────────────────

function startTimer() {
  G.timerStart = Date.now() - G.elapsed * 1000;
  G.timerInterval = setInterval(() => {
    G.elapsed = Math.floor((Date.now() - G.timerStart) / 1000);
    document.getElementById('timer').textContent = formatTime(G.elapsed);
  }, 500);
}

// ── Pause ─────────────────────────────────────────────────────────────────────

document.getElementById('pause-btn').addEventListener('click', togglePause);

function togglePause() {
  if (G.state === 'playing') {
    G.state = 'paused';
    clearInterval(G.timerInterval);
    document.getElementById('pause-overlay').classList.add('visible');
    document.getElementById('pause-btn').textContent = '▶';
  } else if (G.state === 'paused') {
    G.state = 'playing';
    startTimer();
    document.getElementById('pause-overlay').classList.remove('visible');
    document.getElementById('pause-btn').textContent = '⏸';
  }
}

// ── Toast Notifications ───────────────────────────────────────────────────────

function showToast(msg, type = '') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast' + (type ? ' ' + type : '');
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 2800);
}

// ── Win / Game Over UI ────────────────────────────────────────────────────────

function showWin() {
  document.getElementById('modal-title').textContent = '🎉 You Win!';
  document.getElementById('modal-sub').textContent = 'Board cleared!';
  populateModal();
  document.getElementById('modal-overlay').classList.add('visible');
  saveScore(true);
}

function showGameOver(cell) {
  const emoji = G.theme[cell.emojiLevel] || '💀';
  document.getElementById('modal-title').textContent = '💀 Game Over';
  document.getElementById('modal-sub').textContent = `A ${emoji} Level ${cell.emojiLevel} got you!`;
  populateModal();
  document.getElementById('modal-overlay').classList.add('visible');
}

function populateModal() {
  document.getElementById('modal-time').textContent = formatTime(G.elapsed);
  document.getElementById('modal-clicks').textContent = G.clicks;
  document.getElementById('modal-damage').textContent = G.damageTaken;

  // Hide PB badges initially; score system will set them
  document.getElementById('modal-time-pb').style.display = 'none';
  document.getElementById('modal-clicks-pb').style.display = 'none';
  document.getElementById('modal-damage-pb').style.display = 'none';
}

// ── Event Wiring ──────────────────────────────────────────────────────────────

document.getElementById('new-game-btn').addEventListener('click', startNewGame);
document.getElementById('modal-new-game').addEventListener('click', () => {
  document.getElementById('modal-overlay').classList.remove('visible');
  startNewGame();
});
document.getElementById('modal-scores').addEventListener('click', () => {
  document.getElementById('modal-overlay').classList.remove('visible');
  showScoresScreen();
});
document.getElementById('scores-btn').addEventListener('click', showScoresScreen);
document.getElementById('scores-close').addEventListener('click', () => {
  document.getElementById('scores-screen').classList.remove('visible');
});

// ── High Scores ───────────────────────────────────────────────────────────────

const SCORES_KEY = 'emojisweeper_scores';

function loadScores() {
  try { return JSON.parse(localStorage.getItem(SCORES_KEY)) || {}; } catch { return {}; }
}

function saveScore(won) {
  if (!won) return; // Only save winning scores
  const scores = loadScores();
  const d = G.difficulty;
  if (!scores[d]) scores[d] = [];
  scores[d].push({ time: G.elapsed, clicks: G.clicks, damage: G.damageTaken, date: Date.now() });
  localStorage.setItem(SCORES_KEY, JSON.stringify(scores));

  // Check PBs
  const list = scores[d];
  const isBestTime   = list.every(s => s.time   >= G.elapsed);
  const isBestClicks = list.every(s => s.clicks  >= G.clicks);
  const isBestDamage = list.every(s => s.damage  >= G.damageTaken);
  if (isBestTime)   document.getElementById('modal-time-pb').style.display   = '';
  if (isBestClicks) document.getElementById('modal-clicks-pb').style.display = '';
  if (isBestDamage) document.getElementById('modal-damage-pb').style.display = '';
}

let scoresSortKey = 'time';
let scoresSortAsc = true;

function showScoresScreen() {
  document.getElementById('scores-screen').classList.add('visible');
  renderScoresScreen();
}

function renderScoresScreen() {
  const body = document.getElementById('scores-body');
  body.innerHTML = '';
  const scores = loadScores();

  ['easy', 'normal', 'huge'].forEach(d => {
    const section = document.createElement('div');
    section.className = 'scores-section';
    section.innerHTML = `<h3>${d.charAt(0).toUpperCase() + d.slice(1)}</h3>`;

    const list = scores[d] || [];
    if (list.length === 0) {
      section.innerHTML += `<p class="no-scores">No completed games yet</p>`;
    } else {
      // Sort
      const sorted = [...list].sort((a, b) => {
        const v = a[scoresSortKey] - b[scoresSortKey];
        return scoresSortAsc ? v : -v;
      });

      const table = document.createElement('table');
      table.className = 'scores-table';
      table.innerHTML = `
        <tr>
          <th data-key="time"  class="${scoresSortKey === 'time'   ? 'sorted' : ''}">Time ${scoresSortKey === 'time'   ? (scoresSortAsc ? '▲' : '▼') : ''}</th>
          <th data-key="clicks" class="${scoresSortKey === 'clicks' ? 'sorted' : ''}">Clicks ${scoresSortKey === 'clicks' ? (scoresSortAsc ? '▲' : '▼') : ''}</th>
          <th data-key="damage" class="${scoresSortKey === 'damage' ? 'sorted' : ''}">Damage ${scoresSortKey === 'damage' ? (scoresSortAsc ? '▲' : '▼') : ''}</th>
        </tr>
      `;
      sorted.forEach(s => {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${formatTime(s.time)}</td><td>${s.clicks}</td><td>${s.damage}</td>`;
        table.appendChild(row);
      });

      table.querySelectorAll('th[data-key]').forEach(th => {
        th.addEventListener('click', () => {
          const k = th.dataset.key;
          if (scoresSortKey === k) scoresSortAsc = !scoresSortAsc;
          else { scoresSortKey = k; scoresSortAsc = true; }
          renderScoresScreen();
        });
      });

      section.appendChild(table);
    }
    body.appendChild(section);
  });
}

// ── Boot ──────────────────────────────────────────────────────────────────────

startNewGame();
