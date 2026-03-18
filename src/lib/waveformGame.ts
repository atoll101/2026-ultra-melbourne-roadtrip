// Waveform Surfer – pure game engine (no React dependency)
// A tiny cat with DJ headphones surfs a scrolling audio waveform

// ── Config ──────────────────────────────────────────────────────

export interface GameConfig {
  width: number;
  height: number;
  gravity: number;
  boostImpulse: number;
  scrollSpeed: number;
  maxScrollSpeed: number;
  speedRamp: number;
  surferX: number;
  surferRadius: number;
  waveAmplitude: number;
  waveMidY: number;
  topMargin: number;
  segmentWidth: number;
}

export const DEFAULT_CONFIG: GameConfig = {
  width: 300,
  height: 120,
  gravity: 0.38,
  boostImpulse: -5.5,
  scrollSpeed: 2.0,
  maxScrollSpeed: 5.0,
  speedRamp: 0.001,
  surferX: 55,
  surferRadius: 6,
  waveAmplitude: 28,
  waveMidY: 65,
  topMargin: 8,
  segmentWidth: 20,
};

// ── State ───────────────────────────────────────────────────────

export type Phase = 'idle' | 'playing' | 'gameover';

export interface GameState {
  phase: Phase;
  surferY: number;
  surferVY: number;
  scrollOffset: number;
  currentSpeed: number;
  score: number;
  highScore: number;
  onWave: boolean;
  waveSegments: number[];
  frameCount: number;
  catBlink: number; // countdown to next blink
  catEarsUp: boolean;
  boostCooldown: number;
}

// ── Helpers ─────────────────────────────────────────────────────

function smoothStep(t: number): number {
  return t * t * (3 - 2 * t);
}

function ensureSegments(segments: number[], neededIndex: number, amplitude: number) {
  while (segments.length <= neededIndex + 2) {
    const prev = segments[segments.length - 1] ?? 0;
    const idx = segments.length;
    const roll = Math.random();

    // don't generate gaps in the first 15 segments (grace period)
    const canGap = idx > 15;

    let value: number;
    if (canGap && roll < 0.12) {
      // GAP — wave plunges far below the canvas; cat must boost over
      // value of 80+ pushes wave to waveMidY(65)+80 = 145, well below canvas(120)
      value = 80 + Math.random() * 30;
    } else if (canGap && prev > 60) {
      // recovery after a gap — bring wave back up sharply
      value = -amplitude * (0.3 + Math.random() * 0.4);
    } else if (roll < 0.25) {
      // sharp rise — wave spikes up
      value = -amplitude * (0.5 + Math.random() * 0.5);
    } else {
      // normal — smooth variation
      const raw = (Math.random() - 0.5) * 2 * amplitude;
      value = prev * 0.35 + raw * 0.65;
    }

    segments.push(value);
  }
}

export function getWaveYAtX(
  scrollOffset: number,
  x: number,
  segments: number[],
  config: GameConfig,
): number {
  const worldX = x + scrollOffset;
  const segIdx = Math.floor(worldX / config.segmentWidth);
  const t = (worldX / config.segmentWidth) - segIdx;

  ensureSegments(segments, segIdx + 1, config.waveAmplitude);

  const a = segments[segIdx] ?? 0;
  const b = segments[segIdx + 1] ?? 0;
  const interpolated = a + smoothStep(t) * (b - a);

  // add a secondary ripple for texture
  const ripple = Math.sin(worldX * 0.1) * 6;
  return config.waveMidY + interpolated + ripple;
}

// ── State transitions ───────────────────────────────────────────

export function createInitialState(config: GameConfig, highScore: number): GameState {
  const segments: number[] = [];
  ensureSegments(segments, 30, config.waveAmplitude);
  return {
    phase: 'idle',
    surferY: config.waveMidY,
    surferVY: 0,
    scrollOffset: 0,
    currentSpeed: config.scrollSpeed,
    score: 0,
    highScore,
    onWave: true,

    waveSegments: segments,
    frameCount: 0,
    catBlink: 60,
    catEarsUp: false,
    boostCooldown: 0,
  };
}

