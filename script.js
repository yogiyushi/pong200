const canvas = document.getElementById('pongCanvas');
const ctx = canvas.getContext('2d');
const playerCountEl = document.getElementById('playerCount');
const ballCountEl = document.getElementById('ballCount');
const canvasPlayerCountEl = document.getElementById('canvasPlayerCount');
const canvasBallCountEl = document.getElementById('canvasBallCount');
const canvasFPSEl = document.getElementById('canvasFPS');
const canvasFrameTimeEl = document.getElementById('canvasFrameTime');
const playerNameInput = document.getElementById('playerName');
const playerColorInput = document.getElementById('playerColor');
const joinButton = document.getElementById('joinButton');
const addBotButton = document.getElementById('addBotButton');
const cameraZoomInput = document.getElementById('cameraZoom');
const cameraZoomLabel = document.getElementById('cameraZoomLabel');
const ballIntervalInput = document.getElementById('ballInterval');
const ballIntervalLabel = document.getElementById('ballIntervalLabel');
const minBallSpeedInput = document.getElementById('minBallSpeed');
const minBallSpeedLabel = document.getElementById('minBallSpeedLabel');
const maxBallSpeedInput = document.getElementById('maxBallSpeed');
const maxBallSpeedLabel = document.getElementById('maxBallSpeedLabel');
const maxBallCountInput = document.getElementById('maxBallCount');
const maxBallCountLabel = document.getElementById('maxBallCountLabel');
const playerPaddleSizeInput = document.getElementById('playerPaddleSize');
const playerPaddleSizeLabel = document.getElementById('playerPaddleSizeLabel');
const botPaddleSizeInput = document.getElementById('botPaddleSize');
const botPaddleSizeLabel = document.getElementById('botPaddleSizeLabel');
const optionsToggle = document.getElementById('optionsToggle');
const optionsMenu = document.getElementById('optionsMenu');
const menuFlipView = document.getElementById('menuFlipView');
const startingBotCountInput = document.getElementById('startingBotCount');
const startingBotCountLabel = document.getElementById('startingBotCountLabel');
const gamePanel = document.querySelector('.game-panel');
const ballCanvas = document.getElementById('ballCanvas');
let gl = null;
let glProgram = null;
let glPositionBuffer = null;
let glPositionLocation = null;
let glPointSizeLocation = null;
let glResolutionLocation = null;
let glCameraXLocation = null;
let glViewScaleLocation = null;
let glYOffsetLocation = null;
let glPixelRatio = 1;
let glMaxBalls = 0;
let ballDataBuffer = null;
let ballDataView = null;
let paddleState = null;

//localStorage.clear();

const state = {
  players: [],
  ballEngine: null,
  ballWorker: null,
  ballWorkerData: new Float32Array(0),
  ballWorkerCount: 0,
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
    playerPaddleSize: 40,
    botPaddleSize: 40,
    paddleHeight: 10,
    paddleInset: 10,
    ballRadius: 3,
    spawnInterval: 5000,
    maxBallCount: 400,
    minBallSpeed: 2.8,
    maxBallSpeed: 4.0,
    topInset: 10,
    bottomInset: 10,
    worldLeft: 0,
    zoomLevel: 1,
    startingBotCount: 199,
    flipTopView: false
  },
  cameraX: 0,
  cameraXTarget: 0,
  cameraXStart: 0,
  cameraXStartTime: performance.now(),
  fps: 0,
  frameTime: 0,
  lastFpsUpdate: performance.now(),
  menuFlash: {
    top: {},
    bottom: {}
  }
};

const BALL_INTERVAL_MIN_SEC = 0.001;
const BALL_INTERVAL_MAX_SEC = 10;
const BALL_INTERVAL_STEP_SEC = 0.001;
const MAX_CANVAS_PIXEL_RATIO = 1.5;
const CANVAS_MENU_HEIGHT = 16;
const SETTINGS_STORAGE_KEY = 'pong200.settings';
const PLAYER_ICON_SIZE = 14;
const PLAYER_ICONS = {
  human: new Image(),
  bot: new Image()
};
PLAYER_ICONS.human.src = 'icons/man_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg';
PLAYER_ICONS.bot.src = 'icons/computer_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg';

function saveSettings() {
  const settings = {
    cameraZoom: Number(cameraZoomInput.value),
    spawnIntervalSec: Number(ballIntervalInput.value),
    minBallSpeed: Number(minBallSpeedInput.value),
    maxBallSpeed: Number(maxBallSpeedInput.value),
    maxBallCount: Number(maxBallCountInput.value),
    playerPaddleSize: Number(playerPaddleSizeInput.value),
    botPaddleSize: Number(botPaddleSizeInput.value),
    startingBotCount: Number(startingBotCountInput.value),
    flipTopView: menuFlipView.checked,
    playerName: playerNameInput.value,
    playerColor: playerColorInput.value
  };
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

function loadSettings() {
  const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
  if (!raw) return;
  try {
    const settings = JSON.parse(raw);
    if (settings.cameraZoom != null) state.config.zoomLevel = Number(settings.cameraZoom);
    if (settings.spawnIntervalSec != null) state.config.spawnInterval = Math.round(Number(settings.spawnIntervalSec) * 1000);
    if (settings.minBallSpeed != null) state.config.minBallSpeed = Number(settings.minBallSpeed);
    if (settings.maxBallSpeed != null) state.config.maxBallSpeed = Number(settings.maxBallSpeed);
    if (settings.maxBallCount != null) state.config.maxBallCount = Number(settings.maxBallCount);
    if (settings.playerPaddleSize != null) state.config.playerPaddleSize = Number(settings.playerPaddleSize);
    if (settings.botPaddleSize != null) state.config.botPaddleSize = Number(settings.botPaddleSize);
    if (settings.startingBotCount != null) state.config.startingBotCount = clamp(Number(settings.startingBotCount), 0, 200);
    if (settings.flipTopView != null) state.config.flipTopView = Boolean(settings.flipTopView);
    if (settings.playerName != null) playerNameInput.value = settings.playerName;
    if (settings.playerColor != null) playerColorInput.value = settings.playerColor;
  } catch (error) {
    console.warn('Could not load saved settings:', error);
  }
}

function applySettingsToInputs() {
  cameraZoomInput.value = String(state.config.zoomLevel);
  cameraZoomLabel.textContent = `${Math.round(state.config.zoomLevel * 100)}%`;
  setBallIntervalSeconds(state.config.spawnInterval / 1000);
  minBallSpeedInput.value = String(state.config.minBallSpeed);
  minBallSpeedLabel.textContent = state.config.minBallSpeed.toFixed(1);
  maxBallSpeedInput.value = String(state.config.maxBallSpeed);
  maxBallSpeedLabel.textContent = state.config.maxBallSpeed.toFixed(1);
  maxBallCountInput.value = String(state.config.maxBallCount);
  maxBallCountLabel.textContent = String(state.config.maxBallCount);
  playerPaddleSizeInput.value = String(state.config.playerPaddleSize);
  playerPaddleSizeLabel.textContent = String(state.config.playerPaddleSize);
  botPaddleSizeInput.value = String(state.config.botPaddleSize);
  botPaddleSizeLabel.textContent = String(state.config.botPaddleSize);
  startingBotCountInput.value = String(state.config.startingBotCount);
  startingBotCountLabel.textContent = String(state.config.startingBotCount);
  menuFlipView.checked = state.config.flipTopView;
}

function setBallIntervalSeconds(seconds) {
  const clamped = clamp(seconds, BALL_INTERVAL_MIN_SEC, BALL_INTERVAL_MAX_SEC);
  state.config.spawnInterval = Math.round(clamped * 1000);
  const precision = clamped < 0.01 ? 3 : 2;
  ballIntervalInput.value = clamped.toFixed(precision);
  ballIntervalLabel.textContent = `${clamped.toFixed(precision).replace('.', ',')}s`;
}

function setCameraZoom(value, save = true) {
  const clamped = clamp(value, 0.1, 1);
  state.config.zoomLevel = clamped;
  cameraZoomInput.value = String(clamped);
  cameraZoomLabel.textContent = `${Math.round(clamped * 100)}%`;
  if (save) saveSettings();
  render();
}

function setStartingBotCount(count) {
  const value = clamp(Math.round(count), 0, 200);
  state.config.startingBotCount = value;
  startingBotCountInput.value = String(value);
  startingBotCountLabel.textContent = String(value);
}

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile failed: ${info}`);
  }
  return shader;
}

function createProgram(gl, vertexSource, fragmentSource) {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program link failed: ${info}`);
  }
  return program;
}

