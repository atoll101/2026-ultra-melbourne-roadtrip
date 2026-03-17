'use client';

import dynamic from 'next/dynamic';
import { useUserName } from '@/hooks/useUserName';
import NamePrompt from '@/components/NamePrompt';
import Nav from '@/components/Nav';
import Hero from '@/components/Hero';
import Itinerary from '@/components/Itinerary';
import MelbourneBoard from '@/components/MelbourneBoard';
import SharedNotepad from '@/components/SharedNotepad';
import PackingChecklist from '@/components/PackingChecklist';

const RouteMap = dynamic(() => import('@/components/RouteMap'), { ssr: false });

export default function Home() {
  const { name, setName, loaded } = useUserName();

  if (!loaded) return null;

  return (
    <>
      {!name && <NamePrompt onSubmit={setName} />}
      <Nav userName={name} />
      <main>
        <Hero />
        <RouteMap userName={name ?? 'Anonymous'} />
        <Itinerary userName={name ?? 'Anonymous'} />
        <MelbourneBoard userName={name ?? 'Anonymous'} />
        <SharedNotepad userName={name ?? 'Anonymous'} />
        <PackingChecklist userName={name ?? 'Anonymous'} />
      </main>
    </>
  );
}
