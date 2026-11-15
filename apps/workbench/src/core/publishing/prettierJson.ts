const PRINT_WIDTH = 100;

interface FormatOptions {
  /** 배열 안의, 원시 값만 가진 객체가 한 줄에 들어가면 한 줄로 쓴다(Prettier 가 그대로 두는 모양). */
  readonly inlineArrayObjects: boolean;
}

/**
 * 저장소 Prettier(json, printWidth 100)와 같은 모양으로 쓴다 (NOR-213). 객체는 펼치고, 배열은 한 줄에
 * 들어가면 한 줄로 쓴다. 블로그 CI 의 format:check 를 통과해야 자동 병합(NOR-210)이 된다.
 */
function formatJson(
  value: unknown,
  indent: number,
  options: FormatOptions,
  prefix = '',
  inArray = false,
): string {
  const pad = ' '.repeat(indent);
  const inner = ' '.repeat(indent + 2);
  const fits = (text: string) =>
    !text.includes('\n') &&
    pad.length + displayWidth(prefix) + displayWidth(text) + 1 <= PRINT_WIDTH;
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const items = value.map((item) => formatJson(item, indent + 2, options, '', true));
    const inline = `[${items.join(', ')}]`;
    // Prettier 는 키가 둘 이상인 객체가 여럿 든 배열을 늘 펼친다.
    const objectList =
      value.length > 1 &&
      value.every((item) => isPlainObject(item) && Object.keys(item).length > 1);
    if (!objectList && fits(inline)) return inline;
    // 펼친 배열 안의 객체는 펼친다. 한 줄 객체는 배열 전체가 한 줄일 때만 쓴다.
    const broken = value.map((item) => formatJson(item, indent + 2, options));
    return `[\n${broken.map((item) => `${inner}${item}`).join(',\n')}\n${pad}]`;
  }
  if (isPlainObject(value)) {
    const entries = Object.entries(value).filter(([, item]) => item !== undefined);
    if (entries.length === 0) return '{}';
    if (
      options.inlineArrayObjects &&
      inArray &&
      entries.every(([, item]) => item === null || typeof item !== 'object')
    ) {
      const inline = `{ ${entries.map(([key, item]) => `${JSON.stringify(key)}: ${JSON.stringify(item)}`).join(', ')} }`;
      if (fits(inline)) return inline;
    }
    return `{\n${entries
      .map(([key, item]) => {
        const head = `${JSON.stringify(key)}: `;
        return `${inner}${head}${formatJson(item, indent + 2, options, head)}`;
      })
      .join(',\n')}\n${pad}}`;
  }
  return JSON.stringify(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** 동아시아 넓은 문자(한글·한자·가나·전각)는 Prettier 처럼 두 칸으로 센다. */
const WIDE =
  /[\u1100-\u115F\u2E80-\u303E\u3041-\u33FF\u3400-\u4DBF\u4E00-\u9FFF\uA960-\uA97F\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFF60\uFFE0-\uFFE6]/u;

function displayWidth(text: string): number {
  let width = 0;
  for (const char of text) width += WIDE.test(char) ? 2 : 1;
  return width;
}

/** 값 하나를 저장소 Prettier 형식의 JSON 파일 내용(끝 줄바꿈 포함)으로 쓴다. */
export function formatPrettierJson(value: unknown, options: Partial<FormatOptions> = {}): string {
  return `${formatJson(value, 0, { inlineArrayObjects: options.inlineArrayObjects ?? false })}\n`;
}