function initWebGL(maxBalls) {
  if (!ballCanvas) return null;
  const context = ballCanvas.getContext('webgl', { alpha: true, antialias: false });
  if (!context) return null;
  const vertexSource = `
    attribute vec2 a_position;
    uniform float u_pointSize;
    uniform vec2 u_resolution;
    uniform float u_cameraX;
    uniform float u_viewScale;
    uniform float u_yOffset;
    void main() {
      vec2 pos = vec2((a_position.x - u_cameraX) * u_viewScale, a_position.y * u_viewScale + u_yOffset);
      vec2 clip = vec2(pos.x / u_resolution.x * 2.0 - 1.0, 1.0 - pos.y / u_resolution.y * 2.0);
      gl_Position = vec4(clip, 0.0, 1.0);
      gl_PointSize = u_pointSize;
    }
  `;
  const fragmentSource = `
    precision mediump float;
    void main() {
      gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
    }
  `;
  const program = createProgram(context, vertexSource, fragmentSource);
  const positionBuffer = context.createBuffer();
  context.bindBuffer(context.ARRAY_BUFFER, positionBuffer);
  context.bufferData(context.ARRAY_BUFFER, maxBalls * 4 * Float32Array.BYTES_PER_ELEMENT, context.DYNAMIC_DRAW);
  context.disable(context.BLEND);
  context.clearColor(0, 0, 0, 0);

  glProgram = program;
  glPositionBuffer = positionBuffer;
  glMaxBalls = maxBalls;
  glPositionLocation = context.getAttribLocation(program, 'a_position');
  glPointSizeLocation = context.getUniformLocation(program, 'u_pointSize');
  glResolutionLocation = context.getUniformLocation(program, 'u_resolution');
  glCameraXLocation = context.getUniformLocation(program, 'u_cameraX');
  glViewScaleLocation = context.getUniformLocation(program, 'u_viewScale');
  glYOffsetLocation = context.getUniformLocation(program, 'u_yOffset');
  context.enableVertexAttribArray(glPositionLocation);
  context.vertexAttribPointer(glPositionLocation, 2, context.FLOAT, false, 16, 0);
  return context;
}

function resizeWebGL(maxBalls) {
  if (!gl || !glPositionBuffer) return;
  gl.bindBuffer(gl.ARRAY_BUFFER, glPositionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, maxBalls * 4 * Float32Array.BYTES_PER_ELEMENT, gl.DYNAMIC_DRAW);
  glMaxBalls = maxBalls;
}

function drawWebGLBalls(cssWidth, cssHeight, worldHeight, viewScale) {
  if (!gl || !glProgram) return;
  const ballCount = getBallCount();
  gl.viewport(0, 0, ballCanvas.width, ballCanvas.height);
  gl.clear(gl.COLOR_BUFFER_BIT);
  if (ballCount === 0) return;

  const count = Math.min(ballCount, glMaxBalls || state.config.maxBallCount);
  const data = getBallData();
  const floatData = data.subarray(0, count * 4);
  gl.bindBuffer(gl.ARRAY_BUFFER, glPositionBuffer);
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, floatData);
  gl.useProgram(glProgram);

  const yOffset = (cssHeight - worldHeight * viewScale) / 2;
  gl.uniform2f(glResolutionLocation, cssWidth, cssHeight);
  gl.uniform1f(glCameraXLocation, state.cameraX);
  gl.uniform1f(glViewScaleLocation, viewScale);
  gl.uniform1f(glYOffsetLocation, yOffset);
  gl.uniform1f(glPointSizeLocation, Math.max(1, state.config.ballRadius * 2 * viewScale * glPixelRatio));

  gl.drawArrays(gl.POINTS, 0, count);
}

function createBallEngine(maxBalls) {
  const engine = new BallEngine(maxBalls);
  const previous = state.ballEngine;
  if (previous && previous.ballCount > 0) {
    const copyCount = Math.min(previous.ballCount, maxBalls);
    engine.ballCount = copyCount;
    engine.data.set(previous.data.subarray(0, copyCount * previous.varsPerBall));
  }
  return engine;
}

const BALL_WORKER_PATH = 'ballWorker.js';

function initBallWorker(maxBalls) {
  if (!window.Worker) return null;
  const worker = new Worker(BALL_WORKER_PATH);
  worker.onmessage = (event) => {
    const message = event.data;
    if (message.type === 'updated') {
      state.ballWorkerCount = message.ballCount;
      state.ballWorkerData = new Float32Array(message.data);
      if (message.events) handleBallWorkerEvents(message.events);
      if (Array.isArray(message.flashes)) {
        for (const flash of message.flashes) {
          state.menuFlash[flash.side][flash.zoneIndex] = 1;
        }
      }
    }
  };
  state.ballWorkerData = new Float32Array(maxBalls * 4);
  state.ballWorkerCount = 0;
  worker.postMessage({
    type: 'init',
    maxBalls
  });
  return worker;
}

function handleBallWorkerEvents(events) {
  if (!Array.isArray(events)) return;
  let changed = false;
  for (const event of events) {
    if (event.type === 'hit') {
      const player = state.players.find((item) => item.id === event.playerId);
      if (player) {
        player.score += 1;
        player.lastHit = performance.now();
        changed = true;
      }
    } else if (event.type === 'eliminate') {
      const player = state.players.find((item) => item.id === event.playerId);
      if (player) {
        eliminatePlayer(player);
        changed = true;
      }
    }
  }
  if (changed) updateUI();
}

