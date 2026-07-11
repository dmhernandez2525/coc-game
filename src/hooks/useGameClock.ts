import { useRef, useEffect, useCallback, useReducer, useSyncExternalStore } from 'react';
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
  const timerRef = useRef<TimerSystem | null>(null);

  if (timerRef.current === null) {
    timerRef.current = createTimerSystem({
      speedMultiplier: config?.speedMultiplier,
      tickIntervalMs: config?.tickIntervalMs,
    });
  }

  const timer = timerRef.current;

  // Stop the timer on unmount so its setInterval does not keep ticking
  useEffect(() => {
    return () => {
      timerRef.current?.stop();
    };
  }, []);

  const elapsedMs = useSyncExternalStore(
    timer.subscribe,
    timer.getSnapshot,
  );

  // The timer only notifies subscribers on ticks, so control calls bump a
  // local version to keep speed/isRunning/isPaused fresh (e.g. after stop()
  // no further tick would ever re-render the component)
  const [, bumpVersion] = useReducer((v: number) => v + 1, 0);

  const start = useCallback(() => { timer.start(); bumpVersion(); }, [timer]);
  const stop = useCallback(() => { timer.stop(); bumpVersion(); }, [timer]);
  const pause = useCallback(() => { timer.pause(); bumpVersion(); }, [timer]);
  const resume = useCallback(() => { timer.resume(); bumpVersion(); }, [timer]);
  const setSpeed = useCallback((m: number) => { timer.setSpeed(m); bumpVersion(); }, [timer]);

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
