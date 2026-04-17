// ─── Shared Plan Metadata ─────────────────────────────────
// Used by UpgradePage, CelebrationModal, and PlanLimitModal

export interface PlanMeta {
  name: string;
  tier: 'Grower' | 'Scale';
  priceLabel: string;
  priceFooter: string;
  filings: number;
  seats: number;
  features: string[];
}

export const PLAN_META: Record<string, PlanMeta> = {
  grower_monthly: {
    name: 'Grower',
    tier: 'Grower',
    priceLabel: '$99/month',
    priceFooter: 'Billed monthly. Cancel anytime.',
    filings: 15,
    seats: 3,
    features: [
      '15 ISF filings per month',
      'Up to 3 team members',
      'Full compliance dashboard',
      'ISF 10+2 and ISF-5',
      'Priority email + chat support (24h SLA)',
      'Audit trail + CSV export',
      'Templates & bulk duplicate',
    ],
  },
  grower_annual: {
    name: 'Grower',
    tier: 'Grower',
    priceLabel: '$79/month',
    priceFooter: '$948 billed yearly — save 20% vs monthly.',
    filings: 15,
    seats: 3,
    features: [
      '15 ISF filings per month',
      'Up to 3 team members',
      'Full compliance dashboard',
      'ISF 10+2 and ISF-5',
      'Priority email + chat support (24h SLA)',
      'Audit trail + CSV export',
      'Templates & bulk duplicate',
    ],
  },
  scale_monthly: {
    name: 'Scale',
    tier: 'Scale',
    priceLabel: '$299/month',
    priceFooter: 'Billed monthly. Cancel anytime.',
    filings: 60,
    seats: 10,
    features: [
      '60 ISF filings per month',
      'Up to 10 team members',
      'Everything in Grower',
      'Bulk CSV import',
      'API access',
      'Custom roles & permissions',
      'Priority support (4h SLA)',
    ],
  },
  scale_annual: {
    name: 'Scale',
    tier: 'Scale',
    priceLabel: '$239/month',
    priceFooter: '$2,868 billed yearly — save 20% vs monthly.',
    filings: 60,
    seats: 10,
    features: [
      '60 ISF filings per month',
      'Up to 10 team members',
      'Everything in Grower',
      'Bulk CSV import',
      'API access',
      'Custom roles & permissions',
      'Priority support (4h SLA)',
    ],
  },
};

export const KNOWN_PLAN_IDS = Object.keys(PLAN_META);
