import { createTimerSystem, type TimerSystem } from '../timer-system';

describe('TimerSystem', () => {
  let timer: TimerSystem;

  beforeEach(() => {
    vi.useFakeTimers();
    timer = createTimerSystem({ tickIntervalMs: 100, speedMultiplier: 1 });
  });

  afterEach(() => {
    timer.stop();
    vi.useRealTimers();
  });

  // -----------------------------------------------------------------------
  // Lifecycle tests
  // -----------------------------------------------------------------------
  describe('lifecycle', () => {
    it('start() begins ticking and isRunning() returns true', () => {
      expect(timer.isRunning()).toBe(false);
      timer.start();
      expect(timer.isRunning()).toBe(true);
    });

    it('stop() halts ticking and isRunning() returns false', () => {
      timer.start();
      expect(timer.isRunning()).toBe(true);
      timer.stop();
      expect(timer.isRunning()).toBe(false);
    });

    it('pause() suspends ticking and isPaused() returns true', () => {
      timer.start();
      timer.pause();
      expect(timer.isPaused()).toBe(true);
      expect(timer.isRunning()).toBe(false);
    });

    it('resume() resumes ticking after pause', () => {
      timer.start();
      timer.pause();
      expect(timer.isPaused()).toBe(true);
      timer.resume();
      expect(timer.isPaused()).toBe(false);
      expect(timer.isRunning()).toBe(true);
    });

    it('multiple start() calls do not create duplicate intervals', () => {
      const callback = vi.fn();
      timer.onTick(callback);
      timer.start();
      timer.start();
      timer.start();

      vi.advanceTimersByTime(100);
      // Only one tick should have fired, not three
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('calling pause() while already paused is a no-op', () => {
      timer.start();
      timer.pause();
      expect(timer.isPaused()).toBe(true);

      // Pause again; state should remain the same
      timer.pause();
      expect(timer.isPaused()).toBe(true);
      expect(timer.isRunning()).toBe(false);
    });

    it('calling resume() while running (not paused) is a no-op', () => {
      timer.start();
      expect(timer.isRunning()).toBe(true);
      expect(timer.isPaused()).toBe(false);

      // resume() should do nothing since we are not paused
      timer.resume();
      expect(timer.isRunning()).toBe(true);
      expect(timer.isPaused()).toBe(false);
    });

    it('stop() clears the paused flag', () => {
      timer.start();
      timer.pause();
      expect(timer.isPaused()).toBe(true);
      timer.stop();
      expect(timer.isPaused()).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Speed multiplier tests
  // -----------------------------------------------------------------------
  describe('speed multiplier', () => {
    it('at 1x speed, elapsed time matches real time within tolerance', () => {
      timer.start();
      vi.advanceTimersByTime(500);
      // 5 ticks at 100ms each, game delta = 100 * 1 per tick = 500ms total
      expect(timer.getElapsedMs()).toBe(500);
    });

    it('at 10x speed, 100ms real time produces ~1000ms game time', () => {
      timer.setSpeed(10);
      timer.start();
      vi.advanceTimersByTime(100);
      // 1 tick, real delta = 100ms, game delta = 100 * 10 = 1000ms
      expect(timer.getElapsedMs()).toBe(1000);
    });

    it('changing speed mid-run takes effect on the next tick', () => {
      timer.start();
      vi.advanceTimersByTime(200); // 2 ticks at 1x = 200ms game time
      expect(timer.getElapsedMs()).toBe(200);

      timer.setSpeed(5);
      vi.advanceTimersByTime(100); // 1 tick at 5x = 500ms game time
      expect(timer.getElapsedMs()).toBe(700);
    });

    it('getSpeed() returns the current multiplier', () => {
      expect(timer.getSpeed()).toBe(1);
      timer.setSpeed(3);
      expect(timer.getSpeed()).toBe(3);
      timer.setSpeed(0.5);
      expect(timer.getSpeed()).toBe(0.5);
    });
  });

  // -----------------------------------------------------------------------
  // Tick callback tests
  // -----------------------------------------------------------------------
  describe('tick callbacks', () => {
    it('onTick callback receives deltaMs and totalElapsedMs', () => {
      const callback = vi.fn();
      timer.onTick(callback);
      timer.start();

      vi.advanceTimersByTime(100);
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(100, 100);

      vi.advanceTimersByTime(100);
      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenCalledWith(100, 200);
    });

    it('unsubscribe function stops callback from firing', () => {
      const callback = vi.fn();
      const unsub = timer.onTick(callback);
      timer.start();

      vi.advanceTimersByTime(100);
      expect(callback).toHaveBeenCalledTimes(1);

      unsub();
      vi.advanceTimersByTime(300);
      // Should still be 1, since we unsubscribed
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('multiple subscribers all fire per tick', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      const cb3 = vi.fn();

      timer.onTick(cb1);
      timer.onTick(cb2);
      timer.onTick(cb3);
      timer.start();

      vi.advanceTimersByTime(100);
      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);
      expect(cb3).toHaveBeenCalledTimes(1);
    });

    it('tick callbacks do not fire while paused', () => {
      const callback = vi.fn();
      timer.onTick(callback);
      timer.start();

      vi.advanceTimersByTime(100);
      expect(callback).toHaveBeenCalledTimes(1);

      timer.pause();
      vi.advanceTimersByTime(500);
      expect(callback).toHaveBeenCalledTimes(1);

      timer.resume();
      vi.advanceTimersByTime(100);
      expect(callback).toHaveBeenCalledTimes(2);
    });
  });

  // -----------------------------------------------------------------------
  // Countdown tests
  // -----------------------------------------------------------------------
  describe('countdowns', () => {
    it('addCountdown fires onComplete after duration elapses', () => {
      const onComplete = vi.fn();
      timer.start();
      timer.addCountdown('build-hut', 300, onComplete);

      vi.advanceTimersByTime(200); // 200ms elapsed, 100ms remaining
      expect(onComplete).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100); // 300ms elapsed, countdown done
      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it('removeCountdown prevents onComplete from firing', () => {
      const onComplete = vi.fn();
      timer.start();
      timer.addCountdown('build-hut', 300, onComplete);

      vi.advanceTimersByTime(200);
      timer.removeCountdown('build-hut');

      vi.advanceTimersByTime(200);
      expect(onComplete).not.toHaveBeenCalled();
    });

    it('getCountdownRemaining returns correct decreasing value', () => {
      timer.start();
      timer.addCountdown('research', 500, vi.fn());

      vi.advanceTimersByTime(100);
      expect(timer.getCountdownRemaining('research')).toBe(400);

      vi.advanceTimersByTime(200);
      expect(timer.getCountdownRemaining('research')).toBe(200);
    });

    it('getCountdownRemaining returns null for non-existent countdown', () => {
      expect(timer.getCountdownRemaining('does-not-exist')).toBeNull();
    });

    it('multiple concurrent countdowns complete independently', () => {
      const onCompleteA = vi.fn();
      const onCompleteB = vi.fn();
      timer.start();
      timer.addCountdown('short', 200, onCompleteA);
      timer.addCountdown('long', 500, onCompleteB);

      vi.advanceTimersByTime(200);
      expect(onCompleteA).toHaveBeenCalledTimes(1);
      expect(onCompleteB).not.toHaveBeenCalled();

      vi.advanceTimersByTime(300);
      expect(onCompleteB).toHaveBeenCalledTimes(1);
    });

    it('countdowns scale with speed multiplier', () => {
      const onComplete = vi.fn();
      timer.setSpeed(5);
      timer.start();
      timer.addCountdown('fast-build', 500, onComplete);

      // 1 tick = 100ms real time = 500ms game time at 5x
      vi.advanceTimersByTime(100);
      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it('completed countdown is removed from the map', () => {
      timer.start();
      timer.addCountdown('temp', 100, vi.fn());

      vi.advanceTimersByTime(100);
      expect(timer.getCountdownRemaining('temp')).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Reset tests
  // -----------------------------------------------------------------------
  describe('reset', () => {
    it('reset() clears elapsed time and countdowns', () => {
      timer.start();
      timer.addCountdown('pending-build', 1000, vi.fn());
      vi.advanceTimersByTime(300);
      expect(timer.getElapsedMs()).toBe(300);

      timer.reset();
      expect(timer.getElapsedMs()).toBe(0);
      expect(timer.getCountdownRemaining('pending-build')).toBeNull();
    });

    it('reset() stops the timer', () => {
      timer.start();
      expect(timer.isRunning()).toBe(true);
      timer.reset();
      expect(timer.isRunning()).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Snapshot tests (for useSyncExternalStore)
  // -----------------------------------------------------------------------
  describe('subscribe / getSnapshot', () => {
    it('getSnapshot returns current totalElapsedMs', () => {
      expect(timer.getSnapshot()).toBe(0);
      timer.start();
      vi.advanceTimersByTime(300);
      expect(timer.getSnapshot()).toBe(300);
    });

    it('subscribe listener fires on each tick', () => {
      const listener = vi.fn();
      timer.subscribe(listener);
      timer.start();

      vi.advanceTimersByTime(300);
      // 3 ticks = 3 notifications
      expect(listener).toHaveBeenCalledTimes(3);
    });

    it('unsubscribing stops notifications', () => {
      const listener = vi.fn();
      const unsub = timer.subscribe(listener);
      timer.start();

      vi.advanceTimersByTime(100);
      expect(listener).toHaveBeenCalledTimes(1);

      unsub();
      vi.advanceTimersByTime(400);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('subscribe listener fires on reset', () => {
      const listener = vi.fn();
      timer.subscribe(listener);
      timer.start();
      vi.advanceTimersByTime(200);

      listener.mockClear();
      timer.reset();
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });
});