function getBallCount() {
  return state.ballWorker ? state.ballWorkerCount : state.ballEngine ? state.ballEngine.ballCount : 0;
}

function getBallData() {
  return state.ballWorker ? state.ballWorkerData : state.ballEngine ? state.ballEngine.data : new Float32Array(0);
}

function sendBallWorkerUpdate(delta) {
  if (!state.ballWorker) return;
  const { height } = getCanvasSize();
  const topPaddleBottom = CANVAS_MENU_HEIGHT + 1 + state.config.paddleHeight;
  const bottomPaddleTop = height - state.config.paddleHeight - CANVAS_MENU_HEIGHT - 1;
  const paddles = {
    top: [],
    bottom: []
  };
  for (const player of state.players) {
    const paddle = playerPaddleBounds(player);
    paddles[player.side].push({
      id: player.id,
      side: player.side,
      zoneIndex: player.zoneIndex,
      x: paddle.x,
      y: paddle.y,
      width: paddle.width,
      height: paddle.height
    });
  }
  state.ballWorker.postMessage({
    type: 'update',
    delta,
    worldWidth: state.worldWidth,
    height,
    radius: state.config.ballRadius,
    zoneWidth: state.config.zoneWidth,
    topPaddleBottom,
    bottomPaddleTop,
    menuHeight: CANVAS_MENU_HEIGHT,
    paddles,
    config: {
      maxBallSpeed: state.config.maxBallSpeed
    }
  });
}

function sendBallWorkerSpawnBall(x, y, minSpeed, maxSpeed) {
  if (!state.ballWorker) return;
  state.ballWorker.postMessage({
    type: 'spawnBall',
    x,
    y,
    minSpeed,
    maxSpeed
  });
}

function resetBallWorker() {
  if (!state.ballWorker) return;
  state.ballWorker.postMessage({ type: 'reset' });
  state.ballWorkerCount = 0;
  state.ballWorkerData = new Float32Array(0);
}

