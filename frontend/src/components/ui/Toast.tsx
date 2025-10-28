import React, { useEffect, useState } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
  onClose: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ 
  id, 
  type, 
  title, 
  message, 
  duration = 5000, 
  onClose 
}) => {
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(100);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onClose(id);
    }, 300); // Match animation duration
  };

  useEffect(() => {
    // Progress bar animation
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        const decrement = (100 / duration) * 50; // Update every 50ms
        return Math.max(0, prev - decrement);
      });
    }, 50);

    // Auto close timer
    const timer = setTimeout(() => {
      handleClose();
    }, duration);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration]);

  const config = {
    success: {
      icon: CheckCircle,
      iconColor: 'text-emerald-500 dark:text-emerald-400',
      bgColor: 'bg-white dark:bg-slate-800',
      borderColor: 'border-emerald-500/20 dark:border-emerald-400/20',
      progressColor: 'bg-emerald-500 dark:bg-emerald-400',
      shadowColor: 'shadow-emerald-500/10 dark:shadow-emerald-400/10',
    },
    error: {
      icon: AlertCircle,
      iconColor: 'text-red-500 dark:text-red-400',
      bgColor: 'bg-white dark:bg-slate-800',
      borderColor: 'border-red-500/20 dark:border-red-400/20',
      progressColor: 'bg-red-500 dark:bg-red-400',
      shadowColor: 'shadow-red-500/10 dark:shadow-red-400/10',
    },
    warning: {
      icon: AlertTriangle,
      iconColor: 'text-amber-500 dark:text-amber-400',
      bgColor: 'bg-white dark:bg-slate-800',
      borderColor: 'border-amber-500/20 dark:border-amber-400/20',
      progressColor: 'bg-amber-500 dark:bg-amber-400',
      shadowColor: 'shadow-amber-500/10 dark:shadow-amber-400/10',
    },
    info: {
      icon: Info,
      iconColor: 'text-blue-500 dark:text-blue-400',
      bgColor: 'bg-white dark:bg-slate-800',
      borderColor: 'border-blue-500/20 dark:border-blue-400/20',
      progressColor: 'bg-blue-500 dark:bg-blue-400',
      shadowColor: 'shadow-blue-500/10 dark:shadow-blue-400/10',
    },
  };

  const { icon: Icon, iconColor, bgColor, borderColor, progressColor, shadowColor } = config[type];

  return (
    <div
      className={`
        relative overflow-hidden rounded-xl border backdrop-blur-xl
        ${bgColor} ${borderColor} ${shadowColor}
        shadow-2xl
        transition-all duration-300 ease-out
        ${isExiting ? 'opacity-0 translate-x-full scale-95' : 'opacity-100 translate-x-0 scale-100'}
        hover:scale-[1.02] hover:shadow-3xl
        min-w-[320px] max-w-md
      `}
    >
      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gray-200/30 dark:bg-gray-700/30">
        <div
          className={`h-full ${progressColor} transition-all duration-50 ease-linear`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="p-4 flex items-start gap-3">
        {/* Icon */}
        <div className={`flex-shrink-0 ${iconColor}`}>
          <Icon className="w-5 h-5" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {title && (
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
              {title}
            </h4>
          )}
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            {message}
          </p>
        </div>

        {/* Close button */}
        <button
          onClick={handleClose}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-gray-700/50"
          aria-label="Close notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default Toast;
export type { ToastProps, ToastType };