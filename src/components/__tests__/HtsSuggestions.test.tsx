/**
 * What the user sees from the native HTS classifier: confidence, duty and
 * every warning with each code; questions and "did you mean" when vague.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HtsSuggestions } from '../hts/HtsSuggestions';
import type { HtsClassifyResult } from '@/types/htsClassify';

const base = { dutyNote: 'General rate only.', notice: 'Not a binding classification.', revision: '2026-test' };

const OK: HtsClassifyResult = {
  status: 'ok',
  suggestions: [
    { code: '8507600010', description: 'Electric storage batteries > Lithium-ion batteries > For electrically powered vehicles', confidence: 'high', score: 0.93, reason: 'Li-ion; powers an e-bike', generalRate: '3.4%', units: ['No.'] },
    { code: '8711600010', description: 'Motorcycles > With electric motor > Bicycles', confidence: 'low', score: 0.2, generalRate: 'Free', units: ['No.'], warnings: ['Second check disagrees: this is a battery, not a bicycle.'] },
  ],
  dutySpreadWarning: 'These codes carry different duty: Free to 3.4%.',
  ...base,
};

describe('HtsSuggestions', () => {
  it('shows each code dotted, with its confidence, duty, reason and warnings', () => {
    render(<HtsSuggestions result={OK} onRetry={vi.fn()} />);
    expect(screen.getByText('8507.60.00.10')).toBeInTheDocument();
    // the top pick says what the checks found; the rest are alternatives
    expect(screen.getByText('Two independent checks agree')).toBeInTheDocument();
    expect(screen.getByText('Alternative')).toBeInTheDocument();
    expect(screen.queryByText(/confidence/i)).not.toBeInTheDocument();
    expect(screen.getByText('3.4%')).toBeInTheDocument();
    expect(screen.getByText('Li-ion; powers an e-bike')).toBeInTheDocument();
    expect(screen.getByText(/Second check disagrees/)).toBeInTheDocument();
    expect(screen.getByText(/different duty/)).toBeInTheDocument();
    expect(screen.getByText(/Not a binding classification/)).toBeInTheDocument();
  });

  it('hands the chosen code back', () => {
    const onPick = vi.fn();
    render(<HtsSuggestions result={OK} onPick={onPick} pickLabel="Use" onRetry={vi.fn()} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Use' })[0]);
    expect(onPick).toHaveBeenCalledWith('8507600010');
  });

  it('asks questions and offers did-you-mean readings instead of codes when vague', () => {
    const onRetry = vi.fn();
    render(<HtsSuggestions onRetry={onRetry} result={{
      status: 'needs_detail', message: 'This description is too general to classify.',
      questions: ['Is it rechargeable?'], didYouMean: ['Lithium-ion battery pack for electric bicycles'],
      suggestions: [], ...base,
    }} />);
    expect(screen.getByText(/too general/)).toBeInTheDocument();
    expect(screen.getByText('Is it rechargeable?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Lithium-ion battery pack for electric bicycles' }));
    expect(onRetry).toHaveBeenCalledWith('Lithium-ion battery pack for electric bicycles');
    expect(screen.queryByText(/Not a binding/)).not.toBeInTheDocument();
  });

  it('shows what is left of the allowance, so nobody is surprised by the limit', () => {
    render(<HtsSuggestions result={{ ...OK, usage: {
      user: { used: 3, limit: 25, period: 'day', resetsAt: '2026-10-23T00:00:00Z' },
      organization: { used: 40, limit: 300, period: 'month', resetsAt: '2026-11-01T00:00:00Z' },
    } }} onRetry={vi.fn()} />);
    expect(screen.getByText(/22 of 25 classifications left today/)).toBeInTheDocument();
    expect(screen.getByText(/260 of 300 left this month for your organization/)).toBeInTheDocument();
  });

  it('says when a repeat was answered from the earlier result, free', () => {
    render(<HtsSuggestions result={{ ...OK, repeat: true }} onRetry={vi.fn()} />);
    expect(screen.getByText(/same description was classified in the last 24 hours/i)).toBeInTheDocument();
    expect(screen.getByText(/did not use your allowance/i)).toBeInTheDocument();
  });
});
