'use client';

import dynamic from 'next/dynamic';
import { useUserName } from '@/hooks/useUserName';
import NamePrompt from '@/components/NamePrompt';
import Nav from '@/components/Nav';
import Hero from '@/components/Hero';
import MelbourneBoard from '@/components/MelbourneBoard';
import Itinerary from '@/components/Itinerary';
import SharedNotepad from '@/components/SharedNotepad';

const RouteMap = dynamic(() => import('@/components/RouteMap'), { ssr: false });

export default function Home() {
  const { name, setName, loaded } = useUserName();

  if (!loaded) return null;

  return (
    <>
      {!name && <NamePrompt onSubmit={setName} />}
      <Nav userName={name} />
      <main className="pb-12">
        <Hero />
        <RouteMap userName={name ?? 'Anonymous'} />
        <MelbourneBoard userName={name ?? 'Anonymous'} />
        <Itinerary userName={name ?? 'Anonymous'} />
        <SharedNotepad userName={name ?? 'Anonymous'} />
      </main>
      <footer className="py-8 text-center text-text-muted text-xs border-t border-border-light">
        Ultra 2026 road trip planner
      </footer>
    </>
  );
}
