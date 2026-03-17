'use client';

import { useState, useEffect, useCallback } from 'react';

interface NavProps {
  userName: string | null;
}

const NAV_LINKS = [
  { id: 'route', label: 'Route' },
  { id: 'itinerary', label: 'Itinerary' },
  { id: 'melbourne', label: 'Melbourne' },
  { id: 'notepad', label: 'Notepad' },
  { id: 'packing', label: 'Packing' },
] as const;

export default function Nav({ userName }: NavProps) {
  const [activeSection, setActiveSection] = useState<string>('');
  const [mobileOpen, setMobileOpen] = useState(false);

  // Scrollspy with IntersectionObserver
  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    NAV_LINKS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (!el) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setActiveSection(id);
          }
        },
        { rootMargin: '-20% 0px -60% 0px', threshold: 0 }
      );

      observer.observe(el);
      observers.push(observer);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: 'smooth' });
    setMobileOpen(false);
  }, []);

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-40 bg-surface/80 backdrop-blur-xl border-b border-border">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-4 h-16">
          {/* Logo */}
          <span className="font-display text-lg font-bold text-accent-violet shrink-0">
            SYD&rarr;MEL
          </span>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => scrollTo(id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeSection === id
                    ? 'text-accent-violet bg-accent-violet/10'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {userName && (
              <span className="hidden sm:inline-flex items-center rounded-full bg-accent-violet/20 px-3 py-1 text-xs font-medium text-accent-violet">
                {userName}
              </span>
            )}

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden flex flex-col justify-center items-center w-8 h-8 gap-1.5"
              aria-label="Toggle menu"
            >
              <span
                className={`block w-5 h-0.5 bg-text-primary transition-transform duration-300 ${
                  mobileOpen ? 'translate-y-2 rotate-45' : ''
                }`}
              />
              <span
                className={`block w-5 h-0.5 bg-text-primary transition-opacity duration-300 ${
                  mobileOpen ? 'opacity-0' : ''
                }`}
              />
              <span
                className={`block w-5 h-0.5 bg-text-primary transition-transform duration-300 ${
                  mobileOpen ? '-translate-y-2 -rotate-45' : ''
                }`}
              />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile drawer */}
      <div
        className={`fixed inset-0 z-30 md:hidden transition-opacity duration-300 ${
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />

        {/* Drawer */}
        <div
          className={`absolute top-16 right-0 w-64 h-[calc(100vh-4rem)] bg-surface border-l border-border p-6 transition-transform duration-300 ${
            mobileOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="flex flex-col gap-2">
            {NAV_LINKS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => scrollTo(id)}
                className={`text-left px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                  activeSection === id
                    ? 'text-accent-violet bg-accent-violet/10'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {userName && (
            <div className="mt-6 pt-6 border-t border-border">
              <span className="inline-flex items-center rounded-full bg-accent-violet/20 px-3 py-1 text-xs font-medium text-accent-violet">
                {userName}
              </span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
