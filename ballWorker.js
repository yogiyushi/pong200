const state = {
  engine: null
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
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

  reset() {
    this.ballCount = 0;
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
}

function resizeEngine(maxBalls) {
  const previous = state.engine;
  const engine = new BallEngine(maxBalls);
  if (previous && previous.ballCount > 0) {
    const copyCount = Math.min(previous.ballCount, maxBalls);
    engine.ballCount = copyCount;
    engine.data.set(previous.data.subarray(0, copyCount * previous.varsPerBall));
  }
  state.engine = engine;
}

function getZonePlayer(paddles, side, zoneIndex) {
  return paddles?.[side]?.[zoneIndex] || null;
}

function hitPaddle(player, x, y, vx, vy, config, radius) {
  const hitX = x - (player.x + player.width / 2);
  const normalized = clamp(hitX / (player.width / 2), -1, 1);
  if ((player.side === 'top' && vy < 0) || (player.side === 'bottom' && vy > 0)) {
    const incomingFromLeft = vx > 0;
    const edgeAngle = (4.5 * Math.PI) / 180;
    const speed = Math.hypot(vx, vy);
    if (speed === 0) return null;

    let outVx = 0;
    let outVy = 0;
    const absVx = Math.abs(vx);
    const incomingAngle = Math.atan2(Math.abs(vy), absVx);

    if (incomingFromLeft) {
      if (normalized <= 0) {
        const xFactor = 1 + 2 * normalized;
        outVx = xFactor * absVx;
        outVy = -vy;
      } else {
        const bounceAngle = incomingAngle * (1 - normalized) + edgeAngle * normalized;
        outVx = speed * Math.cos(bounceAngle);
        outVy = -Math.sign(vy) * speed * Math.sin(bounceAngle);
      }
    } else {
      if (normalized >= 0) {
        const xFactor = 1 - 2 * normalized;
        outVx = -absVx * xFactor;
        outVy = -vy;
      } else {
        const bounceAngle = incomingAngle * (1 + normalized) + edgeAngle * -normalized;
        outVx = -speed * Math.cos(bounceAngle);
        outVy = -Math.sign(vy) * speed * Math.sin(bounceAngle);
      }
    }

    const edgeBoost = incomingFromLeft ? Math.max(0, normalized) : Math.max(0, -normalized);
    const boostFactor = 1 + 0.2 * edgeBoost;
    const maxSpeed = config.maxBallSpeed * 10;
    const finalSpeed = Math.min(speed * boostFactor, maxSpeed);
    const scale = finalSpeed / speed;
    const newVx = outVx * scale;
    const newVy = outVy * scale;
    const newY = player.side === 'top'
      ? player.y + player.height + radius + 1
      : player.y - radius - 1;
    return {
      type: 'hit',
      playerId: player.id,
      vx: newVx,
      vy: newVy,
      y: newY
    };
  }
  return null;
}

function updateBalls(params) {
  const engine = state.engine;
  if (!engine || engine.ballCount === 0) {
    return {
      ballCount: 0,
      data: new Float32Array(0),
      events: [],
      flashes: []
    };
  }

  const {
    delta,
    worldWidth,
    height,
    radius,
    zoneWidth,
    topPaddleBottom,
    bottomPaddleTop,
    menuHeight,
    paddles,
    config
  } = params;

  const data = engine.data;
  const V = engine.varsPerBall;
  let writeIdx = 0;
  const events = [];
  const flashes = [];
  const totalZones = Math.max(1, Math.ceil(worldWidth / zoneWidth));

  for (let readIdx = 0; readIdx < engine.ballCount * V; readIdx += V) {
    let x = data[readIdx];
    let y = data[readIdx + 1];
    let vx = data[readIdx + 2];
    let vy = data[readIdx + 3];

    x += vx * delta;
    y += vy * delta;

    if (x - radius <= 0) {
      x = radius;
      vx = Math.abs(vx);
    } else if (x + radius >= worldWidth) {
      x = worldWidth - radius;
      vx = -Math.abs(vx);
    }

    const baseZone = Math.max(0, Math.min(Math.floor(x / zoneWidth), totalZones - 1));
    const zones = [baseZone];
    const zoneLeftEdge = baseZone * zoneWidth;
    const zoneRightEdge = zoneLeftEdge + zoneWidth;
    if (x - radius < zoneLeftEdge && baseZone > 0) zones.push(baseZone - 1);
    if (x + radius > zoneRightEdge && baseZone < totalZones - 1) zones.push(baseZone + 1);

    if (vy < 0 && y - radius <= topPaddleBottom) {
      for (let j = 0; j < zones.length; j += 1) {
        const player = getZonePlayer(paddles, 'top', zones[j]);
        if (!player) continue;
        if (
          x + radius >= player.x &&
          x - radius <= player.x + player.width &&
          y + radius >= player.y &&
          y - radius <= player.y + player.height
        ) {
          const event = hitPaddle(player, x, y, vx, vy, config, radius);
          if (event) {
            events.push(event);
            vx = event.vx;
            vy = event.vy;
            y = event.y;
          }
          break;
        }
      }
    } else if (vy > 0 && y + radius >= bottomPaddleTop) {
      for (let j = 0; j < zones.length; j += 1) {
        const player = getZonePlayer(paddles, 'bottom', zones[j]);
        if (!player) continue;
        if (
          x + radius >= player.x &&
          x - radius <= player.x + player.width &&
          y + radius >= player.y &&
          y - radius <= player.y + player.height
        ) {
          const event = hitPaddle(player, x, y, vx, vy, config, radius);
          if (event) {
            events.push(event);
            vx = event.vx;
            vy = event.vy;
            y = event.y;
          }
          break;
        }
      }
    }

    const zoneIndex = Math.max(0, Math.min(Math.floor(x / zoneWidth), totalZones - 1));
    const topHit = y - radius <= menuHeight;
    const bottomHit = y + radius >= height - menuHeight;
    if (topHit || bottomHit) {
      const side = topHit ? 'top' : 'bottom';
      flashes.push({ side, zoneIndex });
      const player = getZonePlayer(paddles, side, zoneIndex);
      if (player) {
        events.push({ type: 'eliminate', playerId: player.id });
        continue;
      }
    }

    const outOfRangeHorizontally = x + radius < -60 || x - radius > worldWidth + 60;
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
  const transfer = new Float32Array(engine.ballCount * V);
  transfer.set(data.subarray(0, engine.ballCount * V));

  return {
    ballCount: engine.ballCount,
    data: transfer,
    events,
    flashes
  };
}

self.onmessage = (event) => {
  const message = event.data;
  switch (message.type) {
    case 'init':
      resizeEngine(message.maxBalls);
      break;
    case 'resize':
      resizeEngine(message.maxBalls);
      break;
    case 'reset':
      if (state.engine) state.engine.reset();
      break;
    case 'spawnBall':
      if (state.engine) {
        state.engine.spawnBall(message.x, message.y, message.minSpeed, message.maxSpeed);
      }
      break;
    case 'update': {
      const result = updateBalls(message);
      self.postMessage({
        type: 'updated',
        ballCount: result.ballCount,
        data: result.data.buffer,
        events: result.events,
        flashes: result.flashes
      }, [result.data.buffer]);
      break;
    }
    default:
      break;
  }
};
