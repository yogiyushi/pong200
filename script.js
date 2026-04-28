const canvas = document.getElementById('pongCanvas');
const ctx = canvas.getContext('2d');
const playerCountEl = document.getElementById('playerCount');
const ballCountEl = document.getElementById('ballCount');
const playerListEl = document.getElementById('playerList');
const playerNameInput = document.getElementById('playerName');
const playerFlagInput = document.getElementById('playerFlag');
const playerColorInput = document.getElementById('playerColor');
const joinButton = document.getElementById('joinButton');
const addBotButton = document.getElementById('addBotButton');
const resetButton = document.getElementById('resetButton');
const zoneWidthInput = document.getElementById('zoneWidth');
const zoneWidthLabel = document.getElementById('zoneWidthLabel');
const ballIntervalInput = document.getElementById('ballInterval');
const ballIntervalLabel = document.getElementById('ballIntervalLabel');
const minBallSpeedInput = document.getElementById('minBallSpeed');
const minBallSpeedLabel = document.getElementById('minBallSpeedLabel');
const maxBallSpeedInput = document.getElementById('maxBallSpeed');
const maxBallSpeedLabel = document.getElementById('maxBallSpeedLabel');
const maxBallsFactorInput = document.getElementById('maxBallsFactor');
const optionsToggle = document.getElementById('optionsToggle');
const optionsMenu = document.getElementById('optionsMenu');
const menuFlipView = document.getElementById('menuFlipView');

const FLAG_OPTIONS = [
  { value: '', label: 'None' },
  { value: '🇺🇸', label: 'USA' },
  { value: '🇬🇧', label: 'UK' },
  { value: '🇯🇵', label: 'Japan' },
  { value: '🇧🇷', label: 'Brazil' },
  { value: '🇩🇪', label: 'Germany' },
  { value: '🇫🇷', label: 'France' },
  { value: '🇰🇷', label: 'Korea' },
  { value: '🇳🇱', label: 'Netherlands' },
  { value: '🇿🇦', label: 'South Africa' }
];

const state = {
  players: [],
  balls: [],
  currentPlayerId: null,
  lastTick: performance.now(),
  nextBallAt: performance.now() + 5000,
  input: {
    left: false,
    right: false
  },
  config: {
    zoneWidth: 200,
    paddleLength: 40,
    paddleHeight: 10,
    paddleInset: 10,
    ballRadius: 3,
    spawnInterval: 5000,
    maxBallsFactor: 2,
    minBallSpeed: 2.8,
    maxBallSpeed: 4.0,
    topInset: 10,
    bottomInset: 10,
    worldLeft: 0,
    flipTopView: false
  }
};

const BALL_INTERVAL_MIN_SEC = 0.1;
const BALL_INTERVAL_MAX_SEC = 10;
const BALL_INTERVAL_STEP_SEC = 0.1;
const SETTINGS_STORAGE_KEY = 'pong200.settings';