export function startGame(state: GameState, config: GameConfig): GameState {
  const segments: number[] = [];
  ensureSegments(segments, 30, config.waveAmplitude);
  const waveY = getWaveYAtX(0, config.surferX, segments, config);
  return {
    ...state,
    phase: 'playing',
    surferY: waveY,
    surferVY: 0,
    scrollOffset: 0,
    currentSpeed: config.scrollSpeed,
    score: 0,
    onWave: true,

    waveSegments: segments,
    frameCount: 0,
    catEarsUp: false,
    boostCooldown: 0,
  };
}

export function boost(state: GameState, config: GameConfig): GameState {
  if (state.phase !== 'playing') return state;
  return {
    ...state,
    surferVY: config.boostImpulse,
    onWave: false,
    catEarsUp: true,
    boostCooldown: 20,
  };
}

export function tick(state: GameState, config: GameConfig): GameState {
  if (state.phase !== 'playing') return state;

  const s = { ...state };
  s.frameCount++;

  // blink timer
  s.catBlink--;
  if (s.catBlink <= 0) {
    s.catBlink = 80 + Math.floor(Math.random() * 100);
  }

  // boost cooldown
  if (s.boostCooldown > 0) s.boostCooldown--;
  if (s.boostCooldown === 0 && s.catEarsUp) s.catEarsUp = false;

  // gravity & position
  s.surferVY += config.gravity;
  s.surferY += s.surferVY;

  // wave surface at surfer position
  const waveY = getWaveYAtX(s.scrollOffset, config.surferX, s.waveSegments, config);

  // landing: only land on wave if it's actually on-screen (not a gap)
  const waveOnScreen = waveY < config.height;

  if (waveOnScreen && s.surferY >= waveY && s.surferVY >= 0) {
    // cat reached wave surface while falling — land
    s.surferY = waveY;
    s.surferVY = 0;
    s.onWave = true;
  } else if (waveOnScreen && s.onWave) {
    // riding the wave — follow it
    s.surferY = waveY;
    s.surferVY = 0;
  } else {
    // airborne — either wave is a gap (off-screen) or cat is above wave
    s.onWave = false;
  }

  // game over checks
  if (s.surferY > config.height + 10) {
    s.phase = 'gameover';
    if (s.score > s.highScore) s.highScore = s.score;
    return s;
  }
  if (s.surferY < config.topMargin) {
    s.phase = 'gameover';
    if (s.score > s.highScore) s.highScore = s.score;
    return s;
  }

  // scroll & speed
  s.scrollOffset += s.currentSpeed;
  s.currentSpeed = Math.min(s.currentSpeed + config.speedRamp, config.maxScrollSpeed);
  s.score = Math.floor(s.scrollOffset / 8);

  // extend segments as needed
  const neededIdx = Math.ceil((s.scrollOffset + config.width + 60) / config.segmentWidth);
  ensureSegments(s.waveSegments, neededIdx, config.waveAmplitude);

  return s;
}

// ── Rendering ───────────────────────────────────────────────────

const PURPLE = '#7C3AED';
const PINK = '#EC4899';
const BG = '#0a0a0a';

