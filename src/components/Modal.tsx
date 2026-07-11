import React, { useEffect, useRef } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  ariaLabel?: string;
  panelClassName?: string;
}

/**
 * Accessible modal: closes on Esc, traps focus inside, restores focus on close,
 * and dismisses on overlay click. Replaces the ad-hoc overlay divs.
 */
export const Modal: React.FC<ModalProps> = ({ open, onClose, children, ariaLabel, panelClassName }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);
  // Keep the latest onClose without making the focus effect depend on it.
  // Otherwise every keystroke in a child input re-creates onClose, re-runs the
  // effect, and steals focus back to the first field (breaking IME + other inputs).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    lastFocused.current = document.activeElement as HTMLElement | null;

    const focusFirst = () => {
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = panel.querySelector<HTMLElement>(
        'input, textarea, select, button, [href], [tabindex]:not([tabindex="-1"])'
      );
      (focusable ?? panel).focus();
    };
    // focus after paint — runs only when `open` flips true, not on every render
    const raf = requestAnimationFrame(focusFirst);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key === 'Tab') {
        const panel = panelRef.current;
        if (!panel) return;
        const nodes = Array.from(
          panel.querySelectorAll<HTMLElement>(
            'input, textarea, select, button, [href], [tabindex]:not([tabindex="-1"])'
          )
        ).filter((n) => !n.hasAttribute('disabled'));
        if (nodes.length === 0) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey);
      lastFocused.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 animate-fade-in"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className={panelClassName ?? 'bg-white rounded-2xl shadow-xl mx-4 w-full max-w-md p-6 animate-fade-in'}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>
  );
};
