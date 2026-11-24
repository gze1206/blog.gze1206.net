/**
 * GFM 작업 목록(`- [ ] 할 일`)의 Markdoc 렌더 (NOR-239).
 *
 * Markdoc 은 작업 목록을 모르므로 `[ ] ` 가 글자로 나온다. 블로그와 워크벤치 미리보기가 같은 노드를 써서
 * 둘의 모양이 갈라지지 않게 한다. 공개 글의 체크박스는 누를 수 없다.
 */
import Markdoc, { type Config, type Node, type RenderableTreeNode } from '@markdoc/markdoc';

// CommonJS 라 Node ESM 에서 이름 있는 import(Tag)가 되지 않는다. 기본값에서 꺼낸다.
const { Tag } = Markdoc;
const TASK_MARKER = /^\[([ xX])\] /u;

/** 첫 글자에서 작업 표시를 떼어 낸다. 느슨한 목록이면 첫 문단 안을 본다. 작업이 아니면 null. */
function splitTask(
  children: RenderableTreeNode[],
): { checked: boolean; children: RenderableTreeNode[] } | null {
  const [first, ...rest] = children;
  if (typeof first === 'string') {
    const match = TASK_MARKER.exec(first);
    if (match === null) return null;
    const text = first.slice(match[0].length);
    return { checked: match[1] !== ' ', children: text === '' ? rest : [text, ...rest] };
  }
  if (Tag.isTag(first) && first.name === 'p') {
    const inner = splitTask(first.children);
    if (inner === null) return null;
    return {
      checked: inner.checked,
      children: [new Tag('p', first.attributes, inner.children), ...rest],
    };
  }
  return null;
}

export const taskItemNode = {
  ...Markdoc.nodes.item,
  transform(node: Node, config: Config) {
    const children = node.transformChildren(config);
    const task = splitTask(children);
    if (task === null) return new Tag('li', {}, children);
    const box = new Tag('input', {
      type: 'checkbox',
      disabled: true,
      ...(task.checked ? { checked: true } : {}),
    });
    return new Tag('li', { class: 'task-list-item' }, [box, ...task.children]);
  },
};
