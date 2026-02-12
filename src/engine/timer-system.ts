export type TickCallback = (deltaMs: number, totalElapsedMs: number) => void;

export interface TimerSystemConfig {
  speedMultiplier?: number;
  tickIntervalMs?: number;
}

export interface TimerSystem {
  start(): void;
  stop(): void;
  pause(): void;
  resume(): void;
  setSpeed(multiplier: number): void;
  getSpeed(): number;
  isRunning(): boolean;
  isPaused(): boolean;
  getElapsedMs(): number;
  onTick(callback: TickCallback): () => void;
  addCountdown(id: string, durationMs: number, onComplete: () => void): void;
  removeCountdown(id: string): void;
  getCountdownRemaining(id: string): number | null;
  reset(): void;
  subscribe(listener: () => void): () => void;
  getSnapshot(): number;
}

interface Countdown {
  remaining: number;
  onComplete: () => void;
}

export function createTimerSystem(config?: TimerSystemConfig): TimerSystem {
  const tickIntervalMs = config?.tickIntervalMs ?? 100;
  let speedMultiplier = config?.speedMultiplier ?? 1;
  let totalElapsedMs = 0;
  let lastTickTime = 0;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let paused = false;

  const tickListeners = new Set<TickCallback>();
  const snapshotListeners = new Set<() => void>();
  const countdowns = new Map<string, Countdown>();

  function notifySnapshotListeners() {
    for (const listener of snapshotListeners) {
      listener();
    }
  }

  function tick() {
    const now = Date.now();
    const realDelta = now - lastTickTime;
    lastTickTime = now;

    const gameDelta = realDelta * speedMultiplier;
    totalElapsedMs += gameDelta;

    // Process countdowns
    const completed: string[] = [];
    for (const [id, countdown] of countdowns) {
      countdown.remaining -= gameDelta;
      if (countdown.remaining <= 0) {
        completed.push(id);
      }
    }
    for (const id of completed) {
      const countdown = countdowns.get(id);
      countdowns.delete(id);
      countdown?.onComplete();
    }

    // Notify tick listeners
    for (const callback of tickListeners) {
      callback(gameDelta, totalElapsedMs);
    }

    notifySnapshotListeners();
  }

  const system: TimerSystem = {
    start() {
      if (intervalId !== null) return;
      paused = false;
      lastTickTime = Date.now();
      intervalId = setInterval(tick, tickIntervalMs);
    },

    stop() {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
      paused = false;
    },

    pause() {
      if (intervalId === null || paused) return;
      clearInterval(intervalId);
      intervalId = null;
      paused = true;
    },

    resume() {
      if (!paused) return;
      paused = false;
      lastTickTime = Date.now();
      intervalId = setInterval(tick, tickIntervalMs);
    },

    setSpeed(multiplier: number) {
      speedMultiplier = multiplier;
    },

    getSpeed() {
      return speedMultiplier;
    },

    isRunning() {
      return intervalId !== null;
    },

    isPaused() {
      return paused;
    },

    getElapsedMs() {
      return totalElapsedMs;
    },

    onTick(callback: TickCallback): () => void {
      tickListeners.add(callback);
      return () => { tickListeners.delete(callback); };
    },

    addCountdown(id: string, durationMs: number, onComplete: () => void) {
      countdowns.set(id, { remaining: durationMs, onComplete });
    },

    removeCountdown(id: string) {
      countdowns.delete(id);
    },

    getCountdownRemaining(id: string): number | null {
      const countdown = countdowns.get(id);
      return countdown ? countdown.remaining : null;
    },

    reset() {
      system.stop();
      totalElapsedMs = 0;
      countdowns.clear();
      notifySnapshotListeners();
    },

    // For useSyncExternalStore
    subscribe(listener: () => void): () => void {
      snapshotListeners.add(listener);
      return () => { snapshotListeners.delete(listener); };
    },

    getSnapshot(): number {
      return totalElapsedMs;
    },
  };

  return system;
}
