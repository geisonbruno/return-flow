import type { ReturnStatus } from '../returns/types';

interface StatusBadgeProps {
  label: string;
  status?: ReturnStatus;
}

/** Text plus styling, never color alone, per `apps/web/CLAUDE.md`'s accessibility guidance. */
export function StatusBadge({ label, status }: StatusBadgeProps) {
  return <span className={`status-badge${status ? ` status-badge--${status.toLowerCase().replace('_', '-')}` : ''}`}>{label}</span>;
}