function resizeBallWorker(maxBalls) {
  if (!state.ballWorker) return;
  state.ballWorker.postMessage({ type: 'resize', maxBalls });
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

function lerp(start, end, t) {
  return start + (end - start) * t;
}

class BallEngine {
  constructor(maxBalls = 10000) {
    this.maxBalls = maxBalls;
    this.varsPerBall = 4; // x, y, vx, vy
    this.data = new Float32Array(this.maxBalls * this.varsPerBall);
    this.ballCount = 0;

    const N = 1024;
    this._trigN = N;
    this._trig = new Float32Array(N * 2);
    for (let i = 0; i < N; i += 1) {
      const angle = (i / N) * Math.PI * 2;
      this._trig[i * 2] = Math.cos(angle);
      this._trig[i * 2 + 1] = Math.sin(angle);
    }
  }

  spawnBall(x, y, speedMin, speedMax) {
    if (this.ballCount >= this.maxBalls) return;
    const angleIndex = (Math.random() * this._trigN) | 0;
    const ux = this._trig[angleIndex * 2];
    const uy = this._trig[angleIndex * 2 + 1];
    const speed = Math.random() * (speedMax - speedMin) + speedMin;
    const idx = this.ballCount * this.varsPerBall;
    this.data[idx] = x;
    this.data[idx + 1] = y;
    this.data[idx + 2] = speed * ux;
    this.data[idx + 3] = speed * uy;
    this.ballCount += 1;
  }

  spawnBallWithAngle(x, y, angleIndex, speed) {
    if (this.ballCount >= this.maxBalls) return;
    const idx = this.ballCount * this.varsPerBall;
    const ux = this._trig[(angleIndex % this._trigN) * 2];
    const uy = this._trig[(angleIndex % this._trigN) * 2 + 1];
    this.data[idx] = x;
    this.data[idx + 1] = y;
    this.data[idx + 2] = speed * ux;
    this.data[idx + 3] = speed * uy;
    this.ballCount += 1;
  }

  update(deltaTime) {
    const data = this.data;
    const V = this.varsPerBall;
    let idx = 0;
    for (let i = 0; i < this.ballCount; i += 1) {
      data[idx] += data[idx + 2] * deltaTime;
      data[idx + 1] += data[idx + 3] * deltaTime;
      idx += V;
    }
  }

  draw(ctx, size = 2, color = '#fff') {
    if (this.ballCount === 0) return;
    ctx.fillStyle = color;
    const data = this.data;
    const V = this.varsPerBall;
    let idx = 0;
    for (let i = 0; i < this.ballCount; i += 1) {
      ctx.fillRect(data[idx], data[idx + 1], size, size);
      idx += V;
    }
  }

  reset() {
    this.ballCount = 0;
  }
}

class PaddleEngine {
  constructor(maxPaddles = 200) {
    this.maxPaddles = maxPaddles;
    this.varsPerPaddle = 6; // x, y, width, height, targetX, sideIndex
    this.data = new Float32Array(this.maxPaddles * this.varsPerPaddle);
    this.speed = new Float32Array(this.maxPaddles);
    this.paddleCount = 0;
  }

  addPaddle(x, y, width, height, targetX, sideIndex = 0, moveSpeed = 240) {
    if (this.paddleCount >= this.maxPaddles) return;
    const idx = this.paddleCount * this.varsPerPaddle;
    this.data[idx] = x;
    this.data[idx + 1] = y;
    this.data[idx + 2] = width;
    this.data[idx + 3] = height;
    this.data[idx + 4] = targetX;
    this.data[idx + 5] = sideIndex;
    this.speed[this.paddleCount] = moveSpeed;
    this.paddleCount += 1;
  }

  setTarget(index, targetX) {
    if (index < 0 || index >= this.paddleCount) return;
    this.data[index * this.varsPerPaddle + 4] = targetX;
  }

  update(deltaTime) {
    const data = this.data;
    const V = this.varsPerPaddle;
    for (let i = 0, idx = 0; i < this.paddleCount; i += 1, idx += V) {
      const targetX = data[idx + 4];
      const x = data[idx];
      const dist = targetX - x;
      if (dist === 0) continue;
      const move = Math.sign(dist) * Math.min(Math.abs(dist), this.speed[i] * deltaTime);
      data[idx] = x + move;
    }
  }

  draw(ctx, color = '#fff') {
    if (this.paddleCount === 0) return;
    ctx.fillStyle = color;
    const data = this.data;
    const V = this.varsPerPaddle;
    for (let i = 0, idx = 0; i < this.paddleCount; i += 1, idx += V) {
      ctx.fillRect(data[idx], data[idx + 1], data[idx + 2], data[idx + 3]);
    }
  }

  reset() {
    this.paddleCount = 0;
  }
}

function getMenuFlashAlpha(side, zoneIndex) {
  return state.menuFlash[side]?.[zoneIndex] || 0;
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

function isOptionsMenuOpen() {
  return optionsMenu && !optionsMenu.classList.contains('hidden');
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
  const baseY = side === 'bottom'
    ? height - state.config.paddleHeight - CANVAS_MENU_HEIGHT - 1
    : CANVAS_MENU_HEIGHT + 1;
  return {
    id: makeId(isLocal ? 'me' : isBot ? 'bot' : 'pl'),
    name: name || (isBot ? `Bot-${Math.floor(Math.random() * 1000)}` : 'Player'),
    flag: flag || '',
    color: color || '#fff',
    side,
    score: 0,
    lastHit: 0,
    misses: 0,
    paddleX: null,
    paddleY: baseY,
    targetX: null,
    isBot,
    isLocal,
    active: true,
    barExpandStart: performance.now()
  };
}

function addPlayer(options, skipRefresh = false) {
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
  if (!skipRefresh) {
    syncWorld();
    updateUI();
  }
  return player;
}

function addBot(skipRefresh = false) {
  addPlayer({ isBot: true }, skipRefresh);
}

function addBots(count, batchSize = 50, callback) {
  let added = 0;
  const addNextBatch = () => {
    const end = Math.min(added + batchSize, count);
    for (; added < end; added += 1) {
      addBot(true);
    }
    if (added < count) {
      requestAnimationFrame(addNextBatch);
    } else {
      callback?.();
    }
  };
  addNextBatch();
}

function resetGame() {
  state.players = [];
  state.ballEngine?.reset();
  resetBallWorker();
  state.currentPlayerId = null;
  state.nextBallAt = performance.now() + state.config.spawnInterval;
  updateUI();
}

function movePlayerToStartLevel(player) {
  const side = player.side;
  if (!side) return;
  const index = state.players.findIndex((item) => item.id === player.id);
  if (index !== -1) {
    state.players.splice(index, 1);
  }
  const insertIndex = state.players.findIndex((item) => item.side === side);
  if (insertIndex === -1) {
    state.players.push(player);
  } else {
    state.players.splice(insertIndex, 0, player);
  }
  player.misses = 0;
  player.score = 0;
  player.paddleX = null;
  player.targetX = null;
  player.barWidth = null;
  player.barExpandStart = performance.now();
  player.lastHit = 0;
}

function restartGame(localOptions) {
  resetGame();
  for (let index = 0; index < state.config.startingBotCount; index += 1) {
    addBot(true);
  }
  addPlayer({
    isLocal: true,
    name: localOptions.name || 'You',
    flag: localOptions.flag || '',
    color: localOptions.color || '#fff',
    side: localOptions.side
  });
  spawnBall();
  updateUI();
}

function syncWorld() {
  const previousZones = new Map(state.players.map((player) => [player.id, player.zoneIndex]));
  const sideCounts = { top: 0, bottom: 0 };
  state.players.forEach((player) => {
    player.zoneIndex = sideCounts[player.side];
    sideCounts[player.side] += 1;
  });
  state.columnCount = Math.max(sideCounts.top, sideCounts.bottom);
  state.players.forEach((player) => {
    if (!player.isBot && previousZones.get(player.id) !== player.zoneIndex) {
      player.barExpandStart = performance.now();
    }
    const zoneLeft = player.zoneIndex * state.config.zoneWidth;
    const zoneRight = zoneLeft + state.config.zoneWidth;
    const width = getPlayerBarWidth(player);
    const defaultX = zoneLeft + (state.config.zoneWidth - width) / 2;
    player.paddleX = clamp(
      player.paddleX == null ? defaultX : player.paddleX,
      zoneLeft + 4,
      zoneRight - width - 4
    );
  });
  state.worldWidth = state.columnCount * state.config.zoneWidth;
  state.playersByZone = {
    top: Array.from({ length: state.columnCount }, () => null),
    bottom: Array.from({ length: state.columnCount }, () => null)
  };
  state.players.forEach((player) => {
    state.playersByZone[player.side][player.zoneIndex] = player;
  });
}

function spawnBall() {
  if (state.players.length === 0) return;
  const currentBallCount = getBallCount();
  if (currentBallCount >= state.config.maxBallCount) return;

  const { height } = getCanvasSize();
  const minY = state.config.topInset + CANVAS_MENU_HEIGHT + state.config.ballRadius + 12;
  const maxY = height - state.config.bottomInset - CANVAS_MENU_HEIGHT - state.config.ballRadius - 12;
  const startY = minY + Math.random() * (maxY - minY);
  if (state.ballWorker) {
    sendBallWorkerSpawnBall(8, startY, state.config.minBallSpeed * 10, state.config.maxBallSpeed * 10);
  } else {
    state.ballEngine.spawnBall(8, startY, state.config.minBallSpeed * 10, state.config.maxBallSpeed * 10);
  }
  updateUI();
}

function getPlayerBarWidth(player) {
  const fullWidth = state.config.zoneWidth;
  const defaultWidth = player.isBot ? state.config.botPaddleSize : state.config.playerPaddleSize;
  if (player.isBot) {
    return defaultWidth;
  }
  const elapsed = (performance.now() - (player.barExpandStart || 0)) / 1000;
  if (elapsed < 2) return fullWidth;
  if (elapsed < 6) {
    return lerp(fullWidth, defaultWidth, (elapsed - 2) / 4);
  }
  return defaultWidth;
}

function playerPaddleBounds(player) {
  const { height } = getCanvasSize();
  const zoneLeft = player.zoneIndex * state.config.zoneWidth;
  const zoneRight = zoneLeft + state.config.zoneWidth;
  const width = getPlayerBarWidth(player);

  if (player.paddleX == null) {
    player.paddleX = zoneLeft + (state.config.zoneWidth - width) / 2;
  } else {
    const previousWidth = player.barWidth || width;
    const centerX = player.paddleX + previousWidth / 2;
    player.paddleX = centerX - width / 2;
  }

  const x = clamp(
    player.paddleX,
    zoneLeft + 4,
    zoneRight - width - 4
  );
  player.paddleX = x;
  player.barWidth = width;

  const y = player.side === 'bottom'
    ? height - state.config.paddleHeight - CANVAS_MENU_HEIGHT - 1
    : CANVAS_MENU_HEIGHT + 1;
  return {
    x,
    y,
    width,
    height: state.config.paddleHeight
  };
}

function getZonePlayer(zoneIndex, side) {
  return state.playersByZone?.[side]?.[zoneIndex] || null;
}

function hitPaddle(player, ball) {
  const paddle = playerPaddleBounds(player);
  const hitX = ball.x - (paddle.x + paddle.width / 2);
  const normalized = clamp(hitX / (paddle.width / 2), -1, 1);
  if ((player.side === 'top' && ball.vy < 0) || (player.side === 'bottom' && ball.vy > 0)) {
    const incomingFromLeft = ball.vx > 0;
    const incomingFromRight = ball.vx < 0;
    const edgeAngle = (4.5 * Math.PI) / 180;
    const speed = Math.hypot(ball.vx, ball.vy);
    if (speed === 0) return;

    let outVx = 0;
    let outVy = 0;
    const absVx = Math.abs(ball.vx);
    const incomingAngle = Math.atan2(Math.abs(ball.vy), absVx);

    if (incomingFromLeft) {
      if (normalized <= 0) {
        const xFactor = 1 + 2 * normalized;
        outVx = xFactor * absVx;
        outVy = -ball.vy;
      } else {
        const bounceAngle = incomingAngle * (1 - normalized) + edgeAngle * normalized;
        outVx = speed * Math.cos(bounceAngle);
        outVy = -Math.sign(ball.vy) * speed * Math.sin(bounceAngle);
      }
    } else if (incomingFromRight) {
      if (normalized >= 0) {
        const xFactor = 1 - 2 * normalized;
        outVx = -absVx * xFactor;
        outVy = -ball.vy;
      } else {
        const bounceAngle = incomingAngle * (1 + normalized) + edgeAngle * -normalized;
        outVx = -speed * Math.cos(bounceAngle);
        outVy = -Math.sign(ball.vy) * speed * Math.sin(bounceAngle);
      }
    }

    const edgeBoost = incomingFromLeft
      ? Math.max(0, normalized)
      : Math.max(0, -normalized);
    const boostFactor = 1 + 0.2 * edgeBoost;
    const maxSpeed = state.config.maxBallSpeed * 10;
    const finalSpeed = Math.min(speed * boostFactor, maxSpeed);
    const scale = finalSpeed / speed;
    ball.vx = outVx * scale;
    ball.vy = outVy * scale;

    ball.y = player.side === 'top'
      ? paddle.y + paddle.height + ball.radius + 1
      : paddle.y - ball.radius - 1;
    player.score += 1;
    player.lastHit = performance.now();
    updateUI();
  }
}

function eliminatePlayer(player) {
  player.misses = clamp((player.misses || 0) + 1, 0, 3);
  if (player.misses < 3) {
    updateUI();
    return;
  }

  movePlayerToStartLevel(player);
  syncWorld();
  updateUI();
}

function updateBalls(delta) {
  const engine = state.ballEngine;
  if (!engine || engine.ballCount === 0) return;

  const data = engine.data;
  const V = engine.varsPerBall;
  const { height } = getCanvasSize();
  const worldRight = state.worldWidth;
  const radius = state.config.ballRadius;
  const topPaddleBottom = CANVAS_MENU_HEIGHT + 1 + state.config.paddleHeight;
  const bottomPaddleTop = height - state.config.paddleHeight - CANVAS_MENU_HEIGHT - 1;

  let writeIdx = 0;
  for (let i = 0, readIdx = 0; i < engine.ballCount; i += 1, readIdx += V) {
    let x = data[readIdx];
    let y = data[readIdx + 1];
    let vx = data[readIdx + 2];
    let vy = data[readIdx + 3];

    x += vx * delta;
    y += vy * delta;

    if (x - radius <= 0) {
      x = radius;
      vx = Math.abs(vx);
    } else if (x + radius >= worldRight) {
      x = worldRight - radius;
      vx = -Math.abs(vx);
    }

    const baseZone = Math.max(0, Math.min(state.columnCount - 1, Math.floor(x / state.config.zoneWidth)));
    const zones = [baseZone];
    const zoneLeftEdge = baseZone * state.config.zoneWidth;
    const zoneRightEdge = zoneLeftEdge + state.config.zoneWidth;
    if (x - radius < zoneLeftEdge && baseZone > 0) zones.push(baseZone - 1);
    if (x + radius > zoneRightEdge && baseZone < state.columnCount - 1) zones.push(baseZone + 1);

    const ball = { x, y, vx, vy, radius };
    if (vy < 0 && y - radius <= topPaddleBottom) {
      for (const zoneIndex of zones) {
        const player = getZonePlayer(zoneIndex, 'top');
        if (!player) continue;
        const paddle = playerPaddleBounds(player);
        if (
          x + radius >= paddle.x &&
          x - radius <= paddle.x + paddle.width &&
          y + radius >= paddle.y &&
          y - radius <= paddle.y + paddle.height
        ) {
          hitPaddle(player, ball);
          x = ball.x;
          y = ball.y;
          vx = ball.vx;
          vy = ball.vy;
          break;
        }
      }
    } else if (vy > 0 && y + radius >= bottomPaddleTop) {
      for (const zoneIndex of zones) {
        const player = getZonePlayer(zoneIndex, 'bottom');
        if (!player) continue;
        const paddle = playerPaddleBounds(player);
        if (
          x + radius >= paddle.x &&
          x - radius <= paddle.x + paddle.width &&
          y + radius >= paddle.y &&
          y - radius <= paddle.y + paddle.height
        ) {
          hitPaddle(player, ball);
          x = ball.x;
          y = ball.y;
          vx = ball.vx;
          vy = ball.vy;
          break;
        }
      }
    }

    const zoneIndex = Math.max(0, Math.min(state.columnCount - 1, Math.floor(x / state.config.zoneWidth)));
    const topHit = y - radius <= CANVAS_MENU_HEIGHT;
    const bottomHit = y + radius >= height - CANVAS_MENU_HEIGHT;
    if (topHit || bottomHit) {
      const side = topHit ? 'top' : 'bottom';
      state.menuFlash[side][zoneIndex] = 1;
      const player = getZonePlayer(zoneIndex, side);
      if (player) {
        eliminatePlayer(player);
        continue;
      }
    }

    const outOfRangeHorizontally = x + radius < -60 || x - radius > state.worldWidth + 60;
    const outOfRangeVertically = y + radius < -60 || y - radius > height + 60;
    if (!outOfRangeHorizontally && !outOfRangeVertically) {
      data[writeIdx] = x;
      data[writeIdx + 1] = y;
      data[writeIdx + 2] = vx;
      data[writeIdx + 3] = vy;
      writeIdx += V;
    }
  }
  engine.ballCount = writeIdx / V;
}

function updateBots(delta) {
  const engine = state.ballEngine;
  const ballCount = getBallCount();
  const data = getBallData();
  const zoneBalls = Array.from({ length: state.columnCount }, () => []);
  if (ballCount > 0) {
    const V = engine ? engine.varsPerBall : 4;
    for (let i = 0, idx = 0; i < ballCount; i += 1, idx += V) {
      const vx = data[idx + 2];
      if (vx <= 0) continue;
      const x = data[idx];
      const zoneIndex = Math.max(0, Math.min(state.columnCount - 1, Math.floor(x / state.config.zoneWidth)));
      zoneBalls[zoneIndex].push(x);
    }
  }

  for (const player of state.players) {
    if (!player.isBot) continue;
    const paddle = playerPaddleBounds(player);
    let target = paddle.x + paddle.width / 2;

    const inZoneBalls = zoneBalls[player.zoneIndex];
    if (inZoneBalls.length > 0) {
      target = inZoneBalls[0];
    }

    const zoneLeft = player.zoneIndex * state.config.zoneWidth;
    const zoneRight = zoneLeft + state.config.zoneWidth;
    player.targetX = clamp(target - paddle.width / 2, zoneLeft + 4, zoneRight - paddle.width - 4);
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
      const paddle = playerPaddleBounds(current);
      const speed = 96;
      current.paddleX = clamp(
        current.paddleX + direction * speed * delta,
        zoneLeft + 4,
        zoneRight - paddle.width - 4
      );
    }
  }
  if (state.ballWorker) {
    sendBallWorkerUpdate(delta);
  } else {
    updateBalls(delta);
  }
  updateBots(delta);
  for (const side of ['top', 'bottom']) {
    for (const zoneIndex of Object.keys(state.menuFlash[side])) {
      state.menuFlash[side][zoneIndex] = clamp(state.menuFlash[side][zoneIndex] - delta, 0, 1);
      if (state.menuFlash[side][zoneIndex] <= 0) {
        delete state.menuFlash[side][zoneIndex];
      }
    }
  }

  const now = performance.now();
  const interval = Math.max(state.config.spawnInterval, 1);
  while (now >= state.nextBallAt) {
    spawnBall();
    state.nextBallAt += interval;
  }
}

function getCanvasHeight() {
  return 450;
}

function getViewScale() {
  return clamp(state.config.zoomLevel, 0.1, 1);
}

function drawMenuOverlay(cssWidth, cssHeight, viewScale, cameraX, worldHeight) {
  const menuScale = viewScale >= 0.7 ? 1 : viewScale / 0.7;
  const menuHeight = CANVAS_MENU_HEIGHT * menuScale;
  const courtHeight = worldHeight * viewScale;
  const radius = 4 * menuScale;
  const gap = 6 * menuScale;
  const padding = 8 * menuScale;
  const iconSize = PLAYER_ICON_SIZE * menuScale;
  const topY = (cssHeight - courtHeight) / 2;
  const bottomY = topY + courtHeight - menuHeight;
  const flipOverlay = getCurrentPlayer() && getCurrentPlayer().side === 'top' && state.config.flipTopView;
  const overlayTopY = flipOverlay ? bottomY : topY;
  const overlayBottomY = flipOverlay ? topY : bottomY;

  ctx.fillStyle = 'rgb(2, 2, 2)';
  ctx.fillRect(0, overlayTopY, cssWidth, menuHeight);
  ctx.fillRect(0, overlayBottomY, cssWidth, menuHeight);

  const visibleWorldLeft = cameraX;
  const visibleWorldRight = cameraX + cssWidth / viewScale;
  const visibleZoneStart = Math.max(0, Math.floor((visibleWorldLeft - 20) / state.config.zoneWidth));
  const visibleZoneEnd = Math.min(state.columnCount, Math.ceil((visibleWorldRight + 20) / state.config.zoneWidth));

  for (let zoneIndex = visibleZoneStart; zoneIndex < visibleZoneEnd; zoneIndex += 1) {
    const zoneLeft = (zoneIndex * state.config.zoneWidth - cameraX) * viewScale;
    const topFlash = getMenuFlashAlpha('top', zoneIndex);
    const bottomFlash = getMenuFlashAlpha('bottom', zoneIndex);
    if (topFlash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${topFlash * 0.85})`;
      ctx.fillRect(zoneLeft, overlayTopY, state.config.zoneWidth * viewScale, menuHeight);
    }
    if (bottomFlash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${bottomFlash * 0.85})`;
      ctx.fillRect(zoneLeft, overlayBottomY, state.config.zoneWidth * viewScale, menuHeight);
    }
  }

  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.textAlign = 'center';
  ctx.font = '400 1rem Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  for (let zoneIndex = visibleZoneStart; zoneIndex < visibleZoneEnd; zoneIndex += 1) {
    const zoneLeft = (zoneIndex * state.config.zoneWidth - cameraX) * viewScale;
    const zoneCenterX = zoneLeft + (state.config.zoneWidth * viewScale) / 2;
    const zoneCenterY = topY + (courtHeight / 2);
    ctx.fillText(String(zoneIndex + 1), zoneCenterX, zoneCenterY);
  }

  ctx.font = '9px ui-monospace, monospace';
  ctx.textBaseline = 'middle';

  for (let zoneIndex = 0; zoneIndex < state.columnCount; zoneIndex += 1) {
    const zoneLeft = (zoneIndex * state.config.zoneWidth - cameraX) * viewScale;
    const zoneRight = zoneLeft + state.config.zoneWidth * viewScale;
    const topPlayer = getZonePlayer(zoneIndex, 'top');
    const bottomPlayer = getZonePlayer(zoneIndex, 'bottom');

    const drawHeader = (player, y) => {
      if (!player) return;
      const iconX = zoneLeft + padding;
      const iconY = y;
      const icon = player.isBot ? PLAYER_ICONS.bot : PLAYER_ICONS.human;
      if (icon.complete && icon.naturalWidth) {
        ctx.drawImage(icon, iconX - iconSize / 2, iconY - iconSize / 2 - 1, iconSize, iconSize);
      } else {
        ctx.fillStyle = '#fff';
        if (player.isBot) {
          ctx.fillRect(iconX - iconSize / 2, iconY - iconSize / 2 - 1, iconSize, iconSize);
        } else {
          ctx.beginPath();
          ctx.arc(iconX, iconY - 1, iconSize / 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const displayName = player.isBot ? 'Bot' : player.name.slice(0, 8);
      ctx.fillStyle = player.color || '#fff';
      ctx.textAlign = 'left';
      ctx.font = `${Math.max(4, 9 * viewScale)}px ui-monospace, monospace`;
      ctx.fillText(displayName, iconX + iconSize + 1, y);

      const statsX = zoneRight - padding;
      ctx.font = `${Math.max(4, 12 * viewScale)}px ui-monospace, monospace`;
      ctx.textAlign = 'right';
      ctx.fillText(player.score, statsX, y);
      ctx.font = `${Math.max(8, 9 * viewScale)}px ui-monospace, monospace`;

      for (let index = 0; index < 3; index += 1) {
        const alpha = index < (player.misses || 0) ? 0.2 : 0.8;
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.beginPath();
        ctx.arc(statsX - 40 * menuScale - index * (radius * 2 + gap), y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    drawHeader(topPlayer, overlayTopY + menuHeight / 2);
    drawHeader(bottomPlayer, overlayBottomY + menuHeight / 2);
  }
}

function cameraXForCurrentPlayer(viewScale) {
  const cssWidth = canvas.clientWidth;
  const selected = getCurrentPlayer();
  if (!selected) return state.cameraX;

  const visibleWorldWidth = cssWidth / viewScale;
  const zoneLeft = selected.zoneIndex * state.config.zoneWidth;
  const zoneRight = zoneLeft + state.config.zoneWidth;
  const viewLeft = state.cameraX;
  const viewRight = viewLeft + visibleWorldWidth;
  const zoneCenter = zoneLeft + state.config.zoneWidth / 2;
  const targetCameraX = zoneCenter - visibleWorldWidth / 2;

  if (zoneLeft >= viewLeft && zoneRight <= viewRight && state.cameraXTarget === state.cameraX) {
    return state.cameraX;
  }

  return targetCameraX;
}

function render() {
  const cssWidth = canvas.clientWidth;
  const cssHeight = canvas.clientHeight;
  const worldHeight = getCanvasHeight();
  ctx.clearRect(0, 0, cssWidth, cssHeight);
  const viewScale = getViewScale();
  const targetCameraX = cameraXForCurrentPlayer(viewScale);
  const now = performance.now();
  if (targetCameraX !== state.cameraXTarget) {
    state.cameraXTarget = targetCameraX;
    state.cameraXStart = state.cameraX;
    state.cameraXStartTime = now;
  }
  const moveElapsed = now - state.cameraXStartTime;
  const progress = clamp(moveElapsed / 2000, 0, 1);
  state.cameraX = lerp(state.cameraXStart, state.cameraXTarget, progress);
  const yOffset = (cssHeight - worldHeight * viewScale) / 2;
  ctx.save();
  ctx.translate(0, yOffset);
  ctx.scale(viewScale, viewScale);
  ctx.translate(-state.cameraX, 0);

  const current = getCurrentPlayer();
  if (current && current.side === 'top' && state.config.flipTopView) {
    ctx.translate(0, worldHeight);
    ctx.scale(1, -1);
  }
// maincolor background
  ctx.fillStyle = '#212121';
  ctx.fillRect(0, 0, state.worldWidth, worldHeight);

  const visibleWorldLeft = state.cameraX;
  const visibleWorldRight = state.cameraX + cssWidth / viewScale;
  const visibleZoneStart = Math.max(0, Math.floor((visibleWorldLeft - 20) / state.config.zoneWidth));
  const visibleZoneEnd = Math.min(state.columnCount, Math.ceil((visibleWorldRight + 20) / state.config.zoneWidth));

  ctx.strokeStyle = '#444444';
  ctx.lineWidth = 1;
  for (let index = visibleZoneStart; index <= visibleZoneEnd; index += 1) {
    const x = index * state.config.zoneWidth;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, worldHeight);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  for (let index = visibleZoneStart; index < visibleZoneEnd; index += 1) {
    ctx.fillRect(index * state.config.zoneWidth, 0, state.config.zoneWidth, worldHeight);
  }

  for (const player of state.players) {
    if (player.zoneIndex < visibleZoneStart || player.zoneIndex >= visibleZoneEnd) continue;
    const zoneLeft = player.zoneIndex * state.config.zoneWidth;
    const zoneRight = zoneLeft + state.config.zoneWidth;
    const isCurrent = player.id === state.currentPlayerId;
    const bgAlpha = player.side === 'bottom' ? 0.06 : 0.04;

    ctx.fillStyle = `rgba(255,255,255,${bgAlpha})`;
    ctx.fillRect(zoneLeft, 0, state.config.zoneWidth, worldHeight);

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
  }

  if (gl) {
    drawWebGLBalls(cssWidth, cssHeight, worldHeight, viewScale);
  } else {
    const visibleWorldLeft = state.cameraX;
    const visibleWorldRight = state.cameraX + cssWidth / viewScale;
    const ballCount = getBallCount();
    const data = getBallData();
    if (ballCount > 0) {
      const V = 4;
      const size = state.config.ballRadius * 2;
      ctx.fillStyle = '#fff';
      for (let i = 0, idx = 0; i < ballCount; i += 1, idx += V) {
        const x = data[idx];
        const y = data[idx + 1];
        if (x + state.config.ballRadius < visibleWorldLeft || x - state.config.ballRadius > visibleWorldRight) {
          continue;
        }
        ctx.fillRect(x - state.config.ballRadius, y - state.config.ballRadius, size, size);
      }
    }
  }

  ctx.restore();
  drawMenuOverlay(cssWidth, cssHeight, viewScale, state.cameraX, worldHeight);
}

function refreshCounts() {
  const currentBallCount = getBallCount();
  if (playerCountEl) playerCountEl.textContent = state.players.length;
  if (ballCountEl) ballCountEl.textContent = currentBallCount;
  if (canvasPlayerCountEl) canvasPlayerCountEl.textContent = state.players.length;
  if (canvasBallCountEl) canvasBallCountEl.textContent = currentBallCount;
}

function updateUI() {
  syncWorld();
  if (!state.currentPlayerId && state.players.length) {
    const localPlayer = state.players.find((player) => player.isLocal);
    state.currentPlayerId = localPlayer ? localPlayer.id : state.players[0].id;
  }
  resizeCanvas();
}

function resizeCanvas() {
  canvas.style.height = `${getCanvasHeight()}px`;
  if (ballCanvas) {
    ballCanvas.style.height = `${getCanvasHeight()}px`;
  }
  const rect = canvas.getBoundingClientRect();
  const pixelRatio = Math.min(MAX_CANVAS_PIXEL_RATIO, devicePixelRatio);
  canvas.width = Math.floor(rect.width * pixelRatio);
  canvas.height = Math.floor(rect.height * pixelRatio);
  if (ballCanvas) {
    ballCanvas.width = canvas.width;
    ballCanvas.height = canvas.height;
    ballCanvas.style.width = `${rect.width}px`;
    ballCanvas.style.height = `${rect.height}px`;
  }
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  glPixelRatio = pixelRatio;
  if (gl) {
    gl.viewport(0, 0, ballCanvas.width, ballCanvas.height);
  }
  render();
}

function attachEvents() {
  joinButton.addEventListener('click', () => {
    if (state.currentPlayerId) return;
    addPlayer({
      name: playerNameInput.value.trim() || 'You',
      flag: '',
      color: playerColorInput.value,
      isLocal: true
    });
  });
  addBotButton.addEventListener('click', addBot);

  playerNameInput.addEventListener('input', saveSettings);

  cameraZoomInput.addEventListener('input', () => {
    const value = Number(cameraZoomInput.value);
    state.config.zoomLevel = value;
    cameraZoomLabel.textContent = `${Math.round(value * 100)}%`;
    render();
  });
  cameraZoomInput.addEventListener('change', () => {
    saveSettings();
  });

  let pinchPointers = new Map();
  let pinchStartDistance = 0;
  let pinchStartZoom = state.config.zoomLevel;

  const getPointerDistance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  const updatePinchZoom = () => {
    if (pinchPointers.size !== 2) return;
    const [first, second] = Array.from(pinchPointers.values());
    const distance = getPointerDistance(first, second);
    if (!pinchStartDistance) {
      pinchStartDistance = distance;
      pinchStartZoom = state.config.zoomLevel;
      return;
    }
    if (pinchStartDistance > 0) {
      const ratio = distance / pinchStartDistance;
      setCameraZoom(pinchStartZoom * ratio);
    }
  };

  const updateZoomFromWheel = (event) => {
    event.preventDefault();
    const delta = event.deltaY;
    const step = event.shiftKey ? 0.02 : 0.05;
    const direction = delta > 0 ? -1 : 1;
    setCameraZoom(state.config.zoomLevel + direction * step);
  };

  gamePanel.addEventListener('wheel', updateZoomFromWheel, { passive: false });
  gamePanel.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'touch') return;
    pinchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinchPointers.size === 2) {
      pinchStartDistance = 0;
      pinchStartZoom = state.config.zoomLevel;
    }
  });

  gamePanel.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'touch') return;
    if (!pinchPointers.has(event.pointerId)) return;
    pinchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    updatePinchZoom();
  });

  const endPinch = (event) => {
    if (event.pointerType !== 'touch') return;
    pinchPointers.delete(event.pointerId);
    if (pinchPointers.size < 2) {
      pinchStartDistance = 0;
    }
  };

  gamePanel.addEventListener('pointerup', endPinch);
  gamePanel.addEventListener('pointercancel', endPinch);

  ballIntervalInput.addEventListener('input', () => {
    setBallIntervalSeconds(Number(ballIntervalInput.value));
  });
  ballIntervalInput.addEventListener('change', () => {
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
  });
  minBallSpeedInput.addEventListener('change', () => {
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
  });
  maxBallSpeedInput.addEventListener('change', () => {
    saveSettings();
  });

  const applyMaxBallCount = () => {
    const value = clamp(Number(maxBallCountInput.value), 1, 10000);
    state.config.maxBallCount = value;
    maxBallCountInput.value = String(value);
    maxBallCountLabel.textContent = String(value);
    state.ballEngine = createBallEngine(value);
    resizeBallWorker(value);
    resizeWebGL(value);
    saveSettings();
  };

  maxBallCountInput.addEventListener('input', () => {
    maxBallCountLabel.textContent = String(clamp(Number(maxBallCountInput.value), 1, 10000));
  });
  maxBallCountInput.addEventListener('change', applyMaxBallCount);
  maxBallCountInput.addEventListener('pointerup', applyMaxBallCount);

  startingBotCountInput.addEventListener('input', () => {
    setStartingBotCount(Number(startingBotCountInput.value));
  });
  startingBotCountInput.addEventListener('change', () => {
    saveSettings();
  });

  playerPaddleSizeInput.addEventListener('input', () => {
    state.config.playerPaddleSize = clamp(Number(playerPaddleSizeInput.value), 10, 200);
    playerPaddleSizeLabel.textContent = String(state.config.playerPaddleSize);
    render();
  });
  playerPaddleSizeInput.addEventListener('change', () => {
    saveSettings();
  });

  botPaddleSizeInput.addEventListener('input', () => {
    state.config.botPaddleSize = clamp(Number(botPaddleSizeInput.value), 10, 200);
    botPaddleSizeLabel.textContent = String(state.config.botPaddleSize);
    render();
  });
  botPaddleSizeInput.addEventListener('change', () => {
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
    if (!optionsMenu.contains(event.target) && !optionsToggle.contains(event.target)) {
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
    const rawX = (event.clientX - rect.left) / getViewScale() + state.cameraX;
    const zoneLeft = current.zoneIndex * state.config.zoneWidth;
    const zoneRight = zoneLeft + state.config.zoneWidth;
    const paddle = playerPaddleBounds(current);
    current.paddleX = clamp(
      rawX,
      zoneLeft + 4,
      zoneRight - paddle.width - 4
    );
  }

  const dragTarget = gamePanel || canvas;
  dragTarget.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    dragTarget.setPointerCapture(event.pointerId);
    pointerMove(event);
  });
  dragTarget.addEventListener('pointermove', (event) => {
    if (event.buttons !== 1) return;
    pointerMove(event);
  });
  dragTarget.addEventListener('pointerup', (event) => {
    isDragging = false;
    if (event.pointerId != null && dragTarget.hasPointerCapture(event.pointerId)) {
      dragTarget.releasePointerCapture(event.pointerId);
    }
  });
  dragTarget.addEventListener('pointercancel', (event) => {
    isDragging = false;
    if (event.pointerId != null && dragTarget.hasPointerCapture(event.pointerId)) {
      dragTarget.releasePointerCapture(event.pointerId);
    }
  });
  dragTarget.addEventListener('pointerleave', () => {
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

  window.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      state.lastTick = performance.now();
      state.nextBallAt = performance.now() + state.config.spawnInterval;
      resizeCanvas();
      updateUI();
    }
  });

  window.addEventListener('focus', () => {
    state.lastTick = performance.now();
    state.nextBallAt = performance.now() + state.config.spawnInterval;
    resizeCanvas();
    updateUI();
  });

  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('load', resizeCanvas);
}

