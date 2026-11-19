import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CoachMarkdown } from '../CoachMarkdown';

describe('CoachMarkdown', () => {
  it('renders **bold** as <strong> without the asterisks', () => {
    const { container } = render(<CoachMarkdown text="The **HTS Code** is too short." />);

    expect(screen.getByText('HTS Code').tagName).toBe('STRONG');
    expect(container.textContent).toBe('The HTS Code is too short.');
  });

  it('renders a bold numbered section title as a heading', () => {
    render(<CoachMarkdown text={'**1. Will-reject issues**\n\nSomething is wrong.'} />);

    expect(screen.getByRole('heading', { name: '1. Will-reject issues' })).toBeInTheDocument();
    expect(screen.getByText('Something is wrong.').tagName).toBe('P');
  });

  it('renders # headings and bold titles with a trailing colon as headings', () => {
    render(<CoachMarkdown text={'### 2. Likely-to-reject risks\n**3. Improvements:**'} />);

    expect(screen.getByRole('heading', { name: '2. Likely-to-reject risks' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '3. Improvements' })).toBeInTheDocument();
  });

  it('keeps a bold lead-in followed by text on the same line as a paragraph, not a heading', () => {
    render(<CoachMarkdown text="**Bond**: the bond type is empty." />);

    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.getByText('Bond').tagName).toBe('STRONG');
  });

  it('renders bullets as list items with a bold lead-in', () => {
    const { container } = render(
      <CoachMarkdown text={'- **HTS Code**: only 6 digits.\n- **Bond**: is empty.\n* Third'} />,
    );

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('HTS Code: only 6 digits.');
    expect(items[0].querySelector('strong')).toHaveTextContent('HTS Code');
    expect(container.textContent).not.toContain('*');
    expect(container.textContent).not.toContain('- ');
  });

  it('renders numbered items with the number the model wrote', () => {
    render(<CoachMarkdown text={'1. Change the HTS code.\n2. Resubmit.'} />);

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[1]).toHaveTextContent('2.Resubmit.');
  });

  it('indents nested bullets under a numbered item', () => {
    render(<CoachMarkdown text={'1. First\n   - detail\n2. Second'} />);

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(screen.getAllByRole('list')).toHaveLength(1);
    expect(parseInt(items[1].style.paddingLeft)).toBeGreaterThan(parseInt(items[0].style.paddingLeft));
    expect(items[2].style.paddingLeft).toBe(items[0].style.paddingLeft);
    expect(items[2]).toHaveTextContent('2.Second');
  });

  it('renders `code` spans', () => {
    render(<CoachMarkdown text="Set `bondType` first." />);

    expect(screen.getByText('bondType').tagName).toBe('CODE');
  });

  it('leaves a lone asterisk and snake_case alone', () => {
    const { container } = render(<CoachMarkdown text="2 * 3 and bond_type_code" />);

    expect(container.textContent).toBe('2 * 3 and bond_type_code');
  });

  describe('while streaming', () => {
    it('shows an unclosed ** as bold text, never as asterisks', () => {
      const { container } = render(<CoachMarkdown text="- **HTS Co" streaming />);

      expect(screen.getByText('HTS Co').tagName).toBe('STRONG');
      expect(container.textContent).not.toContain('*');
    });

    it('treats a half-arrived section title as a heading already', () => {
      render(<CoachMarkdown text="**1. Will-rej" streaming />);

      expect(screen.getByRole('heading', { name: '1. Will-rej' })).toBeInTheDocument();
    });

    it('hides a dangling marker at the end of the stream', () => {
      for (const partial of ['Done.\n\n*', 'Done.\n\n**', 'Done.\n\n-', 'Done.\n- **', 'Done. **Bold*']) {
        const { container, unmount } = render(<CoachMarkdown text={partial} streaming />);
        expect(container.textContent).not.toMatch(/[*-]\s*$/);
        expect(container.textContent).toContain('Done.');
        unmount();
      }
    });

    it('puts the caret inside the last block', () => {
      const { container } = render(<CoachMarkdown text={'Intro\n\n- one\n- two'} streaming />);

      const items = screen.getAllByRole('listitem');
      expect(items[1].querySelector('[data-caret]')).not.toBeNull();
      expect(container.querySelectorAll('[data-caret]')).toHaveLength(1);
    });

    it('shows no caret once streaming has finished', () => {
      const { container } = render(<CoachMarkdown text="Done." />);

      expect(container.querySelector('[data-caret]')).toBeNull();
    });
  });

  it('escapes HTML in the model output instead of rendering it', () => {
    const { container } = render(
      <CoachMarkdown text={'- **<img src=x onerror=alert(1)>** <script>alert(1)</script>\n\n<b>raw</b> [x](javascript:alert(1))'} />,
    );

    expect(container.querySelector('img, script, b, a')).toBeNull();
    expect(container.textContent).toContain('<script>alert(1)</script>');
    expect(container.textContent).toContain('<b>raw</b>');
  });
});
