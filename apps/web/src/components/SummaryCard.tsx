import type { ReactNode } from 'react';

interface SummaryCardProps {
  label: string;
  value: number | undefined;
  loading: boolean;
  onClick?: () => void;
  /** True for cards with no real backing metric yet (In Review / Closed Today until Phase 7A) — never clickable, visually marked as not operational. */
  disabled?: boolean;
  secondaryText?: string;
  icon?: ReactNode;
  tone?: 'green' | 'blue' | 'amber' | 'purple';
}

/** One of the four approved dashboard cards (root CLAUDE.md §17.1). Clickable only when `onClick` is given and not `disabled`. */
export function SummaryCard({ label, value, loading, onClick, disabled, secondaryText, icon, tone = 'green' }: SummaryCardProps) {
  const body = (
    <><span className={`summary-card__icon summary-card__icon--${tone}`}>{icon}</span><span className="summary-card__content"><span className="summary-card__label">{label}</span><span className="summary-card__value">{loading ? '…' : (value ?? 0)}</span>{secondaryText && <span className="summary-card__secondary">{secondaryText}</span>}</span></>
  );

  if (onClick && !disabled) {
    return (
      <button type="button" className="summary-card summary-card--clickable" onClick={onClick}>
        {body}
      </button>
    );
  }

  return <div className={`summary-card${disabled ? ' summary-card--disabled' : ''}`}>{body}</div>;
}
