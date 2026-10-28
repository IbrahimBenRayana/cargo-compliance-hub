/**
 * ISF form <-> stored filing conversions (audit UFF-01, FNA-14).
 *
 * Editing or duplicating an ISF must keep every commodity and container
 * line exactly as stored. The old inline code kept only the first of each
 * and turned any stored quantity unit into PCS (an operator-precedence bug).
 */
export interface CommodityForm {
  /** Which manufacturer produced the line (0 = the first). */
  manufacturerIndex?: number;
  htsCode: string;
  description: string;
  countryOfOrigin: string;
  quantity: string;
  quantityUOM: string;
  weight: string;
  weightUOM: string;
}

export interface ContainerForm {
  number: string;
  type: string;
}

/** Equipment types the server accepts and the native ISF mapper understands. */
export const CONTAINER_TYPES = [
  { value: 'CN', label: 'CN — Container' },
  { value: 'NC', label: 'NC — No Container' },
  { value: '20', label: '20 — 20ft Standard' },
  { value: '40', label: '40 — 40ft Standard' },
  { value: '40HC', label: '40HC — 40ft High Cube' },
  { value: '45HC', label: '45HC — 45ft High Cube' },
];

const LEGACY_CONTAINER_TYPES: Record<string, string> = { '40H': '40HC', '45': '45HC' };

export function normalizeContainerType(type: string | null | undefined): string {
  const t = (type ?? '').trim().toUpperCase();
  return LEGACY_CONTAINER_TYPES[t] ?? (t || 'CN');
}

interface StoredCommodity {
  manufacturerIndex?: number | null;
  htsCode?: string | null;
  description?: string | null;
  countryOfOrigin?: string | null;
  quantity?: number | string | null;
  quantityUOM?: string | null;
  weight?: { value?: number | string | null; unit?: string | null } | null;
}

export function toCommodityForm(c: StoredCommodity): CommodityForm {
  return {
    ...(c.manufacturerIndex != null && { manufacturerIndex: c.manufacturerIndex }),
    htsCode: c.htsCode || '',
    description: c.description || '',
    countryOfOrigin: c.countryOfOrigin || '',
    quantity: c.quantity != null ? String(c.quantity) : '',
    quantityUOM: c.quantityUOM || (c.weight?.unit === 'L' ? 'PCS' : 'PKG'),
    weight: c.weight?.value != null ? String(c.weight.value) : '',
    weightUOM: c.weight?.unit || 'K',
  };
}

export function toContainerForm(c: { number?: string | null; containerNumber?: string | null; type?: string | null }): ContainerForm {
  return { number: c.number || c.containerNumber || '', type: normalizeContainerType(c.type) };
}

/** Every stored line, or one empty line when there are none. */
export function toCommodityForms(list: unknown, empty: () => CommodityForm): CommodityForm[] {
  return Array.isArray(list) && list.length > 0 ? list.map((c) => toCommodityForm(c as StoredCommodity)) : [empty()];
}

export function toContainerForms(list: unknown, empty: () => ContainerForm): ContainerForm[] {
  return Array.isArray(list) && list.length > 0 ? list.map((c) => toContainerForm(c as { number?: string })) : [empty()];
}

/**
 * Importer / consignee numbers CBP accepts on an ISF (ISF-29), mirroring the
 * server mapper: EIN (NN-NNNNNNN with optional 2-char suffix, or 9 digits),
 * CBP-assigned (YYDDPP-NNNNN) or SSN written NNN-NN-NNNN.
 */
export function isImporterIdentifier(raw: string): boolean {
  const v = raw.trim().toUpperCase();
  return (
    /^\d{2}-\d{7}([A-Z0-9]{2})?$/.test(v) ||
    /^\d{9}([A-Z0-9]{2})?$/.test(v) ||
    /^\d{6}-?[A-Z0-9]{5}$/.test(v) ||
    /^\d{3}-\d{2}-\d{4}$/.test(v)
  );
}
