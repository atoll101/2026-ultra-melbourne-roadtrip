'use client';

import { useCountdown } from '@/hooks/useCountdown';

export default function Hero() {
  const { days, hours, minutes, seconds, passed } = useCountdown();

  return (
    <section className="pt-16 pb-8 px-4 md:px-6 max-w-2xl mx-auto">
      <p className="text-text-muted text-xs tracking-[0.15em] uppercase mb-3">
        Ultra Australia 2026
      </p>

      <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight text-text-primary">
        Sydney → Melbourne
      </h1>

      <p className="mt-1 text-text-muted text-sm">
        Apr 8&ndash;12 &middot; Road trip planner
      </p>

      <div className="mt-6 flex items-baseline gap-3 text-sm text-text-muted">
        {passed ? (
          <span className="font-display font-bold text-accent">LET&apos;S GO!</span>
        ) : (
          <>
            <span className="font-display text-lg font-bold text-text-primary tabular-nums">{days}d {hours}h {minutes}m {seconds}s</span>
            <span>until departure</span>
          </>
        )}
      </div>

      <div className="mt-8 border-b border-border" />
    </section>
  );
}
