import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function Dialog({ open, onClose, title, children, className }: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => {
      const dialogs = document.querySelectorAll('[data-admin-dialog]');
      if (event.key === 'Escape' && !event.defaultPrevented && dialogs[dialogs.length - 1] === dialogRef.current) {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div ref={dialogRef} data-admin-dialog role="dialog" aria-modal="true" aria-label={title} className={cn(
        'relative z-50 w-full max-w-lg rounded-xl border bg-white p-6 shadow-lg dark:border-zinc-800 dark:bg-zinc-900',
        className
      )}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" aria-label="닫기" onClick={onClose} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
