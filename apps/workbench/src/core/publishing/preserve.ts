/**
 * 블로그에 이미 있는 글을 다시 발행할 때 원래 표기를 지킨다 (NOR-209 AC-2).
 *
 * 워크벤치는 frontmatter 를 처음부터 다시 쓰므로 따옴표·목록 형식이 바뀐다. 값이 같은 필드는 블로그
 * 파일의 표기를 그대로 두고, 바뀐 필드만 고친다. 본문 앞 빈 줄 관례도 블로그 파일을 따른다.
 */
import { isMap, parse, parseDocument } from 'yaml';

interface Split {
  readonly yaml: string;
  readonly body: string;
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/u;

function split(source: string): Split | null {
  const match = FRONTMATTER.exec(source);
  if (!match) return null;
  return { yaml: match[1] ?? '', body: match[2] ?? '' };
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function preservePublishedFormat(current: string | null, next: string): string {
  if (current === null) return next;
  const before = split(current);
  const after = split(next);
  if (!before || !after) return next;

  const document = parseDocument(before.yaml);
  if (document.errors.length > 0 || !isMap(document.contents)) return next;
  const currentData = document.toJS() as Record<string, unknown>;
  const nextData = parse(after.yaml) as unknown;
  if (nextData === null || typeof nextData !== 'object' || Array.isArray(nextData)) return next;
  const wanted = nextData as Record<string, unknown>;

  let changed = false;
  for (const key of Object.keys(currentData)) {
    if (!(key in wanted)) {
      document.delete(key);
      changed = true;
    }
  }
  for (const [key, value] of Object.entries(wanted)) {
    if (!same(currentData[key], value)) {
      document.set(key, value);
      changed = true;
    }
  }
  const yaml = changed
    ? document.toString({ lineWidth: 0, flowCollectionPadding: false }).trimEnd()
    : before.yaml;

  // 본문 앞 빈 줄은 블로그 파일의 관례를 따른다.
  const leadingBlank = /^\r?\n/u.test(before.body);
  const body = after.body.replace(/^\r?\n/u, '');
  return `---\n${yaml}\n---\n${leadingBlank ? '\n' : ''}${body}`;
}
