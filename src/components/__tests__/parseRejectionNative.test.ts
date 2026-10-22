/** BUG-027: the rejection card must show CBP's real reason for native rejections. */
import { describe, it, expect } from 'vitest';
import { parseRejectionReason } from '../RejectionDetailsCard';

describe('parseRejectionReason (native CBP shape)', () => {
  it('uses CBP\'s own code and narrative, and blocking as severity', () => {
    const r = parseRejectionReason(JSON.stringify({"summary":"ISF REJECTED","errors":[{"code":"154","narrative":"INVALID BILL OF LADING FORMAT","blocking":true},{"code":"S2","narrative":"NO BILL MATCH","blocking":false}]}));
    expect(r.errors[0]).toMatchObject({ fieldLabel: 'CBP code 154', message: 'INVALID BILL OF LADING FORMAT', severity: 'critical' });
    expect(r.errors[1]).toMatchObject({ fieldLabel: 'CBP code S2', severity: 'info' });
  });
});
