import { useState, useCallback } from 'react';
import { type ToastType, type ToastProps } from '../components/ui/Toast';

interface ToastOptions {
  title?: string;
  message: string;
  type?: ToastType;
  duration?: number;
}

export const useToast = () => {
  const [toasts, setToasts] = useState<ToastProps[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    ({ title, message, type = 'info', duration = 5000 }: ToastOptions) => {
      const id = `toast-${Date.now()}-${Math.random()}`;
      const newToast: ToastProps = {
        id,
        title,
        message,
        type,
        duration,
        onClose: removeToast,
      };

      setToasts((prev) => [...prev, newToast]);
      return id;
    },
    [removeToast]
  );

  const success = useCallback(
    (message: string, title?: string, duration?: number) => {
      return showToast({ message, title, type: 'success', duration });
    },
    [showToast]
  );

  const error = useCallback(
    (message: string, title?: string, duration?: number) => {
      return showToast({ message, title, type: 'error', duration });
    },
    [showToast]
  );

  const warning = useCallback(
    (message: string, title?: string, duration?: number) => {
      return showToast({ message, title, type: 'warning', duration });
    },
    [showToast]
  );

  const info = useCallback(
    (message: string, title?: string, duration?: number) => {
      return showToast({ message, title, type: 'info', duration });
    },
    [showToast]
  );

  return {
    toasts,
    showToast,
    success,
    error,
    warning,
    info,
    removeToast,
  };
};

