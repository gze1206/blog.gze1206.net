import type { ShikiTransformer } from 'shiki';
import type { Element, Text } from 'hast';

export function transformerTitle(): ShikiTransformer {
  return {
    name: 'code-block-title',
    root(root) {
      const raw = (this.options.meta as Record<string, string> | undefined)?.__raw;
      if (!raw) return;
      const match = raw.match(/title="([^"]+)"/);
      if (!match) return;
      const title = match[1];

      const pre = root.children.find(
        (c): c is Element => c.type === 'element' && c.tagName === 'pre',
      );
      if (!pre) return;

      const figcaption: Element = {
        type: 'element',
        tagName: 'figcaption',
        properties: { class: 'code-block-title' },
        children: [{ type: 'text', value: title } as Text],
      };

      const figure: Element = {
        type: 'element',
        tagName: 'figure',
        properties: { class: 'code-block' },
        children: [figcaption, pre],
      };

      root.children = [figure];
    },
  };
}
