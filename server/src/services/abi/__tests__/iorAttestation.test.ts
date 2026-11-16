import { describe, it, expect } from 'vitest';
import { stampIorAttestation } from '../iorAttestation.js';

const user = { id: 'u-1', email: 'ana@broker.test' };
const later = { id: 'u-2', email: 'ben@broker.test' };
const t1 = new Date('2026-11-16T10:00:00Z');
const t2 = new Date('2026-11-17T10:00:00Z');

const usIor = { number: '12-3456789', name: 'ACME', usImporterOfRecord: true, usIorAttested: true };

describe('stampIorAttestation', () => {
  it('stamps the user and time when the box is first ticked', () => {
    const out = stampIorAttestation({}, { ior: usIor }, user, t1);
    expect(out.ior).toMatchObject({
      usIorAttestedById: 'u-1',
      usIorAttestedByEmail: 'ana@broker.test',
      usIorAttestedAt: '2026-11-16T10:00:00.000Z',
    });
  });

  it('keeps the original stamp across later saves of the same declaration', () => {
    const first = stampIorAttestation({}, { ior: usIor }, user, t1);
    const out = stampIorAttestation(first, { ior: { ...usIor, name: 'ACME INC' } }, later, t2);
    expect(out.ior).toMatchObject({ usIorAttestedById: 'u-1', usIorAttestedAt: '2026-11-16T10:00:00.000Z' });
  });

  it('re-stamps when the IOR number changes', () => {
    const first = stampIorAttestation({}, { ior: usIor }, user, t1);
    const out = stampIorAttestation(first, { ior: { ...usIor, number: '98-7654321' } }, later, t2);
    expect(out.ior).toMatchObject({ usIorAttestedById: 'u-2', usIorAttestedAt: '2026-11-17T10:00:00.000Z' });
  });

  it('drops the stamp when the box is unticked or the answer becomes foreign', () => {
    const first = stampIorAttestation({}, { ior: usIor }, user, t1);
    const unticked = stampIorAttestation(first, { ior: { ...usIor, usIorAttested: false } }, user, t2);
    expect(unticked.ior).not.toHaveProperty('usIorAttestedAt');
    const foreign = stampIorAttestation(first, { ior: { ...usIor, usImporterOfRecord: false } }, user, t2);
    expect(foreign.ior).not.toHaveProperty('usIorAttestedAt');
    expect(foreign.ior).not.toHaveProperty('usIorAttested');
  });

  it('ignores stamp fields sent by the client', () => {
    const forged = { ...usIor, usIorAttested: false, usIorAttestedById: 'x', usIorAttestedAt: '2020-01-01' };
    const out = stampIorAttestation({}, { ior: forged }, user, t1);
    expect(out.ior).not.toHaveProperty('usIorAttestedById');
  });

  it('leaves a payload without an ior slice alone', () => {
    const payload: { ior?: unknown; entryType: string } = { entryType: '01' };
    expect(stampIorAttestation({}, payload, user, t1)).toBe(payload);
  });
});