function saveSettings() {
  const settings = {
    zoneWidth: Number(zoneWidthInput.value),
    spawnIntervalSec: Number(ballIntervalInput.value),
    minBallSpeed: Number(minBallSpeedInput.value),
    maxBallSpeed: Number(maxBallSpeedInput.value),
    maxBallsFactor: Number(maxBallsFactorInput.value),
    flipTopView: menuFlipView.checked,
    playerName: playerNameInput.value,
    playerFlag: playerFlagInput.value,
    playerColor: playerColorInput.value
  };
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

function loadSettings() {
  const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
  if (!raw) return;
  try {
    const settings = JSON.parse(raw);
    if (settings.zoneWidth != null) state.config.zoneWidth = Number(settings.zoneWidth);
    if (settings.spawnIntervalSec != null) state.config.spawnInterval = Math.round(Number(settings.spawnIntervalSec) * 1000);
    if (settings.minBallSpeed != null) state.config.minBallSpeed = Number(settings.minBallSpeed);
    if (settings.maxBallSpeed != null) state.config.maxBallSpeed = Number(settings.maxBallSpeed);
    if (settings.maxBallsFactor != null) state.config.maxBallsFactor = Number(settings.maxBallsFactor);
    if (settings.flipTopView != null) state.config.flipTopView = Boolean(settings.flipTopView);
    if (settings.playerName != null) playerNameInput.value = settings.playerName;
    if (settings.playerFlag != null) playerFlagInput.value = settings.playerFlag;
    if (settings.playerColor != null) playerColorInput.value = settings.playerColor;
  } catch (error) {
    console.warn('Could not load saved settings:', error);
  }
}

function applySettingsToInputs() {
  zoneWidthInput.value = String(state.config.zoneWidth);
  zoneWidthLabel.textContent = String(state.config.zoneWidth);
  setBallIntervalSeconds(state.config.spawnInterval / 1000);
  minBallSpeedInput.value = String(state.config.minBallSpeed);
  minBallSpeedLabel.textContent = state.config.minBallSpeed.toFixed(1);
  maxBallSpeedInput.value = String(state.config.maxBallSpeed);
  maxBallSpeedLabel.textContent = state.config.maxBallSpeed.toFixed(1);
  maxBallsFactorInput.value = String(state.config.maxBallsFactor);
  menuFlipView.checked = state.config.flipTopView;
}

function setBallIntervalSeconds(seconds) {
  const clamped = clamp(seconds, BALL_INTERVAL_MIN_SEC, BALL_INTERVAL_MAX_SEC);
  state.config.spawnInterval = Math.round(clamped * 1000);
  ballIntervalInput.value = clamped.toFixed(1);
  ballIntervalLabel.textContent = `${clamped.toFixed(1)}s`;
}

// ably




const ablyConfig = {
  apiKey: '',
  channel: 'pong200'
};

function makeId(prefix = 'p') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getCanvasSize() {
  return {
    width: canvas.clientWidth,
    height: canvas.clientHeight
  };
}

function getCurrentPlayer() {
  return state.players.find((player) => player.id === state.currentPlayerId);
}

function getSideCounts() {
  return state.players.reduce(
    (counts, player) => {
      counts[player.side] += 1;
      return counts;
    },
    { top: 0, bottom: 0 }
  );
}

function chooseSide() {
  const counts = getSideCounts();
  if (counts.top < counts.bottom) return 'top';
  if (counts.bottom < counts.top) return 'bottom';
  return state.players.length % 2 === 0 ? 'bottom' : 'top';
}

function createPlayer({ name, flag, color, side, isBot = false, isLocal = false }) {
  const { height } = getCanvasSize();
  const baseY = side === 'bottom' ? height - state.config.bottomInset - state.config.paddleHeight : state.config.topInset;
  return {
    id: makeId(isLocal ? 'me' : isBot ? 'bot' : 'pl'),
    name: name || (isBot ? `Bot-${Math.floor(Math.random() * 1000)}` : 'Player'),
    flag: flag || '',
    color: color || '#fff',
    side,
    score: 0,
    lastHit: 0,
    paddleX: null,
    paddleY: baseY,
    targetX: null,
    isBot,
    isLocal,
    active: true
  };
}

function addPlayer(options) {
  const player = createPlayer({
    side: options.side || chooseSide(),
    name: options.name,
    flag: options.flag,
    color: options.color || (options.isLocal ? playerColorInput.value : '#fff'),
    isBot: options.isBot,
    isLocal: options.isLocal
  });
  state.players.unshift(player);
  if (options.isLocal) {
    state.currentPlayerId = player.id;
  }
  syncWorld();
  updateUI();
  return player;
}

function addBot() {
  addPlayer({ isBot: true });
}

function resetGame() {
  state.players = [];
  state.balls = [];
  state.currentPlayerId = null;
  state.nextBallAt = performance.now() + state.config.spawnInterval;
  updateUI();
}

function syncWorld() {
  const sideCounts = { top: 0, bottom: 0 };
  state.players.forEach((player) => {
    player.zoneIndex = sideCounts[player.side];
    sideCounts[player.side] += 1;
  });
  state.columnCount = Math.max(sideCounts.top, sideCounts.bottom);
  state.players.forEach((player) => {
    const zoneLeft = player.zoneIndex * state.config.zoneWidth;
    const zoneRight = zoneLeft + state.config.zoneWidth;
    const defaultX = zoneLeft + (state.config.zoneWidth - state.config.paddleLength) / 2;
    player.paddleX = clamp(
      player.paddleX == null ? defaultX : player.paddleX,
      zoneLeft + 4,
      zoneRight - state.config.paddleLength - 4
    );
  });
  state.worldWidth = state.columnCount * state.config.zoneWidth;
}

function spawnBall() {
  if (state.players.length === 0) return;
  if (state.balls.length >= state.players.length * state.config.maxBallsFactor) return;

  const { height } = getCanvasSize();
  const minY = state.config.topInset + state.config.ballRadius + 12;
  const maxY = height - state.config.bottomInset - state.config.ballRadius - 12;
  const angle = ((Math.random() * 80 - 40) * Math.PI) / 180;
  const speedRange = Math.max(0, state.config.maxBallSpeed - state.config.minBallSpeed);
  const speed = (state.config.minBallSpeed + Math.random() * speedRange) * 10;
  state.balls.push({
    x: 8,
    y: minY + Math.random() * (maxY - minY),
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: state.config.ballRadius,
    lastZone: 0
  });
  updateUI();
}

function playerPaddleBounds(player) {
  const { height } = getCanvasSize();
  const zoneLeft = player.zoneIndex * state.config.zoneWidth;
  const zoneRight = zoneLeft + state.config.zoneWidth;
  const x = clamp(
    player.paddleX,
    zoneLeft + 4,
    zoneRight - state.config.paddleLength - 4
  );
  const y = player.side === 'bottom'
    ? height - state.config.bottomInset - state.config.paddleHeight
    : state.config.topInset;
  return {
    x,
    y,
    width: state.config.paddleLength,
    height: state.config.paddleHeight
  };
}

function getZonePlayer(zoneIndex, side) {
  return state.players.find((player) => player.zoneIndex === zoneIndex && player.side === side);
}

function hitPaddle(player, ball) {
  const paddle = playerPaddleBounds(player);
  const hitX = ball.x - (paddle.x + paddle.width / 2);
  const normalized = clamp(hitX / (paddle.width / 2), -1, 1);
  if ((player.side === 'top' && ball.vy < 0) || (player.side === 'bottom' && ball.vy > 0)) {
    ball.vy = -ball.vy;
    ball.vx += normalized * 0.4;
    ball.y = player.side === 'top'
      ? paddle.y + paddle.height + ball.radius + 1
      : paddle.y - ball.radius - 1;
    player.score += 1;
    player.lastHit = performance.now();
    updateUI();
  }
}

function eliminatePlayer(player) {
  const isCurrent = player.id === state.currentPlayerId;
  if (isCurrent) {
    const again = window.confirm('You missed a ball. Play again?');
    if (!again) {
      state.currentPlayerId = null;
      state.players = state.players.filter((item) => item.id !== player.id);
      syncWorld();
      updateUI();
      return;
    }
  }

  state.players = state.players.filter((item) => item.id !== player.id);
  syncWorld();
  const nextPlayer = createPlayer({
    name: player.name,
    flag: player.flag,
    side: chooseSide(),
    isBot: player.isBot,
    isLocal: isCurrent
  });
  if (isCurrent) {
    nextPlayer.score = player.score;
    state.currentPlayerId = nextPlayer.id;
  } else {
    nextPlayer.score = player.score;
  }
  state.players.unshift(nextPlayer);
  syncWorld();
  updateUI();
}

function updateBalls(delta) {
  const aliveBalls = [];
  const leftWallLimit = state.config.zoneWidth * 0.25;
  for (const ball of state.balls) {
    ball.x += ball.vx * delta;
    ball.y += ball.vy * delta;

    if (ball.x - ball.radius <= 0) {
      ball.x = ball.radius;
      ball.vx = Math.abs(ball.vx);
    }

    const zoneIndex = Math.max(0, Math.min(state.columnCount - 1, Math.floor(ball.x / state.config.zoneWidth)));
    const side = ball.vy > 0 ? 'bottom' : 'top';
    const player = getZonePlayer(zoneIndex, side);
    if (player) {
      const paddle = playerPaddleBounds(player);
      const collided =
        ball.x + ball.radius >= paddle.x &&
        ball.x - ball.radius <= paddle.x + paddle.width &&
        ball.y + ball.radius >= paddle.y &&
        ball.y - ball.radius <= paddle.y + paddle.height;
      if (collided) {
        hitPaddle(player, ball);
      }
    }

    const { height } = getCanvasSize();
    const topHit = ball.y - ball.radius <= 0;
    const bottomHit = ball.y + ball.radius >= height;
    if (topHit || bottomHit) {
      if (ball.x < leftWallLimit) {
        if (topHit) {
          ball.y = ball.radius;
        } else {
          ball.y = height - ball.radius;
        }
        ball.vy = -ball.vy;
      } else {
        if (player) {
          eliminatePlayer(player);
          continue;
        }
      }
    }

    if (ball.x - ball.radius < state.worldWidth + 60) {
      aliveBalls.push(ball);
    }
  }
  state.balls = aliveBalls;
}

function updateBots(delta) {
  const candidateBalls = state.balls.filter((ball) => ball.vx > 0);
  for (const player of state.players) {
    if (!player.isBot) continue;
    const paddle = playerPaddleBounds(player);
    let target = paddle.x + paddle.width / 2;

    const inZoneBalls = candidateBalls.filter((ball) => {
      const zoneIndex = Math.floor(ball.x / state.config.zoneWidth);
      return zoneIndex === player.zoneIndex;
    });
    if (inZoneBalls.length > 0) {
      target = inZoneBalls[0].x;
    }

    const zoneLeft = player.zoneIndex * state.config.zoneWidth;
    const zoneRight = zoneLeft + state.config.zoneWidth;
    player.targetX = clamp(target - state.config.paddleLength / 2, zoneLeft + 4, zoneRight - state.config.paddleLength - 4);
    const move = (player.targetX - player.paddleX) * Math.min(1, delta * 4);
    player.paddleX += move;

    if (isNaN(player.paddleX)) {
      player.paddleX = paddle.x;
    }
  }
}

function updateGame(delta) {
  const current = getCurrentPlayer();
  if (current) {
    const direction = (state.input.right ? 1 : 0) - (state.input.left ? 1 : 0);
    if (direction !== 0) {
      const zoneLeft = current.zoneIndex * state.config.zoneWidth;
      const zoneRight = zoneLeft + state.config.zoneWidth;
      const speed = 48;
      current.paddleX = clamp(
        current.paddleX + direction * speed * delta,
        zoneLeft + 4,
        zoneRight - state.config.paddleLength - 4
      );
    }
  }
  updateBalls(delta);
  updateBots(delta);
  if (performance.now() >= state.nextBallAt) {
    spawnBall();
    state.nextBallAt = performance.now() + state.config.spawnInterval;
  }
}

function getCanvasHeight() {
  const visibleZoneWidth = state.config.zoneWidth * getViewScale();
  const height = Math.round(visibleZoneWidth * 3);
  return clamp(height, 450, 600);
}

function getViewScale() {
  const cssWidth = canvas.clientWidth;
  const minScale = 150 / state.config.zoneWidth;
  if (state.worldWidth <= cssWidth) {
    return 1;
  }
  return Math.max(cssWidth / state.worldWidth, minScale);
}

function cameraXForCurrentPlayer() {
  const cssWidth = canvas.clientWidth;
  const selected = getCurrentPlayer();
  const baseX = selected ? selected.zoneIndex * state.config.zoneWidth : 0;
  const halfWidth = cssWidth * 0.42;
  const minX = 0;
  const maxX = Math.max(0, state.worldWidth - cssWidth);
  return clamp(baseX - halfWidth, minX, maxX);
}

function render() {
  const cssWidth = canvas.clientWidth;
  const cssHeight = canvas.clientHeight;
  ctx.clearRect(0, 0, cssWidth, cssHeight);
  const viewScale = getViewScale();
  const cameraX = viewScale < 1 ? 0 : cameraXForCurrentPlayer();
  ctx.save();
  ctx.translate(-cameraX, 0);
  ctx.scale(viewScale, 1);

  const current = getCurrentPlayer();
  if (current && current.side === 'top' && state.config.flipTopView) {
    ctx.translate(0, cssHeight);
    ctx.scale(1, -1);
  }

  ctx.fillStyle = '#000';
  ctx.fillRect(cameraX, 0, cssWidth, cssHeight);

  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  for (let index = 0; index <= state.columnCount; index++) {
    const x = index * state.config.zoneWidth;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, cssHeight);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  for (let index = 0; index < state.columnCount; index++) {
    ctx.fillRect(index * state.config.zoneWidth, 0, state.config.zoneWidth, cssHeight);
  }

  for (const player of state.players) {
    const zoneLeft = player.zoneIndex * state.config.zoneWidth;
    const zoneRight = zoneLeft + state.config.zoneWidth;
    const isCurrent = player.id === state.currentPlayerId;
    const bgAlpha = player.side === 'bottom' ? 0.06 : 0.04;

    ctx.fillStyle = `rgba(255,255,255,${bgAlpha})`;
    ctx.fillRect(zoneLeft, 0, state.config.zoneWidth, cssHeight);

    const paddle = playerPaddleBounds(player);
    const isLocal = player.isLocal;
    const paddleColor = player.color || (isCurrent ? '#fff' : isLocal ? '#f8f8f8' : '#ccc');
    ctx.fillStyle = paddleColor;
    ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);
    if (isLocal && !isCurrent) {
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 2;
      ctx.strokeRect(paddle.x + 1, paddle.y + 1, paddle.width - 2, paddle.height - 2);
    }

    ctx.fillStyle = '#fff';
    ctx.font = '12px ui-monospace, monospace';
    ctx.textBaseline = 'middle';
    const scoreText = `${player.flag ? player.flag + ' ' : ''}${player.score}`;
    ctx.textAlign = 'left';
    ctx.fillText(scoreText, zoneLeft + 5, paddle.y + paddle.height / 2);

    if (isCurrent) {
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText('YOU', zoneLeft + 6, player.side === 'bottom' ? cssHeight - 18 : 18);
    }
  }

  for (const ball of state.balls) {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function refreshUI() {
  playerCountEl.textContent = state.players.length;
  ballCountEl.textContent = state.balls.length;
  playerListEl.innerHTML = '';
  for (const player of state.players) {
    const item = document.createElement('div');
    item.className = 'player-item';

    const side = document.createElement('div');
    side.className = 'player-side';
    side.textContent = player.side;

    const name = document.createElement('span');
    name.textContent = `${player.flag ? player.flag + ' ' : ''}${player.name}`;

    const score = document.createElement('span');
    score.textContent = player.score;

    item.append(side, name, score);
    if (player.id === state.currentPlayerId) {
      item.style.borderColor = 'rgba(255,255,255,0.28)';
    }
    playerListEl.appendChild(item);
  }
}

function updateUI() {
  syncWorld();
  if (!state.currentPlayerId && state.players.length) {
    const localPlayer = state.players.find((player) => player.isLocal);
    state.currentPlayerId = localPlayer ? localPlayer.id : state.players[0].id;
  }
  playerCountEl.textContent = state.players.length;
  ballCountEl.textContent = state.balls.length;
  refreshUI();
  resizeCanvas();
}

function resizeCanvas() {
  canvas.style.height = `${getCanvasHeight()}px`;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * devicePixelRatio);
  canvas.height = Math.floor(rect.height * devicePixelRatio);
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  render();
}

function initFlags() {
  for (const item of FLAG_OPTIONS) {
    const option = document.createElement('option');
    option.value = item.value;
    option.textContent = item.label;
    playerFlagInput.appendChild(option);
  }
}

function attachEvents() {
  joinButton.addEventListener('click', () => {
    if (state.currentPlayerId) return;
    addPlayer({
      name: playerNameInput.value.trim() || 'You',
      flag: playerFlagInput.value,
      color: playerColorInput.value,
      isLocal: true
    });
  });
  addBotButton.addEventListener('click', addBot);
  resetButton.addEventListener('click', resetGame);

  playerNameInput.addEventListener('input', saveSettings);
  playerFlagInput.addEventListener('change', saveSettings);

  zoneWidthInput.addEventListener('input', () => {
    state.config.zoneWidth = Number(zoneWidthInput.value);
    zoneWidthLabel.textContent = zoneWidthInput.value;
    syncWorld();
    resizeCanvas();
    saveSettings();
  });

  ballIntervalInput.addEventListener('input', () => {
    setBallIntervalSeconds(Number(ballIntervalInput.value));
    saveSettings();
  });

  playerColorInput.addEventListener('input', () => {
    const current = getCurrentPlayer();
    if (current && current.isLocal) {
      current.color = playerColorInput.value;
    }
    saveSettings();
  });

  minBallSpeedInput.addEventListener('input', () => {
    state.config.minBallSpeed = Number(minBallSpeedInput.value);
    const minSpeed = state.config.minBallSpeed;
    if (minSpeed > state.config.maxBallSpeed) {
      state.config.maxBallSpeed = minSpeed;
      maxBallSpeedInput.value = minSpeed;
      maxBallSpeedLabel.textContent = minSpeed.toFixed(1);
    }
    minBallSpeedLabel.textContent = minSpeed.toFixed(1);
    saveSettings();
  });
  maxBallSpeedInput.addEventListener('input', () => {
    state.config.maxBallSpeed = Number(maxBallSpeedInput.value);
    const maxSpeed = state.config.maxBallSpeed;
    if (maxSpeed < state.config.minBallSpeed) {
      state.config.minBallSpeed = maxSpeed;
      minBallSpeedInput.value = maxSpeed;
      minBallSpeedLabel.textContent = maxSpeed.toFixed(1);
    }
    maxBallSpeedLabel.textContent = maxSpeed.toFixed(1);
    saveSettings();
  });

  maxBallsFactorInput.addEventListener('input', () => {
    state.config.maxBallsFactor = clamp(Number(maxBallsFactorInput.value), 1, 4);
    saveSettings();
  });

  menuFlipView.addEventListener('change', () => {
    state.config.flipTopView = menuFlipView.checked;
    saveSettings();
  });
  optionsToggle.addEventListener('click', (event) => {
    event.stopPropagation();
    const isHidden = optionsMenu.classList.contains('hidden');
    optionsMenu.classList.toggle('hidden', !isHidden);
    optionsMenu.setAttribute('aria-hidden', String(isHidden ? 'false' : 'true'));
  });
  window.addEventListener('click', (event) => {
    if (!optionsMenu.contains(event.target) && event.target !== optionsToggle) {
      optionsMenu.classList.add('hidden');
      optionsMenu.setAttribute('aria-hidden', 'true');
    }
  });

  let isDragging = false;
  function pointerMove(event) {
    const current = getCurrentPlayer();
    if (!current) return;
    isDragging = true;
    const rect = canvas.getBoundingClientRect();
    const rawX = (event.clientX - rect.left) / getViewScale();
    const zoneLeft = current.zoneIndex * state.config.zoneWidth;
    const zoneRight = zoneLeft + state.config.zoneWidth;
    current.paddleX = clamp(
      rawX,
      zoneLeft + 4,
      zoneRight - state.config.paddleLength - 4
    );
  }

  canvas.addEventListener('pointerdown', (event) => {
    pointerMove(event);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (event.buttons !== 1) return;
    pointerMove(event);
  });
  canvas.addEventListener('pointerup', () => {
    isDragging = false;
  });
  canvas.addEventListener('pointerleave', () => {
    isDragging = false;
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      if (event.key === 'ArrowLeft') state.input.left = true;
      if (event.key === 'ArrowRight') state.input.right = true;
    }
  });

  window.addEventListener('keyup', (event) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      if (event.key === 'ArrowLeft') state.input.left = false;
      if (event.key === 'ArrowRight') state.input.right = false;
    }
  });

  window.addEventListener('blur', () => {
    state.input.left = false;
    state.input.right = false;
  });

  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('load', resizeCanvas);
}

function gameLoop() {
  const now = performance.now();
  const delta = Math.min(0.018, (now - state.lastTick) / 16.67);
  state.lastTick = now;
  updateGame(delta);
  render();
  requestAnimationFrame(gameLoop);
}

function setup() {
  initFlags();
  attachEvents();
  loadSettings();
  applySettingsToInputs();
  state.nextBallAt = performance.now() + state.config.spawnInterval;

  ballIntervalInput.min = String(BALL_INTERVAL_MIN_SEC);
  ballIntervalInput.max = String(BALL_INTERVAL_MAX_SEC);
  ballIntervalInput.step = String(BALL_INTERVAL_STEP_SEC);

  resizeCanvas();
  addBot();
  addBot();
  addBot();
  addPlayer({ isLocal: true, name: 'You', flag: '' });
  spawnBall();
  updateUI();
  canvas.focus();
  requestAnimationFrame(gameLoop);
}

setup();
