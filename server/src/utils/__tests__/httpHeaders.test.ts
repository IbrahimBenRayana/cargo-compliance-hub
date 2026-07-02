/**
 * contentDispositionAttachment — ensures user-derived filenames can't inject
 * into the Content-Disposition header (no CR/LF/quotes escaping the directive)
 * while preserving Unicode via the RFC 5987 filename* field.
 */
import { describe, it, expect } from 'vitest';
import { contentDispositionAttachment } from '../httpHeaders.js';

describe('contentDispositionAttachment', () => {
  it('strips CR/LF so a filename cannot inject headers', () => {
    const v = contentDispositionAttachment('inv.pdf\r\nSet-Cookie: x=1');
    expect(v).not.toContain('\r');
    expect(v).not.toContain('\n');
  });

  it('neutralizes quotes/backslashes that would break the filename directive', () => {
    const v = contentDispositionAttachment('a"; attachment; filename="evil.exe');
    // The ascii fallback must not contain a raw double-quote that closes early.
    const ascii = v.match(/filename="([^"]*)"/)?.[1] ?? '';
    expect(ascii).not.toContain('"');
  });

  it('preserves the real name via filename* (RFC 5987) for Unicode', () => {
    const v = contentDispositionAttachment('facturé €.pdf');
    expect(v).toContain("filename*=UTF-8''");
    expect(v).toContain(encodeURIComponent('facturé €.pdf').replace(/['()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase()));
  });

  it('falls back to "download" for an empty/garbage ascii name', () => {
    expect(contentDispositionAttachment('\r\n\x00')).toContain('filename="download"');
  });

  it('leaves an ordinary filename intact', () => {
    expect(contentDispositionAttachment('ISF-ABC123.pdf')).toContain('filename="ISF-ABC123.pdf"');
  });
});
