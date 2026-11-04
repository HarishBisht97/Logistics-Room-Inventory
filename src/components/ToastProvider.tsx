import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { CircleCheck, CircleExclamationPoint } from 'lucide-react';

type ToastTone = 'success' | 'error';

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timer = useRef<number | null>(null);

  const push = useCallback((tone: ToastTone, message: string) => {
    const id = Date.now() + Math.random();
    setToasts([{ id, tone, message }]);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3200);
  }, []);

  const api = useMemo<ToastApi>(() => ({
    success: (message) => push('success', message),
    error: (message) => push('error', message),
  }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-[70] flex flex-col items-center gap-2 px-4 md:bottom-6">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`flex max-w-md items-start gap-2 rounded-2xl px-4 py-3 text-sm font-medium text-white shadow-lg ${
              toast.tone === 'success' ? 'bg-emerald-700' : 'bg-red-600'
            }`}
          >
            {toast.tone === 'success'
              ? <CircleCheck size={18} className="mt-0.5 shrink-0" />
              : <CircleExclamationPoint size={18} className="mt-0.5 shrink-0" />}
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used within ToastProvider');
  return api;
}
