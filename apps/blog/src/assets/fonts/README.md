# OG 이미지용 폰트

여기 있는 폰트는 **빌드타임 OG 이미지 렌더링 전용**이다(NOR-28). 브라우저로 나가지 않는다 —
사이트 웹폰트는 `BaseLayout.astro` 가 `pretendard` 패키지의 동적 서브셋으로 제공하는 Pretendard
Variable 이고, 이 파일들은
`src/lib/og-render.ts` 가 Node 에서 읽어 Satori 에 넘길 뿐이다.

사이트에는 제목 전용 세리프가 하나 더 있다(NOR-149): `@fontsource/noto-serif-kr` 의 **600**
한 굵기다. 저장소에 파일을 두지 않고 npm 패키지의 `unicode-range` 서브셋(120 조각)을 그대로
쓰므로, 제목에 실제로 쓰인 음절이 든 조각만 내려온다 — 같은 패키지의 `korean-600.css` 는
통짜 957 KB 라 쓰지 않는다. Noto Serif KR 도 SIL Open Font License 1.1 이며 전문은 패키지
안(`node_modules/@fontsource/noto-serif-kr/LICENSE`)에 함께 배포된다.

| 파일                     | 용도              | 크기   |
| ------------------------ | ----------------- | ------ |
| `Pretendard-Regular.otf` | 설명·브랜드 (400) | 1.5 MB |
| `Pretendard-Bold.otf`    | 제목·라벨 (700)   | 1.5 MB |

## 출처

- 프로젝트: **Pretendard** — https://github.com/orioncactus/pretendard
- 버전: 1.3.9 (npm `pretendard@1.3.9` 의 `dist/public/static/*.otf`, 무수정 원본)
- 사이트 웹폰트와 같은 서체이므로 OG 카드와 실제 페이지의 인상이 어긋나지 않는다.

## 라이선스

**SIL Open Font License 1.1** — 전문은 [`OFL.txt`](./OFL.txt).

OFL 은 임베드·재배포·번들을 명시적으로 허용한다. 지켜야 할 것:

- 라이선스 전문을 함께 배포한다 → `OFL.txt` 를 같은 디렉터리에 둔 이유다.
- 폰트 자체를 판매하지 않는다 (해당 없음).
- **Reserved Font Name("Pretendard")** — 파일을 수정하면 그 이름을 쓸 수 없다.
  그래서 서브셋을 만들지 않고 **원본을 그대로** 둔다. 서브셋의 이득·위험 비교는 ADR 0014 참고.

## 왜 서브셋하지 않는가 (요약)

측정값 — Pretendard Regular OTF(CFF) 기준:

| 대상                                 | 크기    |
| ------------------------------------ | ------- |
| 원본                                 | 1537 KB |
| 라틴 + 자모 + **현대 한글 11,172자** | 1247 KB |
| 라틴 + 자모 + 한글 2,350자           | 324 KB  |

한글을 전부 담으면 어차피 19% 밖에 줄지 않는다. 크게 줄이려면 글자를 버려야 하고, 그러면
서브셋에 없는 글자가 제목에 들어온 날 **두부(□)** 가 된다. 자세한 판단은 ADR 0014.
