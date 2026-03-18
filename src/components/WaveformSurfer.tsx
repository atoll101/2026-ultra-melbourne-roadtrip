'use client';

import { useRef } from 'react';
import { useWaveformGame } from '@/hooks/useWaveformGame';

export default function WaveformSurfer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useWaveformGame(canvasRef);

  return (
    <div className="mt-3 flex justify-center">
      <canvas
        ref={canvasRef}
        width={300}
        height={120}
        className="rounded-lg cursor-pointer select-none"
        style={{ touchAction: 'none' }}
        aria-label="Waveform Surfer mini-game. Click or tap to play."
        role="img"
      />
    </div>
  );
}
