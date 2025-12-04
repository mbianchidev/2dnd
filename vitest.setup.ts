// Vitest setup for browser-like environment
// Stub minimal canvas context to avoid Phaser initialization errors in tests that may import it.
if (typeof HTMLCanvasElement !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getContext = (HTMLCanvasElement.prototype as any).getContext
  if (!getContext) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(HTMLCanvasElement.prototype as any).getContext = () => ({
      canvas: document.createElement('canvas'),
    })
  }
}