function drawWave(ctx: CanvasRenderingContext2D, state: GameState, config: GameConfig) {
  const { width, height } = config;

  // filled wave body with gradient
  const grad = ctx.createLinearGradient(0, config.waveMidY - config.waveAmplitude, 0, height);
  grad.addColorStop(0, 'rgba(124, 58, 237, 0.6)');
  grad.addColorStop(0.5, 'rgba(124, 58, 237, 0.15)');
  grad.addColorStop(1, 'rgba(124, 58, 237, 0.03)');

  ctx.beginPath();
  ctx.moveTo(0, height);
  for (let x = 0; x <= width; x += 2) {
    ctx.lineTo(x, getWaveYAtX(state.scrollOffset, x, state.waveSegments, config));
  }
  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // surface line with pulsing color
  const t = (Math.sin(state.scrollOffset * 0.025) + 1) / 2;
  const lineGrad = ctx.createLinearGradient(0, 0, width, 0);
  lineGrad.addColorStop(0, t > 0.5 ? PURPLE : PINK);
  lineGrad.addColorStop(0.5, '#a855f7');
  lineGrad.addColorStop(1, t > 0.5 ? PINK : PURPLE);

  ctx.beginPath();
  for (let x = 0; x <= width; x += 2) {
    const y = getWaveYAtX(state.scrollOffset, x, state.waveSegments, config);
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = lineGrad;
  ctx.lineWidth = 2;
  ctx.shadowColor = PURPLE;
  ctx.shadowBlur = 6;
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawCat(ctx: CanvasRenderingContext2D, state: GameState, config: GameConfig) {
  const x = config.surferX;
  const y = state.surferY;
  const r = config.surferRadius;
  const isBlinking = state.catBlink <= 4;

  ctx.save();

  // glow
  const glowPulse = Math.sin(state.frameCount * 0.08) * 3 + 8;
  ctx.shadowColor = PINK;
  ctx.shadowBlur = glowPulse;

  // body - round cat shape
  ctx.beginPath();
  ctx.arc(x, y - r, r, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.shadowBlur = 0;

  // ears
  const earSize = state.catEarsUp ? r * 0.7 : r * 0.55;
  const earY = y - r * 1.7;
  // left ear
  ctx.beginPath();
  ctx.moveTo(x - r * 0.7, earY + earSize * 0.5);
  ctx.lineTo(x - r * 0.35, earY - earSize * 0.5);
  ctx.lineTo(x - r * 0.05, earY + earSize * 0.3);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  // left inner ear
  ctx.beginPath();
  ctx.moveTo(x - r * 0.6, earY + earSize * 0.3);
  ctx.lineTo(x - r * 0.38, earY - earSize * 0.2);
  ctx.lineTo(x - r * 0.15, earY + earSize * 0.2);
  ctx.fillStyle = PINK;
  ctx.fill();
  // right ear
  ctx.beginPath();
  ctx.moveTo(x + r * 0.7, earY + earSize * 0.5);
  ctx.lineTo(x + r * 0.35, earY - earSize * 0.5);
  ctx.lineTo(x + r * 0.05, earY + earSize * 0.3);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  // right inner ear
  ctx.beginPath();
  ctx.moveTo(x + r * 0.6, earY + earSize * 0.3);
  ctx.lineTo(x + r * 0.38, earY - earSize * 0.2);
  ctx.lineTo(x + r * 0.15, earY + earSize * 0.2);
  ctx.fillStyle = PINK;
  ctx.fill();

  // headphones band
  ctx.beginPath();
  ctx.arc(x, y - r * 1.5, r * 0.85, Math.PI * 1.15, Math.PI * 1.85);
  ctx.strokeStyle = '#a855f7';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // headphone pads
  ctx.beginPath();
  ctx.ellipse(x - r * 0.9, y - r * 0.9, r * 0.3, r * 0.4, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#a855f7';
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + r * 0.9, y - r * 0.9, r * 0.3, r * 0.4, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#a855f7';
  ctx.fill();

  // face - eyes
  if (isBlinking) {
    // closed eyes (lines)
    ctx.beginPath();
    ctx.moveTo(x - r * 0.35, y - r);
    ctx.lineTo(x - r * 0.15, y - r);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + r * 0.15, y - r);
    ctx.lineTo(x + r * 0.35, y - r);
    ctx.stroke();
  } else if (state.phase === 'gameover') {
    // X eyes
    const ey = y - r;
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.4, ey - r * 0.15);
    ctx.lineTo(x - r * 0.15, ey + r * 0.15);
    ctx.moveTo(x - r * 0.15, ey - r * 0.15);
    ctx.lineTo(x - r * 0.4, ey + r * 0.15);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + r * 0.4, ey - r * 0.15);
    ctx.lineTo(x + r * 0.15, ey + r * 0.15);
    ctx.moveTo(x + r * 0.15, ey - r * 0.15);
    ctx.lineTo(x + r * 0.4, ey + r * 0.15);
    ctx.stroke();
  } else {
    // dot eyes
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(x - r * 0.3, y - r, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + r * 0.3, y - r, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }

  // blush marks
  ctx.fillStyle = 'rgba(236, 72, 153, 0.35)';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.5, y - r * 0.7, r * 0.15, r * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + r * 0.5, y - r * 0.7, r * 0.15, r * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();

  // mouth
  if (state.phase === 'gameover') {
    // sad/surprised mouth
    ctx.beginPath();
    ctx.arc(x, y - r * 0.55, r * 0.12, 0, Math.PI * 2);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  } else {
    // happy w mouth
    ctx.beginPath();
    ctx.moveTo(x - r * 0.15, y - r * 0.65);
    ctx.quadraticCurveTo(x - r * 0.07, y - r * 0.5, x, y - r * 0.65);
    ctx.quadraticCurveTo(x + r * 0.07, y - r * 0.5, x + r * 0.15, y - r * 0.65);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  ctx.restore();

  // music note trail when on wave
  if (state.onWave && state.phase === 'playing') {
    const noteAlpha = 0.3 + Math.sin(state.frameCount * 0.1) * 0.2;
    ctx.fillStyle = `rgba(168, 85, 247, ${noteAlpha})`;
    ctx.font = '7px serif';
    const noteX = x - r * 2.5 - Math.sin(state.frameCount * 0.15) * 3;
    const noteY = y - r * 1.2 - Math.cos(state.frameCount * 0.12) * 2;
    ctx.fillText('♪', noteX, noteY);
    const noteX2 = x - r * 3.8 - Math.cos(state.frameCount * 0.1) * 2;
    const noteY2 = y - r * 0.8 - Math.sin(state.frameCount * 0.08) * 3;
    ctx.fillStyle = `rgba(236, 72, 153, ${noteAlpha * 0.6})`;
    ctx.fillText('♫', noteX2, noteY2);
  }

  // sparkle particles when boosting
  if (state.catEarsUp && state.phase === 'playing') {
    for (let i = 0; i < 3; i++) {
      const sparkleX = x - r * 1.5 - i * 5 + Math.sin(state.frameCount * 0.2 + i) * 2;
      const sparkleY = y - r + Math.cos(state.frameCount * 0.15 + i * 2) * 4;
      const sparkleAlpha = 0.7 - i * 0.2;
      ctx.fillStyle = `rgba(255, 255, 255, ${sparkleAlpha})`;
      ctx.font = '5px serif';
      ctx.fillText('✦', sparkleX, sparkleY);
    }
  }
}

function drawScore(ctx: CanvasRenderingContext2D, state: GameState, config: GameConfig) {
  ctx.font = 'bold 9px "Space Grotesk", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.textAlign = 'right';
  ctx.fillText(`${state.score}`, config.width - 8, 14);
  ctx.textAlign = 'left';
}

function drawOverlay(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  config: GameConfig,
  text: string,
  subtext: string,
) {
  const { width, height } = config;

  // semi-transparent bg
  ctx.fillStyle = 'rgba(10, 10, 10, 0.55)';
  ctx.fillRect(0, 0, width, height);

  // main text
  ctx.font = 'bold 12px "Space Grotesk", sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.fillText(text, width / 2, height / 2 - 6);

  // subtext
  ctx.font = '9px "Space Grotesk", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillText(subtext, width / 2, height / 2 + 10);

  if (state.phase === 'gameover') {
    // show score & high score
    ctx.font = '8px "Space Grotesk", sans-serif';
    ctx.fillStyle = 'rgba(168, 85, 247, 0.8)';
    ctx.fillText(`score: ${state.score}  ·  best: ${state.highScore}`, width / 2, height / 2 + 24);
  }

  ctx.textAlign = 'left';
}

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  config: GameConfig,
) {
  const { width, height } = config;

  // clear
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, width, height);

  // wave
  drawWave(ctx, state, config);

  // cat surfer
  drawCat(ctx, state, config);

  // score (during play)
  if (state.phase === 'playing') {
    drawScore(ctx, state, config);
  }

  // overlays
  if (state.phase === 'idle') {
    drawOverlay(ctx, state, config, '♪ click to surf ♪', 'ride the waveform!');
  } else if (state.phase === 'gameover') {
    drawOverlay(ctx, state, config, 'game over!', 'click to retry');
  }
}
