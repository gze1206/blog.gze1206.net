import type { CollectionEntry } from 'astro:content';

export function sortPortfolio<T extends { readonly id: string }>(entries: readonly T[]): T[] {
  return [...entries].sort((a, b) => a.id.localeCompare(b.id));
}
export async function getPortfolio(): Promise<CollectionEntry<'portfolio'>[]> {
  const { getCollection } = await import('astro:content');
  return sortPortfolio(await getCollection('portfolio'));
}
