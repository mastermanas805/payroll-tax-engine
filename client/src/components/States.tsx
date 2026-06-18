import type { ReactNode } from 'react';
import { ApiError } from '../api/client';
import { IconAlert, IconInbox } from './icons';

/** Centered loading state with a large spinner. */
export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="state" role="status" aria-live="polite">
      <div className="spinner spinner-lg" />
      <div className="state-text">{label}</div>
    </div>
  );
}

/** Empty state with an icon, message, and optional action. */
export function Empty({
  icon,
  title,
  text,
  action,
}: {
  icon?: ReactNode;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="state">
      <div className="state-icon">{icon ?? <IconInbox size={24} />}</div>
      <div className="state-title">{title}</div>
      {text && <div className="state-text">{text}</div>}
      {action && <div className="mt-8">{action}</div>}
    </div>
  );
}

/** Error state. Surfaces the server's code/message; offers a retry. */
export function ErrorState({
  error,
  onRetry,
}: {
  error: ApiError | Error;
  onRetry?: () => void;
}) {
  const code = error instanceof ApiError ? error.code : 'ERROR';
  return (
    <div className="state state-error" role="alert">
      <div className="state-icon">
        <IconAlert size={24} />
      </div>
      <div className="state-title">Couldn’t load this</div>
      <div className="state-text">
        {error.message}
        <div className="text-xs text-muted mt-8 mono">{code}</div>
      </div>
      {onRetry && (
        <button className="btn btn-sm mt-8" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

/** Inline error banner for forms. */
export function FormError({ error }: { error: ApiError | Error | null }) {
  if (!error) return null;
  return (
    <div className="alert alert-danger" role="alert">
      <IconAlert size={16} style={{ flexShrink: 0, marginTop: 1 }} />
      <span>{error.message}</span>
    </div>
  );
}

/** Table skeleton rows while a list loads. */
export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <table className="data">
      <tbody>
        {Array.from({ length: rows }).map((_, r) => (
          <tr key={r}>
            {Array.from({ length: cols }).map((__, c) => (
              <td key={c}>
                <div
                  className="skeleton"
                  style={{ height: 14, width: c === 0 ? '60%' : '40%' }}
                />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
