import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AppHeader from './AppHeader';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('AppHeader documentation links', () => {
  it('uses the generated User Guide and falls back to its source location', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    render(<AppHeader />);

    const link = screen.getByRole('link', { name: 'User Guide' });
    expect(link.getAttribute('href')).toMatch(/\/docs\/documents\/UserGuide\.html$/);
    fireEvent.click(link);

    await waitFor(() => expect(open).toHaveBeenCalledWith(
      'https://github.com/ribocode-slola/ribocode1/blob/main/documentation/UserGuide.md',
      '_blank',
      'noopener,noreferrer'
    ));
  });
});
