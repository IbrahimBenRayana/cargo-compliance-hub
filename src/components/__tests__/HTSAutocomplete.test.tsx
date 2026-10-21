/**
 * HTS Code field + wand (native classifier).
 *
 * History: BUG-002 hid the wand on plans without HTS_CLASSIFICATION because
 * the CustomsCity lookup failed there. Since 2026-10-21 the native classifier
 * serves every plan, so the wand shows for all.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HTSAutocomplete } from '../HTSAutocomplete';

const { classifyHTS } = vi.hoisted(() => ({ classifyHTS: vi.fn() }));
vi.mock('@/api/client', () => ({ integrationsApi: { classifyHTS } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe('HTSAutocomplete', () => {
  it('shows the wand next to the code field on every plan', () => {
    render(<HTSAutocomplete value="" onChange={() => {}} />);
    expect(screen.getByPlaceholderText('e.g., 731815')).toBeInTheDocument();
    expect(screen.getByTitle('AI HTS Lookup')).toBeInTheDocument();
  });

  it('fills in the full 10-digit code the user picks', async () => {
    classifyHTS.mockResolvedValue({
      status: 'ok', dutyNote: '', notice: '', revision: 'r',
      suggestions: [{ code: '8507600010', description: 'Batteries > Lithium-ion', confidence: 'high', score: 0.9, generalRate: '3.4%', units: [] }],
    });
    const onChange = vi.fn();
    render(<HTSAutocomplete value="" onChange={onChange} description="li-ion e-bike battery pack" />);
    fireEvent.click(screen.getByTitle('AI HTS Lookup'));
    fireEvent.click(await screen.findByRole('button', { name: 'Use' }));
    expect(classifyHTS).toHaveBeenCalledWith('li-ion e-bike battery pack');
    expect(onChange).toHaveBeenCalledWith('8507600010');
  });

  it('shows the server\'s reason when suggestions are unavailable', async () => {
    classifyHTS.mockRejectedValue({ body: { error: 'Daily HTS suggestion limit reached. It resets at midnight UTC.' } });
    render(<HTSAutocomplete value="" onChange={() => {}} />);
    fireEvent.click(screen.getByTitle('AI HTS Lookup'));
    fireEvent.change(screen.getByLabelText('Product description'), { target: { value: 'steel hex bolts' } });
    fireEvent.click(screen.getByRole('button', { name: /Suggest codes/ }));
    await waitFor(() => expect(screen.getByText(/Daily HTS suggestion limit/)).toBeInTheDocument());
  });
});
