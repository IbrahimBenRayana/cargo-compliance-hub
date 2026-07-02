/**
 * Safe HTTP header construction for values that include user-derived data.
 *
 * A filename that reaches a `Content-Disposition` header can carry quotes or
 * CR/LF; interpolated raw, that allows header/response splitting or breaking the
 * filename directive. This builds the header with a sanitized ASCII fallback
 * plus an RFC 5987 `filename*` for full-fidelity Unicode.
 */

/** Build a `Content-Disposition: attachment` value safe for any filename. */
export function contentDispositionAttachment(filename: string): string {
  // ASCII fallback built via char-code checks (avoids a control-char regex):
  // drop control chars incl. CR/LF, neutralize quotes/backslashes that would
  // break the directive, and replace non-ASCII with a placeholder (the real
  // value is carried by filename* below).
  const asciiFallback =
    Array.from(filename, (ch) => {
      const c = ch.charCodeAt(0);
      if (c < 0x20 || c === 0x7f) return ''; // control chars, incl. \r \n
      if (c > 0x7e) return '_';              // non-ASCII → placeholder
      if (ch === '"' || ch === '\\') return '_';
      return ch;
    }).join('').trim() || 'download';

  // RFC 5987 extended value: percent-encode, then also encode the chars
  // encodeURIComponent leaves that are not valid in a token.
  const encoded = encodeURIComponent(filename).replace(
    /['()*]/g,
    (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase(),
  );

  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}
