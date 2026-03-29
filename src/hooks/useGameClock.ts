import { useCallback, useSyncExternalStore, useEffect, useState } from 'react';
import { createTimerSystem } from '../engine/timer-system';
import type { TimerSystem } from '../engine/timer-system';

export interface UseGameClockConfig {
  speedMultiplier?: number;
  tickIntervalMs?: number;
}

export interface UseGameClockReturn {
  elapsedMs: number;
  speed: number;
  isRunning: boolean;
  isPaused: boolean;
  start: () => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  setSpeed: (multiplier: number) => void;
  timer: TimerSystem;
}

export function useGameClock(config?: UseGameClockConfig): UseGameClockReturn {
  const [timer] = useState(() =>
    createTimerSystem({
      speedMultiplier: config?.speedMultiplier,
      tickIntervalMs: config?.tickIntervalMs,
    }),
  );

  useEffect(() => {
    return () => {
      timer.stop();
    };
  }, [timer]);

  const elapsedMs = useSyncExternalStore(
    timer.subscribe,
    timer.getSnapshot,
  );

  const start = useCallback(() => timer.start(), [timer]);
  const stop = useCallback(() => timer.stop(), [timer]);
  const pause = useCallback(() => timer.pause(), [timer]);
  const resume = useCallback(() => timer.resume(), [timer]);
  const setSpeed = useCallback((m: number) => timer.setSpeed(m), [timer]);

  return {
    elapsedMs,
    speed: timer.getSpeed(),
    isRunning: timer.isRunning(),
    isPaused: timer.isPaused(),
    start,
    stop,
    pause,
    resume,
    setSpeed,
    timer,
  };
}
