import "@testing-library/jest-dom/vitest";

// jsdom gaps: object URL management, matchMedia, ResizeObserver.
if (typeof URL.createObjectURL !== "function") {
  let counter = 0;
  URL.createObjectURL = (() => `blob:mock-${(counter += 1)}`) as typeof URL.createObjectURL;
  URL.revokeObjectURL = (() => {}) as typeof URL.revokeObjectURL;
}

if (typeof window !== "undefined") {
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }
  if (!window.ResizeObserver) {
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    Object.defineProperty(window, "ResizeObserver", {
      writable: true,
      value: ResizeObserverMock,
    });
  }
}
