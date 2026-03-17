'use client';

// Minimal floating user indicator — no nav bar
export default function Nav({ userName }: { userName: string | null }) {
  if (!userName) return null;

  return (
    <div className="fixed top-4 right-4 z-40">
      <span className="text-xs text-text-muted bg-white/80 backdrop-blur border border-border-light rounded-full px-3 py-1 shadow-sm">
        {userName}
      </span>
    </div>
  );
}
