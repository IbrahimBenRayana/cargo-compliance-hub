/**
 * Verifies the pure XML transform helpers used by the public-API content
 * negotiation: request parsing (with single-root unwrap + array fields) and
 * response serialization under a <response> root.
 */
import { describe, it, expect } from 'vitest';
import { xmlToObject, objectToXml } from '../xmlContent.js';

describe('xmlToObject', () => {
  it('unwraps a single root element', () => {
    const obj = xmlToObject('<filing><filingType>ISF-10</filingType><iorNumber>12-3456789</iorNumber></filing>');
    expect(obj).toEqual({ filingType: 'ISF-10', iorNumber: '12-3456789' });
  });

  it('coerces known list fields to arrays even with one element', () => {
    const obj = xmlToObject('<filing><commodities><htsNumber>1234567890</htsNumber></commodities></filing>');
    expect(Array.isArray(obj.commodities)).toBe(true);
    expect(obj.commodities[0].htsNumber).toBe('1234567890');
  });

  it('keeps repeated list elements as an array', () => {
    const obj = xmlToObject('<filing><containers>ABCD1234567</containers><containers>EFGH7654321</containers></filing>');
    expect(obj.containers).toEqual(['ABCD1234567', 'EFGH7654321']);
  });
});

describe('objectToXml', () => {
  it('wraps the payload under a <response> root with an XML declaration', () => {
    const xml = objectToXml({ data: { id: 'abc', status: 'DRAFT' } });
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<response>');
    expect(xml).toContain('<id>abc</id>');
    expect(xml).toContain('<status>DRAFT</status>');
  });

  it('repeats the element for array payloads (list responses)', () => {
    const xml = objectToXml({ data: [{ id: 'a' }, { id: 'b' }] });
    expect((xml.match(/<data>/g) || []).length).toBe(2);
  });

  it('round-trips a single-root object through parse → build', () => {
    const obj = xmlToObject('<entry><entryType>01</entryType></entry>');
    const xml = objectToXml(obj);
    expect(xml).toContain('<entryType>01</entryType>');
  });
});
