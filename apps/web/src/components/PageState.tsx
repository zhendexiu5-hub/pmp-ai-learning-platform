import type { ReactNode } from "react";

export function LoadingState({ label = "正在加载…" }: { label?: string }) {
  return <div className="page-state" role="status"><span className="state-spinner" aria-hidden="true" /><p>{label}</p></div>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div className="page-state page-state-error" role="alert"><strong>暂时无法加载</strong><p>{message}</p>{onRetry && <button className="secondary-button" onClick={onRetry}>重新加载</button>}</div>;
}

export function EmptyState({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
  return <div className="page-state page-state-empty"><strong>{title}</strong><p>{detail}</p>{action}</div>;
}
