'use client';

import { useState, useEffect } from 'react';
import { TRIP_DATES } from '@/lib/constants';

interface CountdownValues {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  passed: boolean;
}

export function useCountdown(): CountdownValues {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const target = new Date(TRIP_DATES.departure).getTime();
  const diff = target - now.getTime();

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, passed: true };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  return { days, hours, minutes, seconds, passed: false };
}
