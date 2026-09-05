import { Link } from 'react-router-dom';
import { REASON_LABELS, STATUS_LABELS } from '../returns/returnOptions';
import { formatSydneyTimestamp } from '../returns/sydneyDate';
import type { AdminReturnListItem } from '../returns/types';
import { StatusBadge } from './StatusBadge';

export function DashboardRecentReturns({ returns }: { returns: AdminReturnListItem[] }) {
  return <div className="return-table-wrapper dashboard-recent__table-wrap">
    <table className="return-table dashboard-recent__table">
      <thead><tr><th>Return #</th><th>Created</th><th>Customer</th><th>Product</th><th>Reason</th><th>Driver</th><th>Route</th><th>Status</th></tr></thead>
      <tbody>{returns.map((item) => <tr key={item.id}>
        <td><Link to={`/returns/${item.id}`}>{item.returnNumber}</Link></td>
        <td>{formatSydneyTimestamp(item.createdAt)}</td><td>{item.customerName}</td><td>{item.productName}</td>
        <td>{REASON_LABELS[item.reason]}</td><td>{item.driver.fullName}</td><td>{item.route.code}</td>
        <td><StatusBadge status={item.status} label={STATUS_LABELS[item.status]} /></td>
      </tr>)}</tbody>
    </table>
  </div>;
}
