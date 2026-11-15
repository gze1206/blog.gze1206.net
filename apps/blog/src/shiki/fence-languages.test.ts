import { describe, expect, it } from 'vitest';
import { extractFenceLanguages } from './fence-languages';

describe('extractFenceLanguages', () => {
  it('펜스의 언어 이름을 모은다', () => {
    const source = ['```ts', 'const a = 1;', '```', '', '```csharp', 'var b = 2;', '```'].join(
      '\n',
    );
    expect(extractFenceLanguages(source)).toEqual(['ts', 'csharp']);
  });

  it('중복은 한 번만 담는다', () => {
    const source = ['```ts', 'a', '```', '```ts', 'b', '```'].join('\n');
    expect(extractFenceLanguages(source)).toEqual(['ts']);
  });

  it('title 메타를 언어 이름으로 착각하지 않는다', () => {
    const source = ['```ts title="src/main.ts"', 'const a = 1;', '```'].join('\n');
    expect(extractFenceLanguages(source)).toEqual(['ts']);
  });

  it('언어가 없는 펜스는 담지 않는다 (plaintext 로 처리된다)', () => {
    expect(extractFenceLanguages(['```', 'plain', '```'].join('\n'))).toEqual([]);
  });

  it('코드블럭 안의 펜스는 코드 내용이지 새 블럭이 아니다', () => {
    const source = ['````md', '```json', '{ "a": 1 }', '```', '````', '```ts', 'a', '```'].join(
      '\n',
    );
    // 안쪽 ```json 은 md 블럭의 내용이다.
    expect(extractFenceLanguages(source)).toEqual(['md', 'ts']);
  });

  it('~~~ 펜스도 인식한다', () => {
    expect(extractFenceLanguages(['~~~python', 'x = 1', '~~~'].join('\n'))).toEqual(['python']);
  });

  it('대소문자가 섞여도 하나로 본다', () => {
    expect(extractFenceLanguages(['```TS', 'a', '```', '```ts', 'b', '```'].join('\n'))).toEqual([
      'ts',
    ]);
  });

  it('코드블럭이 없으면 빈 배열이다', () => {
    expect(extractFenceLanguages('# 제목\n\n본문뿐입니다.')).toEqual([]);
  });
});
