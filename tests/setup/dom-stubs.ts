/**
 * Browser APIs that jsdom does not implement but Radix UI reaches for when it mounts.
 * Every stub is guarded, so this file is a no-op under the default node environment.
 */

if (typeof window !== "undefined") {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof globalThis.ResizeObserver;
  }

  if (typeof window.matchMedia !== "function") {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  }

  if (typeof Element.prototype.scrollIntoView !== "function") {
    Element.prototype.scrollIntoView = function scrollIntoView() {};
  }

  // Radix reads this before deciding how to position floating content.
  if (typeof Element.prototype.hasPointerCapture !== "function") {
    Element.prototype.hasPointerCapture = function hasPointerCapture() {
      return false;
    };
    Element.prototype.setPointerCapture = function setPointerCapture() {};
    Element.prototype.releasePointerCapture =
      function releasePointerCapture() {};
  }
}
