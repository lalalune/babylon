/**
 * Randomization utilities for adding entropy to prompts
 * 
 * Provides functions to shuffle arrays, sample random elements,
 * and add variety to AI prompts to prevent repetitive outputs.
 */

/**
 * Fisher-Yates shuffle algorithm
 * Randomly shuffles array in-place and returns it
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = temp;
  }
  return shuffled;
}

/**
 * Get N random samples from an array without replacement
 */
export function sampleRandom<T>(array: T[], count: number): T[] {
  const shuffled = shuffleArray(array);
  return shuffled.slice(0, Math.min(count, array.length));
}

/**
 * Get a single random element from an array
 */
export function pickRandom<T>(array: T[]): T | undefined {
  if (array.length === 0) return undefined;
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Randomly decide with a given probability (0-1)
 * Returns true with probability p, false otherwise
 */
export function randomChance(probability: number): boolean {
  return Math.random() < probability;
}

/**
 * Get random integer between min (inclusive) and max (exclusive)
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min)) + min;
}

