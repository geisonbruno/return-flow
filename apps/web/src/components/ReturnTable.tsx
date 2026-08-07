import { REASON_LABELS, STATUS_LABELS, formatQuantityAndUnit } from '../returns/returnOptions';
import { formatSydneyTimestamp } from '../returns/sydneyDate';
import type { AdminReturnListItem } from '../returns/types';
import { StatusBadge } from './StatusBadge';

interface ReturnTableProps {
  returns: AdminReturnListItem[];
  /** Omits the Quantity/Unit column for the Dashboard's Latest Returns list. */
  compact?: boolean;
}

/**
 * Rows are deliberately not links in Phase 6B2A — Return Details content
 * (and its data) is Phase 6B2B work; a clickable row here would imply a
 * page that doesn't exist yet. Navigation becomes active once 6B2B ships.
 */
export function ReturnTable({ returns, compact = false }: ReturnTableProps) {
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
          </tr>
        </thead>
        <tbody>
          {returns.map((item) => (
            <tr key={item.id}>
              <td>{item.returnNumber}</td>
              <td>{formatSydneyTimestamp(item.createdAt)}</td>
              <td>{item.customerName}</td>
              <td>{item.productName}</td>
              {!compact && <td>{formatQuantityAndUnit(item.quantity, item.unit)}</td>}
              <td>{REASON_LABELS[item.reason]}</td>
              <td>{item.driver.fullName}</td>
              <td>{item.route.code}</td>
              <td>
                <StatusBadge label={STATUS_LABELS[item.status]} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
