import { authorizedRequestJson } from '../api/apiClient';
import type { CreateReturnPayload, ReturnRecord } from './types';

/** GET /api/v1/driver/returns — server-side tenant+driver scoping only; no client-side filtering. */
export function listReturns(): Promise<ReturnRecord[]> {
  return authorizedRequestJson<ReturnRecord[]>('/api/v1/driver/returns');
}

/** POST /api/v1/driver/returns — payload is exactly `CreateReturnPayload`, never augmented with identity fields. */
export function createReturn(payload: CreateReturnPayload): Promise<ReturnRecord> {
  return authorizedRequestJson<ReturnRecord>('/api/v1/driver/returns', { method: 'POST', body: payload });
}

/** GET /api/v1/driver/returns/{returnId} */
export function getReturn(returnId: string): Promise<ReturnRecord> {
  return authorizedRequestJson<ReturnRecord>(`/api/v1/driver/returns/${encodeURIComponent(returnId)}`);
}
