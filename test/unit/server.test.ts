// test/unit/server.test.ts
import { describe, expect, it } from 'vitest';

import { recursiveWatchSupported } from '../../src/dashboard/server.js';

describe('recursiveWatchSupported', () => {
  it('returns true on non-Windows platforms regardless of Node version', () => {
    expect(recursiveWatchSupported('linux', '24.0.0')).toBe(true);
    expect(recursiveWatchSupported('darwin', '24.0.0')).toBe(true);
    expect(recursiveWatchSupported('linux', '22.14.0')).toBe(true);
  });

  it('returns true on Windows with Node < 24', () => {
    expect(recursiveWatchSupported('win32', '22.14.0')).toBe(true);
    expect(recursiveWatchSupported('win32', '20.18.0')).toBe(true);
    expect(recursiveWatchSupported('win32', '23.6.0')).toBe(true);
  });

  it('returns false on Windows with Node >= 24', () => {
    expect(recursiveWatchSupported('win32', '24.0.0')).toBe(false);
    expect(recursiveWatchSupported('win32', '24.5.0')).toBe(false);
    expect(recursiveWatchSupported('win32', '30.0.0')).toBe(false);
  });

  it('returns true for malformed node versions on any platform', () => {
    expect(recursiveWatchSupported('win32', '')).toBe(true);
    expect(recursiveWatchSupported('win32', 'not-a-version')).toBe(true);
  });
});
