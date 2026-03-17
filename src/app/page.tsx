'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useUserName } from '@/hooks/useUserName';
import NamePrompt from '@/components/NamePrompt';
import Nav from '@/components/Nav';
import Hero from '@/components/Hero';
import MelbourneBoard from '@/components/MelbourneBoard';
import Itinerary from '@/components/Itinerary';
import SharedNotepad from '@/components/SharedNotepad';

const RouteMap = dynamic(() => import('@/components/RouteMap'), { ssr: false });

type Tab = 'route' | 'plan' | 'notepad';

const TABS: { id: Tab; label: string }[] = [
  { id: 'route', label: 'Route' },
  { id: 'plan', label: 'Plan' },
  { id: 'notepad', label: 'Notepad' },
];

export default function Home() {
  const { name, setName, loaded } = useUserName();
  const [activeTab, setActiveTab] = useState<Tab>('plan');

  if (!loaded) return null;

  const user = name ?? 'Anonymous';

  return (
    <>
      {!name && <NamePrompt onSubmit={setName} />}
      <Nav userName={name} />

      <Hero />

      {/* Tab bar */}
      <div className="sticky top-0 z-30 bg-bg/80 backdrop-blur-lg border-b border-border-light">
        <div className="max-w-5xl mx-auto px-4 md:px-6 flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text-muted hover:text-text-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <main className="pb-12">
        {/* Route tab */}
        {activeTab === 'route' && (
          <RouteMap userName={user} />
        )}

        {/* Plan tab — two columns on desktop */}
        {activeTab === 'plan' && (
          <div className="max-w-5xl mx-auto px-4 md:px-6 py-6">
            <div className="md:grid md:grid-cols-2 md:gap-6">
              <div>
                <MelbourneBoard userName={user} />
              </div>
              <div>
                <Itinerary userName={user} />
              </div>
            </div>
          </div>
        )}

        {/* Notepad tab */}
        {activeTab === 'notepad' && (
          <SharedNotepad userName={user} />
        )}
      </main>

    </>
  );
}
