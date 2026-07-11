// Toast notification queue for player-facing events (upgrade complete, army
// ready, builders free, storage full, insufficient resources).
// All functions are pure: they return new arrays, never mutate. Expiry is
// delta-timed so the queue advances off the same clock as the rest of the game.

export type NotificationKind = 'success' | 'info' | 'warning' | 'error';

export interface GameNotification {
  id: string;
  kind: NotificationKind;
  message: string;
  remainingMs: number;
  totalMs: number;
}

/** Default lifetime of a toast in milliseconds. */
export const DEFAULT_NOTIFICATION_MS = 4000;

/** Most toasts shown at once; older ones are dropped when the cap is exceeded. */
export const MAX_NOTIFICATIONS = 4;

// Monotonic counter for UI-generated ids. Not used by the pure helpers, which
// always take an explicit id, so tests stay deterministic.
let notificationCounter = 0;

/** Generate a unique notification id. For UI callers, not for pure tests. */
export function nextNotificationId(): string {
  notificationCounter += 1;
  return `notif_${String(notificationCounter)}`;
}

/** Build a notification with a full lifetime. */
export function createNotification(
  id: string,
  kind: NotificationKind,
  message: string,
  durationMs: number = DEFAULT_NOTIFICATION_MS,
): GameNotification {
  return { id, kind, message, remainingMs: durationMs, totalMs: durationMs };
}

/**
 * Append a notification to the queue, trimming the oldest entries when the
 * queue would exceed maxSize.
 */
export function pushNotification(
  queue: GameNotification[],
  notification: GameNotification,
  maxSize: number = MAX_NOTIFICATIONS,
): GameNotification[] {
  const next = [...queue, notification];
  if (next.length <= maxSize) return next;
  return next.slice(next.length - maxSize);
}

/**
 * Advance every notification by the elapsed time and drop any that have
 * expired. Returns the same array reference when nothing changes so callers
 * can skip re-renders.
 */
export function tickNotifications(
  queue: GameNotification[],
  deltaMs: number,
): GameNotification[] {
  if (queue.length === 0) return queue;

  const advanced = queue
    .map((n) => ({ ...n, remainingMs: n.remainingMs - deltaMs }))
    .filter((n) => n.remainingMs > 0);

  if (advanced.length === queue.length && deltaMs <= 0) return queue;
  return advanced;
}

/** Remove a single notification by id. Returns the same reference if absent. */
export function dismissNotification(
  queue: GameNotification[],
  id: string,
): GameNotification[] {
  const filtered = queue.filter((n) => n.id !== id);
  return filtered.length === queue.length ? queue : filtered;
}
