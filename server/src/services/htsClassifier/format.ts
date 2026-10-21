/** "8507600010" -> "8507.60.00.10". */
export const formatHts = (code: string): string =>
  [code.slice(0, 4), code.slice(4, 6), code.slice(6, 8), code.slice(8, 10)].filter(Boolean).join('.');
