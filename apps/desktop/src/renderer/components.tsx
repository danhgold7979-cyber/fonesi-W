import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

export function Dialog({
  title,
  close,
  children,
  wide = false,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first =
      ref.current?.querySelector<HTMLElement>('input,textarea,select') ??
      ref.current?.querySelector<HTMLElement>('button');
    first?.focus();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={'dialog ' + (wide ? 'wide' : '')}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            close();
          }
          if (e.key === 'Tab') {
            const items = [
              ...(ref.current?.querySelectorAll<HTMLElement>(
                'button:not(:disabled),input,textarea,select,[tabindex="0"]',
              ) ?? []),
            ];
            const first = items[0],
              last = items.at(-1);
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <header>
          <h2>{title}</h2>
          <button aria-label="Đóng hộp thoại" onClick={close}>
            ×
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
export function Empty({
  icon = '◇',
  title,
  children,
  action,
}: {
  icon?: string;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">{icon}</span>
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function Field({
  label,
  value,
  commit,
  type = 'text',
}: {
  label: string;
  value: string | number;
  commit: (value: string) => void;
  type?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current && document.activeElement !== ref.current) ref.current.value = String(value);
  }, [value]);
  return (
    <label className="field">
      <span>{label}</span>
      <input
        ref={ref}
        type={type}
        defaultValue={value}
        onBlur={(e) => {
          if (e.target.value !== String(value)) commit(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
    </label>
  );
}
