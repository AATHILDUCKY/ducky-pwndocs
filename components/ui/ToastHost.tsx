import React, { useEffect, useState } from 'react';

type Toast = {
  id: string;
  message: string;
  type: 'error' | 'success' | 'info';
};

const ToastHost: React.FC = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as Partial<Toast> | undefined;
      if (!detail?.message) return;
      const toast: Toast = {
        id: `t-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        message: detail.message,
        type: detail.type || 'error',
      };
      setToasts((prev) => [...prev.slice(-3), toast]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 4000);
    };
    window.addEventListener('app-notify', handler as EventListener);
    return () => window.removeEventListener('app-notify', handler as EventListener);
  }, []);

  if (!toasts.length) return null;

  return (
    <div className="fixed right-6 bottom-6 z-[500] space-y-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`min-w-[240px] max-w-[360px] rounded-2xl border px-4 py-3 text-[10px] font-black uppercase tracking-widest shadow-2xl ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
              : toast.type === 'info'
              ? 'bg-slate-50 text-slate-600 border-slate-200'
              : 'bg-rose-50 text-rose-600 border-rose-100'
          }`}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
};

export default ToastHost;
