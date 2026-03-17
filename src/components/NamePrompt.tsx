'use client';

import { useState, useEffect } from 'react';

interface NamePromptProps {
  onSubmit: (name: string) => void;
}

export default function NamePrompt({ onSubmit }: NamePromptProps) {
  const [value, setValue] = useState('');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed) onSubmit(trimmed);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm transition-opacity duration-300"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm mx-6 rounded-2xl bg-white border border-border p-8 shadow-xl transition-all duration-300"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(8px)',
        }}
      >
        <h2 className="font-display text-xl font-bold text-text-primary mb-1 text-center">
          What&apos;s your name?
        </h2>
        <p className="text-text-muted text-sm text-center mb-6">
          So everyone knows who&apos;s editing
        </p>

        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Your name"
          autoFocus
          className="w-full rounded-lg bg-surface-alt border border-border px-4 py-2.5 text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
        />

        <button
          type="submit"
          disabled={!value.trim()}
          className="mt-3 w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-30"
        >
          Continue
        </button>
      </form>
    </div>
  );
}
