import { describe, expect, it } from 'vitest';
import { stewardActions, stewardConfirmation } from '../stewardState';
describe('steward admin transitions', () => {
  it('only exposes valid lifecycle decisions', () => { expect(stewardActions('PENDING')).toEqual(['APPROVE', 'REJECT']); expect(stewardActions('ACTIVE')).toEqual(['SUSPEND']); expect(stewardActions('SUSPENDED')).toEqual(['RESTORE']); expect(stewardActions('REJECTED')).toEqual([]); });
  it('asks for a specific row/action then cancels or completes', () => { expect(stewardConfirmation({ type: 'ask', id: 2, action: 'SUSPEND' })).toEqual({ id: 2, action: 'SUSPEND' }); expect(stewardConfirmation({ type: 'cancel' })).toBeNull(); expect(stewardConfirmation({ type: 'complete' })).toBeNull(); });
});
