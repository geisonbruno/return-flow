import { STATUS_LABELS } from './returnOptions';
import type { ReturnStatus } from './types';
import { colors } from '../theme/tokens';

export interface StatusBadge {
  color: string;
  background: string;
}

/**
 * Badge colours for every status in the lifecycle, in the same semantics the
 * Web app uses: awaiting warehouse amber, in review blue, closed green,
 * cancelled red. A total `Record<ReturnStatus, …>` deliberately, matching
 * `REASON_LABELS`: adding a backend status without giving it a badge here is a
 * TypeScript error rather than an unstyled badge.
 */
export const STATUS_BADGE: Record<ReturnStatus, StatusBadge> = {
  AWAITING_WAREHOUSE: { color: colors.warning, background: colors.warningSurface },
  IN_REVIEW: { color: colors.info, background: colors.infoSurface },
  CLOSED: { color: colors.success, background: colors.successSurface },
  CANCELLED: { color: colors.danger, background: colors.dangerSurface },
};

/** Neutral treatment for a status outside the compiled contract — see {@link statusPresentation}. */
const UNKNOWN_STATUS_BADGE: StatusBadge = { color: colors.muted, background: colors.surfaceRaised };

/**
 * The maps are total over `ReturnStatus`, but the API is the runtime source of
 * truth: a status added to the backend before this client is rebuilt arrives
 * as a string outside the compiled union. These lookups keep such a record
 * readable — a neutral badge carrying the raw value — instead of crashing the
 * screen showing it. Known statuses stay explicit, so none is ever silently
 * given the wrong semantic colour.
 */
export function statusPresentation(status: ReturnStatus): StatusBadge {
  return STATUS_BADGE[status] ?? UNKNOWN_STATUS_BADGE;
}

export function statusLabel(status: ReturnStatus): string {
  return STATUS_LABELS[status] ?? String(status);
}
