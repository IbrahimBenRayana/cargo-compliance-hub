/**
 * HTSAutocomplete plan gating.
 *
 * Regression for BUG-002 (testing week): the AI lookup button calls
 * /integrations/hts-classify, which the server gates on HTS_CLASSIFICATION
 * (Complete tier). On the ISF and entry plans it was shown anyway and every
 * use failed. Typing a code by hand must work on every plan.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HTSAutocomplete } from '../HTSAutocomplete';

let capabilities: string[] = [];

vi.mock('@/hooks/useBilling', () => ({
  useCapabilities: () => ({ can: (cap: string) => capabilities.includes(cap) }),
}));

describe('HTSAutocomplete', () => {
  beforeEach(() => {
    capabilities = [];
  });

  it('hides the AI lookup on plans without HTS classification, keeping the code field', () => {
    render(<HTSAutocomplete value="" onChange={() => {}} />);
    expect(screen.getByPlaceholderText('e.g., 731815')).toBeInTheDocument();
    expect(screen.queryByTitle('AI HTS Lookup')).not.toBeInTheDocument();
  });

  it('shows the AI lookup on plans with HTS classification', () => {
    capabilities = ['HTS_CLASSIFICATION'];
    render(<HTSAutocomplete value="" onChange={() => {}} />);
    expect(screen.getByTitle('AI HTS Lookup')).toBeInTheDocument();
  });
});
