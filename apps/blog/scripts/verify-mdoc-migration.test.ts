import { describe, expect, it } from 'vitest';
import { findUnmigratedPosts } from './verify-mdoc-migration.mjs';

describe('author-editable post migration', () => {
  it('keeps every author-editable post in Markdoc storage', () => {
    expect(findUnmigratedPosts('src/content/posts')).toEqual([]);
  });
});
