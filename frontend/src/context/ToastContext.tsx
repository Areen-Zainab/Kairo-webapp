import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import ToastContainer from '../components/ui/ToastContainer';
import type { ToastProps } from '../components/ui/Toast';

interface ToastContextType {
  success: (message: string, title?: string, duration?: number) => string;
  error: (message: string, title?: string, duration?: number) => string;
  warning: (message: string, title?: string, duration?: number) => string;
  info: (message: string, title?: string, duration?: number) => string;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToastContext = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToastContext must be used within ToastProvider');
  }
  return context;
};

interface ToastProviderProps {
  children: ReactNode;
}

interface StoredToast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title?: string;
  message: string;
  duration: number;
  createdAt: number;
}

const TOAST_STORAGE_KEY = 'kairo_active_toasts';

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastProps[]>([]);
  const [toastMetadata, setToastMetadata] = useState<Map<string, { createdAt: number; originalDuration: number }>>(new Map());

  // Load toasts from sessionStorage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(TOAST_STORAGE_KEY);
      if (stored) {
        const storedToasts: StoredToast[] = JSON.parse(stored);
        const now = Date.now();
        
        // Filter out expired toasts and convert to ToastProps
        const activeToasts: ToastProps[] = [];
        const metadata = new Map<string, { createdAt: number; originalDuration: number }>();
        
        storedToasts.forEach(toast => {
          const elapsed = now - toast.createdAt;
          if (elapsed < toast.duration) {
            activeToasts.push({
              ...toast,
              onClose: (id: string) => removeToast(id),
              duration: toast.duration - elapsed, // Remaining time
            });
            metadata.set(toast.id, {
              createdAt: toast.createdAt,
              originalDuration: toast.duration,
            });
          }
        });
        
        setToasts(activeToasts);
        setToastMetadata(metadata);
      }
    } catch (error) {
      console.error('Failed to load toasts from storage:', error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save toasts to sessionStorage whenever they change
  useEffect(() => {
    if (toasts.length === 0) {
      sessionStorage.removeItem(TOAST_STORAGE_KEY);
      return;
    }

    try {
      const storedToasts: StoredToast[] = toasts.map(toast => {
        const meta = toastMetadata.get(toast.id);
        return {
          id: toast.id,
          type: toast.type,
          title: toast.title,
          message: toast.message,
          duration: meta?.originalDuration || toast.duration || 5000,
          createdAt: meta?.createdAt || Date.now(),
        };
      });
      
      sessionStorage.setItem(TOAST_STORAGE_KEY, JSON.stringify(storedToasts));
    } catch (error) {
      console.error('Failed to save toasts to storage:', error);
    }
  }, [toasts, toastMetadata]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    setToastMetadata((prev) => {
      const newMap = new Map(prev);
      newMap.delete(id);
      return newMap;
    });
  }, []);

  const showToast = useCallback(
    (type: 'success' | 'error' | 'info' | 'warning', message: string, title?: string, duration: number = 5000) => {
      const id = `toast-${Date.now()}-${Math.random()}`;
      const createdAt = Date.now();
      
      const newToast: ToastProps = {
        id,
        title,
        message,
        type,
        duration,
        onClose: removeToast,
      };

      setToasts((prev) => [...prev, newToast]);
      setToastMetadata((prev) => new Map(prev).set(id, { createdAt, originalDuration: duration }));
      return id;
    },
    [removeToast]
  );

  const success = useCallback(
    (message: string, title?: string, duration?: number) => {
      return showToast('success', message, title, duration);
    },
    [showToast]
  );

  const error = useCallback(
    (message: string, title?: string, duration?: number) => {
      return showToast('error', message, title, duration);
    },
    [showToast]
  );

  const warning = useCallback(
    (message: string, title?: string, duration?: number) => {
      return showToast('warning', message, title, duration);
    },
    [showToast]
  );

  const info = useCallback(
    (message: string, title?: string, duration?: number) => {
      return showToast('info', message, title, duration);
    },
    [showToast]
  );

  return (
    <ToastContext.Provider value={{ success, error, warning, info }}>
      {children}
      <ToastContainer toasts={toasts} />
    </ToastContext.Provider>
  );
};

