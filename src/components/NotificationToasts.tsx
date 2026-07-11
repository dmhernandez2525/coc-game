import type { GameNotification, NotificationKind } from '../engine/notification-manager.ts';

interface NotificationToastsProps {
  notifications: GameNotification[];
  onDismiss: (id: string) => void;
}

// Per-kind accent styling. Lookup table keeps the render branch-free.
const KIND_STYLES: Record<NotificationKind, { border: string; bar: string; icon: string }> = {
  success: { border: 'border-emerald-500/60', bar: 'bg-emerald-400', icon: '✓' },
  info: { border: 'border-sky-500/60', bar: 'bg-sky-400', icon: 'i' },
  warning: { border: 'border-amber-500/60', bar: 'bg-amber-400', icon: '!' },
  error: { border: 'border-red-500/60', bar: 'bg-red-400', icon: '×' },
};

export function NotificationToasts({ notifications, onDismiss }: NotificationToastsProps) {
  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-16 right-4 z-50 flex flex-col gap-2 w-72 pointer-events-none">
      {notifications.map((n) => {
        const style = KIND_STYLES[n.kind];
        const remaining = n.totalMs > 0 ? Math.max(0, n.remainingMs / n.totalMs) : 0;
        return (
          <div
            key={n.id}
            role="status"
            className={`pointer-events-auto overflow-hidden rounded-lg border ${style.border} bg-slate-900/95 shadow-lg backdrop-blur-sm`}
          >
            <div className="flex items-start gap-2 px-3 py-2">
              <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-slate-900 ${style.bar}`}>
                {style.icon}
              </span>
              <span className="flex-1 text-sm text-slate-100">{n.message}</span>
              <button
                onClick={() => onDismiss(n.id)}
                className="text-slate-500 hover:text-white transition-colors text-sm leading-none"
                aria-label="Dismiss notification"
              >
                x
              </button>
            </div>
            <div className="h-0.5 bg-slate-800">
              <div
                className={`h-full ${style.bar} transition-[width] duration-100 ease-linear`}
                style={{ width: `${remaining * 100}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
