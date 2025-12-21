/**
 * Finds the optimal X and Y axes keys from a set of tags to minimize the total number of charts.
 * The total number of charts is the product of the number of unique values in the X and Y axes.
 * We prioritize pairs where the product is at least 2.
 * If no pair has a product >= 2, we default to the first two available keys.
 *
 * @param tags A record where keys are tag names and values are arrays of tag options.
 * @returns A tuple [xKey, yKey] representing the selected axes. Returns null if fewer than 2 keys exist.
 */
export function findOptimalAxes(tags: Record<string, string[]>): [string, string] | null {
  const keys = Object.keys(tags);
  if (keys.length < 2) {
    return null;
  }

  let bestPair: [string, string] | null = null;
  let minProduct = Infinity;

  // Iterate through all unique pairs.
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const key1 = keys[i];
      const key2 = keys[j];

      const count1 = tags[key1].length;
      const count2 = tags[key2].length;

      const product = count1 * count2;

      if (product >= 2) {
        if (product < minProduct) {
          minProduct = product;
          bestPair = [key1, key2];
        }
      }
    }
  }

  // If we found a pair with product >= 2, return it.
  if (bestPair) {
    return bestPair;
  }

  // Fallback
  return [keys[0], keys[1]];
}
