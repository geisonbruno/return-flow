import { afterEach, describe, expect, it, vi } from 'vitest';

import { openBlobInNewTab, returnPdfFilename, triggerBlobDownload } from './pdfDownload';

describe('returnPdfFilename', () => {
  it('mirrors the backend filename for a normal return number', () => {
    expect(returnPdfFilename('RF-000123')).toBe('ReturnFlow-RF-000123.pdf');
  });

  it('replaces anything outside the safe whitelist so a filename can never carry path syntax', () => {
    expect(returnPdfFilename('RF/../000123')).toBe('ReturnFlow-RF----000123.pdf');
    expect(returnPdfFilename('RF 000123"')).toBe('ReturnFlow-RF-000123-.pdf');
  });
});

describe('triggerBlobDownload', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('names the download, then revokes the object URL it created', () => {
    URL.createObjectURL = vi.fn(() => 'blob:generated');
    URL.revokeObjectURL = vi.fn();
    let clicked: { href: string; download: string } | null = null;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function mocked(this: HTMLAnchorElement) {
      clicked = { href: this.href, download: this.download };
      // The anchor must still be in the document at click time for Firefox.
      expect(document.body.contains(this)).toBe(true);
    });

    triggerBlobDownload(new Blob(['%PDF-1.6'], { type: 'application/pdf' }), 'ReturnFlow-RF-000123.pdf');

    expect(clicked).toEqual({ href: 'blob:generated', download: 'ReturnFlow-RF-000123.pdf' });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:generated');
    // No stray anchor is left behind in the document.
    expect(document.querySelector('a')).toBeNull();
  });

  it('still revokes the object URL when the click itself throws', () => {
    URL.createObjectURL = vi.fn(() => 'blob:generated');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      throw new Error('click failed');
    });

    expect(() => triggerBlobDownload(new Blob(['x']), 'file.pdf')).toThrow('click failed');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:generated');
  });
});

describe('openBlobInNewTab', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('opens the object URL in a new tab and clears the opener link', () => {
    URL.createObjectURL = vi.fn(() => 'blob:generated');
    URL.revokeObjectURL = vi.fn();
    const printWindow = { opener: {} as unknown } as Window;
    const openSpy = vi.fn(() => printWindow);
    vi.stubGlobal('open', openSpy);

    expect(openBlobInNewTab(new Blob(['%PDF-1.6'], { type: 'application/pdf' }))).toBe(true);

    expect(openSpy).toHaveBeenCalledWith('blob:generated', '_blank');
    expect(printWindow.opener).toBeNull();
  });

  it('keeps the object URL alive while the tab loads, then releases it on a bounded timer', () => {
    vi.useFakeTimers();
    URL.createObjectURL = vi.fn(() => 'blob:generated');
    URL.revokeObjectURL = vi.fn();
    vi.stubGlobal('open', vi.fn(() => ({ opener: {} }) as unknown as Window));

    openBlobInNewTab(new Blob(['%PDF-1.6'], { type: 'application/pdf' }));

    // Revoking immediately would leave the new tab with a broken document.
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60_000);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:generated');
  });

  it('reports a blocked pop-up and releases the unusable object URL immediately', () => {
    URL.createObjectURL = vi.fn(() => 'blob:generated');
    URL.revokeObjectURL = vi.fn();
    vi.stubGlobal('open', vi.fn(() => null));

    expect(openBlobInNewTab(new Blob(['x']))).toBe(false);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:generated');
  });

  it('still opens the tab when the browser refuses to let opener be cleared', () => {
    URL.createObjectURL = vi.fn(() => 'blob:generated');
    URL.revokeObjectURL = vi.fn();
    const printWindow = {} as Window;
    Object.defineProperty(printWindow, 'opener', {
      get: () => null,
      set: () => {
        throw new Error('opener is read-only');
      },
    });
    vi.stubGlobal('open', vi.fn(() => printWindow));

    expect(openBlobInNewTab(new Blob(['x']))).toBe(true);
  });
});
