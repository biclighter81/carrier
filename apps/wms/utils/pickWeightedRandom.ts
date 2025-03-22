export function pickWeightedRandom<T extends string>(
  distribution: Record<T, number>
): T {
  const rand = Math.random();
  let cumulative = 0;

  for (const key of Object.keys(distribution) as T[]) {
    cumulative += distribution[key];
    if (rand < cumulative) {
      return key;
    }
  }

  // Fallback
  const keys = Object.keys(distribution) as T[];
  return keys[keys.length - 1];
}
