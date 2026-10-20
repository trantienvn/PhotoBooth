import type { ToastItem } from '@/app/AppContext';
import { CheckCircle, AlertCircle, Info } from 'lucide-react';

interface ToastContainerProps {
  toasts: ToastItem[];
}

const icons = {
  success: <CheckCircle size={16} color="#22c55e" />,
  error: <AlertCircle size={16} color="#ef4444" />,
  info: <Info size={16} color="#a78bfa" />,
};

export function ToastContainer({ toasts }: ToastContainerProps) {
  if (toasts.length === 0) return null;
  return (
    <div className="toast-container" role="region" aria-label="Notifications" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast flex items-center gap-3" role="alert">
          {icons[t.type]}
          <span style={{ flex: 1, fontSize: 14 }}>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
