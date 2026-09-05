import { Link } from 'react-router-dom';

import { REASON_LABELS, STATUS_LABELS, formatQuantityAndUnit } from '../returns/returnOptions';
import { formatSydneyTimestamp } from '../returns/sydneyDate';
import type { AdminReturnListItem } from '../returns/types';
import { StatusBadge } from './StatusBadge';

interface ReturnTableProps {
  returns: AdminReturnListItem[];
  /** Omits the Quantity/Unit column for the Dashboard's Latest Returns list. */
  compact?: boolean;
  /**
   * The current table's own path+query (e.g. the Returns page's active
   * filters), passed as router `state.from` on every row's detail link so
   * Return Details' "Back to Returns" can return here instead of a bare
   * `/returns`. Omit where there's no meaningful list context to preserve
   * (Dashboard's Latest Returns) — Return Details already falls back to
   * plain `/returns` when no `from` state is present.
   */
  backTo?: string;
}

export function ReturnTable({ returns, compact = false, backTo }: ReturnTableProps) {
  return (
    <div className="return-table-wrapper">
      <table className="return-table">
        <thead>
          <tr>
            <th>Return #</th>
            <th>Created</th>
            <th>Customer</th>
            <th>Product</th>
            {!compact && <th>Qty / Unit</th>}
            <th>Reason</th>
            <th>Driver</th>
            <th>Route</th>
            <th>Status</th>
            <th>Reviewer</th>
          </tr>
        </thead>
        <tbody>
          {returns.map((item) => (
            <tr key={item.id}>
              <td>
                <Link to={`/returns/${item.id}`} state={backTo ? { from: backTo } : undefined}>
                  {item.returnNumber}
                </Link>
              </td>
              <td>{formatSydneyTimestamp(item.createdAt)}</td>
              <td>{item.customerName}</td>
              <td>{item.productName}</td>
              {!compact && <td>{formatQuantityAndUnit(item.quantity, item.unit)}</td>}
              <td>{REASON_LABELS[item.reason]}</td>
              <td>{item.driver.fullName}</td>
              <td>{item.route.code}</td>
              <td>
                <StatusBadge status={item.status} label={STATUS_LABELS[item.status]} />
              </td>
              <td>{item.reviewer?.fullName ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
