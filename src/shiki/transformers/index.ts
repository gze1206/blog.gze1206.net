import { transformerNotationDiff, transformerNotationHighlight } from '@shikijs/transformers';
import type { ShikiTransformer } from 'shiki';
import { transformerTitle } from './title.ts';

export const codeBlockTransformers: ShikiTransformer[] = [
  transformerNotationDiff(),
  transformerNotationHighlight(),
  transformerTitle(),
];
