import { transformerNotationDiff, transformerNotationHighlight } from '@shikijs/transformers';
import type { ShikiTransformer } from 'shiki';
import { transformerContrast } from './contrast.ts';
import { transformerTitle } from './title.ts';

export const codeBlockTransformers: ShikiTransformer[] = [
  transformerNotationDiff(),
  transformerNotationHighlight(),
  transformerTitle(),
  // 대비 보정은 마지막에 — 앞의 트랜스포머가 만든 span 도 함께 지난다.
  transformerContrast(),
];
