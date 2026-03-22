import React, { useEffect } from 'react';
import type { Toast } from '../../types';

interface ToastProps {
  toast: Toast;
  onDismiss: (id: number) => void;
}

const ToastMessage: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 5000); // Auto-dismiss after 5 seconds

    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-slate-800/80 backdrop-blur-sm border border-cyan-500/30 rounded-lg shadow-2xl p-4 flex items-start gap-4 animate-fade-in"
      onClick={() => onDismiss(toast.id)}
    >
      <div className="w-10 h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center text-xl flex-shrink-0" aria-hidden="true">
        {toast.icon}
      </div>
      <div className="flex-grow">
        <h3 className="font-bold text-cyan-300">{toast.title}</h3>
        <p className="text-sm text-gray-300">{toast.message}</p>
      </div>
      <button 
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(toast.id);
        }} 
        aria-label="Dismiss notification" 
        className="text-gray-500 hover:text-white p-2 -mr-2 -mt-2 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

interface ToastContainerProps {
  toasts: Toast[];
  setToasts: React.Dispatch<React.SetStateAction<Toast[]>>;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, setToasts }) => {
  const handleDismiss = React.useCallback((id: number) => {
    setToasts(currentToasts => currentToasts.filter(t => t.id !== id));
  }, [setToasts]);

  return (
    <div className="fixed top-4 right-4 z-50 w-full max-w-sm space-y-2">
      {toasts.map(toast => (
        <ToastMessage key={toast.id} toast={toast} onDismiss={handleDismiss} />
      ))}
    </div>
  );
};