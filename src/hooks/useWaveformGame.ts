'use client';

import { useEffect, useRef, useCallback, type RefObject } from 'react';
import {
  DEFAULT_CONFIG,
  createInitialState,
  startGame,
  boost,
  tick,
  renderFrame,
  type GameState,
} from '@/lib/waveformGame';

const HS_KEY = 'waveform-surfer-hs';

function readHighScore(): number {
  try {
    return Number(localStorage.getItem(HS_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeHighScore(score: number) {
  try {
    localStorage.setItem(HS_KEY, String(score));
  } catch {
    // ignore
  }
}

export function useWaveformGame(canvasRef: RefObject<HTMLCanvasElement | null>) {
  const stateRef = useRef<GameState | null>(null);
  const rafRef = useRef(0);
  const idleRafRef = useRef(0);

  // initialize state
  const getState = useCallback((): GameState => {
    if (!stateRef.current) {
      stateRef.current = createInitialState(DEFAULT_CONFIG, readHighScore());
    }
    return stateRef.current;
  }, []);

  // idle animation – slowly scroll the wave
  const idleLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const state = getState();
    if (state.phase !== 'idle') return;

    state.scrollOffset += 0.4;
    state.frameCount++;
    renderFrame(ctx, state, DEFAULT_CONFIG);
    idleRafRef.current = requestAnimationFrame(idleLoop);
  }, [canvasRef, getState]);

  // game loop
  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const state = getState();
    if (state.phase !== 'playing') {
      // render final frame (gameover) and start idle if needed
      renderFrame(ctx, state, DEFAULT_CONFIG);
      if (state.phase === 'gameover') {
        writeHighScore(state.highScore);
      }
      return;
    }

    stateRef.current = tick(state, DEFAULT_CONFIG);
    renderFrame(ctx, stateRef.current, DEFAULT_CONFIG);

    if (stateRef.current.phase === 'playing') {
      rafRef.current = requestAnimationFrame(gameLoop);
    } else {
      // game just ended
      renderFrame(ctx, stateRef.current, DEFAULT_CONFIG);
      writeHighScore(stateRef.current.highScore);
    }
  }, [canvasRef, getState]);

  // pointer handler
  const handlePointer = useCallback(() => {
    const state = getState();

    if (state.phase === 'idle' || state.phase === 'gameover') {
      cancelAnimationFrame(idleRafRef.current);
      stateRef.current = startGame(state, DEFAULT_CONFIG);
      rafRef.current = requestAnimationFrame(gameLoop);
    } else if (state.phase === 'playing') {
      stateRef.current = boost(state, DEFAULT_CONFIG);
    }
  }, [getState, gameLoop]);

  // keyboard handler
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        handlePointer();
      }
    },
    [handlePointer],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // initial render
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const state = getState();
      renderFrame(ctx, state, DEFAULT_CONFIG);
      // start idle animation
      idleRafRef.current = requestAnimationFrame(idleLoop);
    }

    canvas.addEventListener('pointerdown', handlePointer);
    window.addEventListener('keydown', handleKey);

    return () => {
      cancelAnimationFrame(rafRef.current);
      cancelAnimationFrame(idleRafRef.current);
      canvas.removeEventListener('pointerdown', handlePointer);
      window.removeEventListener('keydown', handleKey);
    };
  }, [canvasRef, getState, handlePointer, handleKey, idleLoop]);
}
