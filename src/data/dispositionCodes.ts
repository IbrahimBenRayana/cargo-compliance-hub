export interface DispositionInfo {
  label: string;
  description: string;
  severity: 'info' | 'warning' | 'success' | 'error';
}

const DISPOSITION_CODES: Record<string, DispositionInfo> = {
  '1C': { label: 'Cargo Released', description: 'Cargo has been released by CBP', severity: 'success' },
  '1E': { label: 'Export Cargo', description: 'Cargo identified as export', severity: 'info' },
  '1F': { label: 'FDA Hold', description: 'Cargo held by FDA for inspection', severity: 'warning' },
  '1H': { label: 'Intensive Exam', description: 'Cargo selected for intensive examination', severity: 'warning' },
  '1J': { label: 'USDA Hold', description: 'Cargo held by USDA', severity: 'warning' },
  '1R': { label: 'CBP Hold', description: 'Cargo held by CBP', severity: 'error' },
  '1W': { label: 'Arrived', description: 'Cargo arrived at port of entry', severity: 'info' },
  '2A': { label: 'Not on File', description: 'Manifest not on file at CBP', severity: 'warning' },
  '3H': { label: 'Hold Intact', description: 'Hold still in effect', severity: 'warning' },
  '4A': { label: 'In-Bond Arrival', description: 'In-bond cargo arrived at destination', severity: 'info' },
  'FS': { label: 'Firm Seized', description: 'Cargo has been seized by CBP', severity: 'error' },
  'S17': { label: 'ISF Filing Review', description: 'ISF filing under review by CBP', severity: 'warning' },
  'S75': { label: 'Entity Not on File', description: 'Entity identifier not on file with CBP', severity: 'error' },
  'SA7': { label: 'ISF Accepted', description: 'ISF filing accepted by CBP', severity: 'success' },
};

export function getDispositionInfo(code: string): DispositionInfo {
  return DISPOSITION_CODES[code] ?? {
    label: `Code ${code}`,
    description: `CBP disposition code ${code}`,
    severity: 'info' as const,
  };
}

export function getDispositionBadgeColor(severity: DispositionInfo['severity']): string {
  switch (severity) {
    case 'success': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
    case 'warning': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
    case 'error': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    default: return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
  }
}
