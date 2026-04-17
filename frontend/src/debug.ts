/**
 * Viewport debug overlay toggle.
 *
 * Flip DEBUG_VIEWPORT to true to always show the on-screen diagnostic overlay
 * and console-log viewport metrics on every viewport-related event. You can
 * also enable it at runtime without a rebuild by adding `?debug=viewport` to
 * the URL, or by setting `localStorage.debugViewport = '1'` in devtools.
 */

export const DEBUG_VIEWPORT: boolean = false;

export function isDebugViewportEnabled(): boolean {
  if (DEBUG_VIEWPORT) return true;
  if (typeof window === 'undefined') return false;

  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('debug') === 'viewport') return true;
  } catch {
    // ignore URL parse errors
  }

  try {
    if (window.localStorage?.getItem('debugViewport') === '1') return true;
  } catch {
    // localStorage may throw in private mode
  }

  return false;
}
