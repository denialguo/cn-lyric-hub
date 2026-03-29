import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

const ToastContext = createContext();

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};

// --- TOAST ITEM ---
const ToastItem = ({ toast, onDismiss }) => {
  const icons = {
    success: <CheckCircle size={18} className="text-emerald-400 flex-shrink-0" />,
    error: <AlertCircle size={18} className="text-red-400 flex-shrink-0" />,
    info: <Info size={18} className="text-blue-400 flex-shrink-0" />,
    warning: <AlertTriangle size={18} className="text-yellow-400 flex-shrink-0" />,
  };

  const borders = {
    success: 'border-emerald-500/30',
    error: 'border-red-500/30',
    info: 'border-blue-500/30',
    warning: 'border-yellow-500/30',
  };

  return (
    <div
      className={`flex items-start gap-3 bg-slate-900 border ${borders[toast.type]} rounded-xl px-4 py-3 shadow-2xl backdrop-blur-md animate-in slide-in-from-right fade-in duration-300 max-w-sm`}
    >
      {icons[toast.type]}
      <p className="text-sm text-slate-200 flex-1 leading-relaxed">{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-slate-500 hover:text-white transition-colors flex-shrink-0 mt-0.5"
      >
        <X size={14} />
      </button>
    </div>
  );
};

// --- CONFIRM DIALOG ---
const ConfirmDialog = ({ message, onConfirm, onCancel, confirmLabel = 'Confirm', cancelLabel = 'Cancel', destructive = false }) => {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl max-w-sm w-full animate-in zoom-in-95 fade-in duration-200">
        <p className="text-white text-sm leading-relaxed mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${
              destructive
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white border border-red-500/50'
                : 'bg-primary text-white hover:opacity-90'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- PROVIDER ---
export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message, type = 'info', duration = 3500) => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => dismiss(id), duration);
  }, [dismiss]);

  const toast = {
    success: (msg) => addToast(msg, 'success'),
    error: (msg) => addToast(msg, 'error', 5000),
    info: (msg) => addToast(msg, 'info'),
    warning: (msg) => addToast(msg, 'warning', 4000),
  };

  // Promise-based confirm — use: const ok = await confirm("Delete?")
  const confirm = useCallback((message, options = {}) => {
    return new Promise((resolve) => {
      setConfirmState({
        message,
        ...options,
        onConfirm: () => { setConfirmState(null); resolve(true); },
        onCancel: () => { setConfirmState(null); resolve(false); },
      });
    });
  }, []);

  return (
    <ToastContext.Provider value={{ toast, confirm }}>
      {children}

      {/* Toast Stack */}
      <div className="fixed top-4 right-4 z-[150] flex flex-col gap-2">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>

      {/* Confirm Dialog */}
      {confirmState && <ConfirmDialog {...confirmState} />}
    </ToastContext.Provider>
  );
};