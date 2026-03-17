'use client';

import { useCountdown } from '@/hooks/useCountdown';

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-accent-lime font-display text-4xl md:text-6xl font-extrabold tabular-nums">
        {String(value).padStart(2, '0')}
      </span>
      <span className="text-text-muted text-xs md:text-sm uppercase tracking-widest mt-1">
        {label}
      </span>
    </div>
  );
}

export default function Hero() {
  const { days, hours, minutes, seconds, passed } = useCountdown();

  const scrollDown = () => {
    const firstSection = document.getElementById('route');
    firstSection?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="hero-gradient relative flex flex-col items-center justify-center min-h-screen px-4 text-center">
      {/* Heading */}
      <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-extrabold uppercase tracking-tight text-text-primary">
        SYDNEY <span className="text-accent-violet">&rarr;</span> MELBOURNE
      </h1>

      {/* Subtitle */}
      <p className="mt-4 text-text-muted text-lg md:text-xl">
        Ultra Australia 2026 &middot; Road Trip Planner
      </p>

      {/* Countdown */}
      <div className="mt-12">
        {passed ? (
          <span className="font-display text-5xl md:text-7xl font-extrabold text-accent-lime animate-pulse">
            LET&apos;S GO!
          </span>
        ) : (
          <div className="flex items-center gap-4 md:gap-8">
            <CountdownUnit value={days} label="Days" />
            <span className="text-border text-2xl md:text-4xl font-thin select-none">|</span>
            <CountdownUnit value={hours} label="Hours" />
            <span className="text-border text-2xl md:text-4xl font-thin select-none">|</span>
            <CountdownUnit value={minutes} label="Minutes" />
            <span className="text-border text-2xl md:text-4xl font-thin select-none">|</span>
            <CountdownUnit value={seconds} label="Seconds" />
          </div>
        )}
      </div>

      {/* Scroll indicator */}
      <button
        onClick={scrollDown}
        aria-label="Scroll down"
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-text-muted hover:text-text-primary transition-colors animate-bounce"
      >
        <span className="text-xs uppercase tracking-widest">Scroll</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 5v14" />
          <path d="m19 12-7 7-7-7" />
        </svg>
      </button>
    </section>
  );
}
