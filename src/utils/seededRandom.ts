/** Stable FNV-1a identity hashing for procedural layouts. */
export function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Reproduce a salted integer-seeded sequence without consuming global randomness. */
export function createSeededRandom(seed: number, salt: string): () => number {
  let state = (seed ^ hashString(salt)) >>> 0;
  if (state === 0) state = 1;
  return (): number => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}
