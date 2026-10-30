/**
 * The dashboard must not claim more than the data proves: no "Cleared", no
 * "Manifest Verified", and drafts are not "filed" (spec: dashboard-redesign §2).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from '../Dashboard';

vi.mock('@/hooks/useFilings', () => ({
  useFilings: () => ({
    isLoading: false,
    data: {
      data: [
        { id: 'f1', status: 'draft', houseBol: 'HBL1', importerName: 'Acme', updatedAt: new Date().toISOString(), createdAt: new Date().toISOString() },
      ],
    },
  }),
}));
vi.mock('@/hooks/useAbiDocument', () => ({
  useAbiDocumentsList: () => ({
    isLoading: false,
    data: { data: [{ id: 'a1', filingId: null, status: 'ACCEPTED', entryNumber: 'XYZ-0000001-1', mbolNumber: null, iorName: 'Acme', updatedAt: new Date().toISOString(), createdAt: new Date().toISOString(), lastError: null }] },
  }),
}));
vi.mock('@/hooks/useManifestQuery', () => ({ useManifestQueries: () => ({ isLoading: false, data: { data: [] } }) }));
vi.mock('@/hooks/useAuth', () => ({ useCurrentUser: () => ({ data: { firstName: 'Sam' } }) }));
vi.mock('@/hooks/useBilling', () => ({ useCapabilities: () => ({ can: () => true }) }));
vi.mock('@/components/CelebrationModal', () => ({ CelebrationModal: () => null }));

function renderPage() {
  return render(<MemoryRouter><Dashboard /></MemoryRouter>);
}

describe('Dashboard labels', () => {
  it('never says cleared, because an accepted summary is not a release', () => {
    const { container } = renderPage();
    expect(container.textContent).not.toMatch(/cleared/i);
  });

  it('never says a manifest was verified, because no check runs', () => {
    const { container } = renderPage();
    expect(container.textContent).not.toMatch(/manifest verified/i);
  });

  it('does not call drafts filed', () => {
    renderPage();
    expect(screen.queryByText('ISF Filed')).toBeNull();
    expect(screen.queryByText('Entry Filed')).toBeNull();
  });

  it('names the accepted stage for what it is', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Accepted' })).toBeTruthy();
    expect(screen.getByText('Entry accepted')).toBeTruthy();
  });
});
