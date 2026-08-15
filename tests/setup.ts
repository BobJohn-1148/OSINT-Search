import "@testing-library/jest-dom/vitest";

class TestResizeObserver {
  public observe(): void {}
  public unobserve(): void {}
  public disconnect(): void {}
}

globalThis.ResizeObserver = TestResizeObserver;
