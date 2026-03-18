'use client';

import { useState, useEffect } from 'react';

const TRAVELERS = [
  { name: 'Anna', color: '#EC4899', emoji: '🌸' },
  { name: 'Jay', color: '#3B82F6', emoji: '🎧' },
  { name: 'Kat', color: '#F59E0B', emoji: '🐱' },
  { name: 'Rein', color: '#10B981', emoji: '🌧️' },
  { name: 'Yamin', color: '#7C3AED', emoji: '🎵' },
];

interface NamePromptProps {
  onSubmit: (name: string) => void;
}

export default function NamePrompt({ onSubmit }: NamePromptProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#141414] transition-opacity duration-500"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <div
        className="text-center transition-all duration-500"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(16px)',
        }}
      >
        <h2 className="font-display text-2xl md:text-3xl font-bold text-white mb-10">
          Who&apos;s on this trip?
        </h2>

        <div className="flex gap-5 md:gap-8 justify-center flex-wrap px-6">
          {TRAVELERS.map((t) => (
            <button
              key={t.name}
              onClick={() => onSubmit(t.name)}
              className="group flex flex-col items-center gap-3 transition-transform duration-200 hover:scale-110 active:scale-95"
            >
              <div
                className="w-20 h-20 md:w-24 md:h-24 rounded-lg flex items-center justify-center text-3xl md:text-4xl shadow-lg transition-all duration-200 group-hover:shadow-xl group-hover:ring-2 group-hover:ring-white/50"
                style={{ backgroundColor: t.color }}
              >
                {t.emoji}
              </div>
              <span className="text-sm md:text-base font-medium text-gray-400 group-hover:text-white transition-colors">
                {t.name}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