function gameLoop() {
  const now = performance.now();
  const frameTime = now - state.lastTick;
  state.frameTime = frameTime;
  state.fps = frameTime > 0 ? 1000 / frameTime : 0;
  state.lastTick = now;

  const delta = Math.min(0.018, frameTime / 16.67);
  if (frameTime > 1000) {
    state.nextBallAt = now + state.config.spawnInterval;
  }
  updateGame(delta);
  render();

  if (now - state.lastFpsUpdate >= 1000) {
    state.lastFpsUpdate = now;
    if (canvasFPSEl) canvasFPSEl.textContent = String(Math.round(state.fps));
    if (canvasFrameTimeEl) canvasFrameTimeEl.textContent = state.frameTime.toFixed(1);
    refreshCounts();
  }

  requestAnimationFrame(gameLoop);
}

function setup() {
  attachEvents();
  loadSettings();
  applySettingsToInputs();
  state.nextBallAt = performance.now() + state.config.spawnInterval;

  ballIntervalInput.min = String(BALL_INTERVAL_MIN_SEC);
  ballIntervalInput.max = String(BALL_INTERVAL_MAX_SEC);
  ballIntervalInput.step = String(BALL_INTERVAL_STEP_SEC);

  state.ballEngine = createBallEngine(state.config.maxBallCount);
  state.ballWorker = initBallWorker(state.config.maxBallCount);
  gl = initWebGL(state.config.maxBallCount);

  resizeCanvas();
  const startLocalPlayer = () => {
    addPlayer({
      isLocal: true,
      name: playerNameInput.value.trim() || 'You',
      flag: '',
      color: playerColorInput.value
    });
    spawnBall();
    updateUI();
    canvas.focus();
    requestAnimationFrame(gameLoop);
  };

  const botCount = state.config.startingBotCount;
  if (botCount > 0) {
    addBots(botCount, 50, startLocalPlayer);
  } else {
    startLocalPlayer();
  }
}

setup();
