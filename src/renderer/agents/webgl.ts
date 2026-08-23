/**
 * WebGL detection is tiny and isolated because a failed canvas must degrade the
 * Agents feature to a list, not crash the route. If scene setup lived inside the
 * route body, one GPU failure could take down all agent controls.
 */
export function canInitializeWebGl(): boolean {
  if (typeof document === "undefined") {
    return false;
  }
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}
