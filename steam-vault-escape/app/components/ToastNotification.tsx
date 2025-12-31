import React from 'react';

interface ToastNotificationProps {
  message: string | null;
  type: 'error' | 'warning' | 'info';
}

export default function ToastNotification({ message, type }: ToastNotificationProps) {
  if (!message) return null;

  const bgColor = {
    error: 'bg-red-600',
    warning: 'bg-yellow-600',
    info: 'bg-blue-600',
  }[type];

  const icon = {
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
  }[type];

  return (
    <div className="fixed top-4 right-4 z-50 animate-fade-in">
      <div className={`${bgColor} text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-3 max-w-md`}>
        <span className="text-2xl">{icon}</span>
        <span className="font-semibold">{message}</span>
      </div>
    </div>
  );
}
