import React, { useEffect, useCallback, useState } from 'react';
import { uuid } from '../utils/uuid';

export interface ToastMessage {
  id: string;
  text: string;
  type?: 'success' | 'error' | 'info';
  action?: { label: string; onClick: () => void };
  duration?: number;
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed left-0 right-0 bottom-[calc(80px+var(--safe-bottom))] z-50 flex flex-col items-center gap-2 pointer-events-none">
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLeaving(true);
      setTimeout(() => onDismiss(toast.id), 200);
    }, toast.duration ?? 2500);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  const bgMap: Record<string, string> = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    info: 'bg-gray-800',
  };

  return (
    <div
      className={`
        pointer-events-auto max-w-sm w-[90vw] px-4 py-3 rounded-2xl shadow-lg
        flex items-center gap-3
        ${bgMap[toast.type ?? 'info']} text-white
        animate-fade-in
        ${leaving ? 'opacity-0 translate-y-2 transition-all duration-200' : ''}
      `}
    >
      <span className="flex-1 text-sm font-medium">{toast.text}</span>
      {toast.action && (
        <button
          onClick={() => { toast.action!.onClick(); onDismiss(toast.id); }}
          className="text-sm font-semibold text-white/90 hover:text-white px-2 py-1"
        >
          {toast.action.label}
        </button>
      )}
    </div>
  );
};

/* ─── Hook ─── */
export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const show = useCallback((msg: Omit<ToastMessage, 'id'>) => {
    const id = uuid();
    setToasts(prev => [...prev, { ...msg, id }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, show, dismiss };
}
