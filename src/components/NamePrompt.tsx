'use client';

import { useState, useEffect } from 'react';

interface NamePromptProps {
  onSubmit: (name: string) => void;
}

export default function NamePrompt({ onSubmit }: NamePromptProps) {
  const [value, setValue] = useState('');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger entrance animation on mount
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed) {
      onSubmit(trimmed);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 transition-opacity duration-500"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-md mx-4 rounded-2xl bg-surface border border-border p-8 shadow-2xl transition-all duration-500"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'scale(1)' : 'scale(0.9)',
        }}
      >
        <h2 className="font-display text-3xl font-bold text-text-primary mb-6 text-center">
          What&apos;s your name?
        </h2>

        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Enter your name..."
          autoFocus
          className="w-full rounded-xl bg-surface-alt border border-border px-4 py-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-violet transition-colors"
        />

        <button
          type="submit"
          disabled={!value.trim()}
          className="mt-4 w-full rounded-xl bg-accent-violet px-6 py-3 font-display font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Let&apos;s go
        </button>
      </form>
    </div>
  );
}
