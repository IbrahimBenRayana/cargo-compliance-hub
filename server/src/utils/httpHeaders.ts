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
  // ASCII fallback: drop control chars (incl. CR/LF), quotes and backslashes.
  const asciiFallback =
    filename
      .replace(/[\x00-\x1F\x7F]/g, '') // control chars incl. \r \n
      .replace(/["\\]/g, '_')          // quote/backslash break the directive
      .replace(/[^\x20-\x7E]/g, '_')   // non-ASCII → placeholder (filename* carries the real value)
      .trim() || 'download';

  // RFC 5987 extended value: percent-encode, then also encode the chars
  // encodeURIComponent leaves that are not valid in a token.
  const encoded = encodeURIComponent(filename).replace(
    /['()*]/g,
    (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase(),
  );

  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}
