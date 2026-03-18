'use client';

import { useCountdown } from '@/hooks/useCountdown';
import WaveformSurfer from './WaveformSurfer';

export default function Hero() {
  const { days, hours, minutes, seconds, passed } = useCountdown();

  return (
    <section className="relative overflow-hidden bg-[#0a0a0a]">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-pink-900/20" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(124,58,237,0.15),transparent_70%)]" />

      <div className="relative z-10 pt-10 pb-8 px-4 md:px-6 max-w-3xl mx-auto text-center">
        {/* Ultra logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://ultraaustralia.com/wp-content/uploads/2018/06/australia-logo.png"
          alt="Ultra Australia"
          className="h-12 md:h-16 mx-auto mb-6 brightness-0 invert opacity-90"
        />

        <h1 className="font-display text-2xl md:text-4xl font-extrabold tracking-tight text-white">
          Sydney <span className="text-purple-400">→</span> Melbourne
        </h1>

        <p className="mt-2 text-white/50 text-sm">
          Apr 8&ndash;12 &middot; Road trip planner
        </p>

        <div className="mt-5 mb-2 flex items-center justify-center gap-3 text-sm">
          {passed ? (
            <span className="font-display font-bold text-purple-400 text-lg">LET&apos;S GO!</span>
          ) : (
            <>
              <div className="flex gap-2">
                {[
                  { val: days, label: 'd' },
                  { val: hours, label: 'h' },
                  { val: minutes, label: 'm' },
                  { val: seconds, label: 's' },
                ].map(({ val, label }) => (
                  <div key={label} className="bg-white/10 rounded-lg px-3 py-1.5 backdrop-blur-sm">
                    <span className="font-display text-lg font-bold text-white tabular-nums">{val}</span>
                    <span className="text-white/40 text-xs ml-0.5">{label}</span>
                  </div>
                ))}
              </div>
              <span className="text-white/40 text-xs">until departure</span>
            </>
          )}
        </div>

        <WaveformSurfer />
      </div>
    </section>
  );
}
