const POST_EXTENSIONS = ['md', 'mdx', 'mdoc'] as const;
export const POST_GLOB = `**/*.{${POST_EXTENSIONS.join(',')}}`;
export const POST_EXTENSION = new RegExp(`\\.(?:${POST_EXTENSIONS.join('|')})$`);
