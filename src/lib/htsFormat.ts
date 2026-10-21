/** "8507600010" -> "8507.60.00.10" (works for 4- to 10-digit codes). */
export const formatHtsCode = (code: string) => {
  const d = code.replace(/\D/g, '');
  return [d.slice(0, 4), d.slice(4, 6), d.slice(6, 8), d.slice(8, 10)].filter(Boolean).join('.');
};
