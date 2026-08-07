interface StatusBadgeProps {
  label: string;
}

/** Text plus styling, never color alone, per `apps/web/CLAUDE.md`'s accessibility guidance. */
export function StatusBadge({ label }: StatusBadgeProps) {
  return <span className="status-badge">{label}</span>;
}
