/** MID derivation per CBP rules (audit ENG-09). */
import { describe, it, expect } from 'vitest';
import { deriveMid } from '../payload/mid.js';

describe('deriveMid', () => {
  it('uses the largest number on the street line, not the first', () => {
    expect(deriveMid({ name: 'Taiwan Bolt Co', address: '3F, No. 1288 Zhongshan Rd', city: 'Taipei', countryCode: 'TW' })).toBe('TWTAIBOL1288TAI');
  });

  it('keeps the first four digits of the largest number', () => {
    expect(deriveMid({ name: 'Acme Widgets', address: '232 Main Street Suite 12345', city: 'Toronto', countryCode: 'GB' })).toBe('GBACMWID1234TOR');
  });

  it('transliterates accented letters instead of splitting words', () => {
    expect(deriveMid({ name: 'Müller Werkzeug GmbH', address: '7 Hauptstraße', city: 'München', countryCode: 'DE' })).toBe('DEMULWER7MUN');
  });

  it('still derives the CBP cert-package example', () => {
    expect(deriveMid({ name: 'NICSAN', address: '435 Industrial Rd', city: 'Taipei', countryCode: 'TW' })).toBe('TWNICSAN435TAI');
  });
});
