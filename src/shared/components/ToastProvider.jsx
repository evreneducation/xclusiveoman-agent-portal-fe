// Minimal, dependency-free toast system (no toast lib is installed in this
// project). Mount <ToastProvider> once near the app root, then call
// useToast() anywhere to push a notification into the top-right stack.
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const ToastContext = createContext(null);

const TONES = {
  success: 'border-[#b9e2c9] bg-[#e9f7ef] text-[#227647]',
  error: 'border-[#f2bdc6] bg-[#fff7f8] text-[#a5162d]',
  info: 'border-line-light bg-white text-ink',
};

const ICONS = {
  success: '✓',
  error: '!',
  info: 'i',
};

let idSeq = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message, { type = 'info', duration = type === 'error' ? 7000 : 4000 } = {}) => {
      if (!message) return;
      const id = ++idSeq;
      setToasts((list) => [...list, { id, message, type }]);
      if (duration) {
        setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss]
  );

  const toast = useMemo(
    () => ({
      show: push,
      success: (message, options) => push(message, { ...options, type: 'success' }),
      error: (message, options) => push(message, { ...options, type: 'error' }),
      info: (message, options) => push(message, { ...options, type: 'info' }),
      dismiss,
    }),
    [push, dismiss]
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[9999] flex w-full max-w-md flex-col gap-3 sm:right-6 sm:top-6 sm:max-w-lg">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: -12, x: 24 }}
              animate={{ opacity: 1, y: 0, x: 0 }}
              exit={{ opacity: 0, x: 24, transition: { duration: 0.15 } }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              role="alert"
              className={`pointer-events-auto flex items-start gap-3 rounded-lg border px-5 py-4 text-sm font-medium shadow-lg ${TONES[t.type]}`}
            >
              <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full border-2 border-current text-xs font-bold">
                {ICONS[t.type]}
              </span>
              <span className="flex-1 leading-relaxed">{t.message}</span>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="flex-none text-lg leading-none text-current/70 hover:text-current"
                aria-label="Dismiss"
              >
                ×
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
