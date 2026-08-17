/**
 * OG 카드 템플릿 — 규격·디자인 토큰·요소 트리 (NOR-28).
 *
 * 이 모듈은 **순수**하다. 폰트·래스터라이저·파일시스템을 모르고, 렌더러(Satori)가 먹는
 * 요소 트리(plain object)만 만든다. 그래서 템플릿을 단위 테스트할 수 있다.
 *
 * ### 색·타이포를 바꾸려면
 *
 * {@link OG_THEME} 한 곳만 고치면 된다. 베이스 테마는 NOR-24 에서 확정되므로, 그때
 * 사이트 토큰이 생기면 이 상수의 값만 그 토큰으로 갈아끼운다 — 템플릿 구조는 그대로다.
 *
 * ### 템플릿 3종
 *
 * | kind    | 쓰는 곳                          | 구성                          |
 * | ------- | -------------------------------- | ----------------------------- |
 * | `post`  | 글 상세                          | 시리즈 이름 + 제목 + 브랜드   |
 * | `list`  | 홈·목록·카테고리·태그·시리즈     | 라벨 + 제목 + 설명 + 브랜드   |
 * | `about` | About 페이지 (NOR-21 에서 생김)  | 라벨 + 이름 + 소개 + 브랜드   |
 *
 * `about` 은 아직 페이지가 없어 라우트가 생성되지 않는다. NOR-21 이 `/about` 을 만들면
 * `og-targets.ts` 의 정적 타깃 목록에 한 줄 추가하는 것으로 붙는다.
 */

import { fitTitle, truncateChars } from './og-text';

/** og:image 표준 규격. `og:image:width`/`height` 로도 그대로 나간다. */
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;
export const OG_IMAGE_TYPE = 'image/png';

/**
 * 카드 디자인 토큰. **색·간격을 바꾸려면 여기만 고친다.**
 *
 * 값은 사이트 팔레트 02C Mineral / Warm Paper 의 다크 면과 같다(NOR-149).
 * `src/styles/global.css` 의 `.dark` 토큰이 원본이며, 여기 값은 그 사본이다 —
 * Satori 는 CSS 변수를 읽지 못해 리터럴이 필요하다. 한쪽만 고치지 말 것.
 */
export const OG_THEME = {
  background: '#211f1d',
  foreground: '#efece7',
  muted: '#a49c93',
  accent: '#9fd0bb',
  /** 상단 강조 바 — 브랜드 색을 한 줄로만 쓴다(과한 장식 금지). */
  accentBarHeight: 10,
  padding: 72,
  /**
   * 제목 오른쪽에 비워 두는 폭(px).
   *
   * clamp 가 붙이는 `…` 는 마지막 줄 **끝**에 놓이는데, 줄이 폭을 꽉 채우면 그 `…` 가 경계에
   * 딱 붙어 잘려 보인다. 미리 조금 비워 두면 말줄임이 온전히 보인다.
   */
  titleTrailingSpace: 16,
  fontFamily: 'Pretendard',
  eyebrowSize: 30,
  descriptionSize: 30,
  brandSize: 30,
} as const;

/** 카드 안쪽 가로 폭(px). */
const CONTENT_WIDTH = OG_IMAGE_WIDTH - OG_THEME.padding * 2;
/** 라벨·설명 글자 수 상한. 넘치면 `…` 로 자른다. */
const EYEBROW_MAX_CHARS = 46;
const DESCRIPTION_MAX_CHARS = 110;

/** Satori 가 받는 요소 트리. React 없이 plain object 로 만든다. */
export interface OgNode {
  readonly type: string;
  readonly props: {
    readonly style?: Readonly<Record<string, string | number>>;
    readonly children?: OgChild | readonly OgChild[];
  };
}
export type OgChild = OgNode | string;

export type OgCardKind = 'post' | 'list' | 'about';

/** 카드 한 장을 그리는 데 필요한 전부. 직렬화 가능한 값만 담는다(캐시 키로 그대로 쓴다). */
export interface OgCardInput {
  readonly kind: OgCardKind;
  /** 카드의 큰 글씨. 글 제목 · 목록 제목 · 이름. */
  readonly title: string;
  /** 제목 위 작은 라벨. 글이면 시리즈 이름, 목록이면 분류 이름. 없으면 줄 자체를 렌더하지 않는다. */
  readonly eyebrow?: string | undefined;
  /** 제목 아래 설명. `post` 는 쓰지 않는다(제목·시리즈·브랜드만). */
  readonly description?: string | undefined;
  /** 우하단 브랜드 문자열. 호출부가 `SITE_NAME` 을 넘긴다(상수 중복을 만들지 않기 위해). */
  readonly brand: string;
}

function text(
  value: string,
  style: Readonly<Record<string, string | number>>,
  clampLines?: number,
): OgNode {
  return {
    type: 'div',
    props: {
      style: {
        // Satori 는 여러 자식을 가진 요소에 display 를 명시하지 않으면 렌더를 거부한다.
        // 텍스트는 clamp 를 쓰려면 block 이어야 한다(flex 에는 lineClamp 이 먹지 않는다).
        display: clampLines === undefined ? 'flex' : 'block',
        fontFamily: OG_THEME.fontFamily,
        ...(clampLines === undefined ? {} : { lineClamp: clampLines, overflow: 'hidden' }),
        ...style,
      },
      children: value,
    },
  };
}

/**
 * 카드 요소 트리를 만든다. 같은 입력은 항상 같은 트리다(캐시 키가 입력만으로 성립하는 근거).
 *
 * 레이아웃: 상단 강조 바 → 라벨 → 제목(세로 중앙) → 브랜드. 제목 글자 크기는
 * {@link fitTitle} 이 길이를 보고 고르고, 그래도 넘치면 `lineClamp` 이 `…` 로 자른다.
 * 두 겹으로 막기 때문에 아주 긴 제목에서도 카드 밖으로 글자가 새지 않는다.
 */
export function buildOgCard(input: OgCardInput): OgNode {
  const fit = fitTitle(input.title, { contentWidth: CONTENT_WIDTH - OG_THEME.titleTrailingSpace });
  const eyebrow =
    input.eyebrow === undefined ? '' : truncateChars(input.eyebrow, EYEBROW_MAX_CHARS);
  const description =
    input.description === undefined || input.kind === 'post'
      ? ''
      : truncateChars(input.description, DESCRIPTION_MAX_CHARS);

  const middle: OgChild[] = [
    text(
      fit.text,
      {
        fontSize: fit.fontSize,
        fontWeight: 700,
        lineHeight: fit.lineHeight,
        color: OG_THEME.foreground,
        letterSpacing: '-0.02em',
        paddingRight: OG_THEME.titleTrailingSpace,
      },
      // 글자 크기를 줄여도 안 담기는 제목이 남을 수 있다. 마지막 방어선으로 clamp 를 건다.
      fit.maxLines,
    ),
  ];
  if (description !== '') {
    middle.push(
      text(
        description,
        {
          marginTop: 24,
          fontSize: OG_THEME.descriptionSize,
          lineHeight: 1.45,
          color: OG_THEME.muted,
        },
        2,
      ),
    );
  }

  const body: OgChild[] = [];
  if (eyebrow !== '') {
    body.push(
      text(eyebrow, {
        fontSize: OG_THEME.eyebrowSize,
        fontWeight: 700,
        color: OG_THEME.accent,
        marginBottom: 28,
      }),
    );
  }
  body.push({
    type: 'div',
    props: {
      style: { display: 'flex', flexDirection: 'column' },
      children: middle,
    },
  });

  return {
    type: 'div',
    props: {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: OG_THEME.background,
        fontFamily: OG_THEME.fontFamily,
      },
      children: [
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              width: '100%',
              height: OG_THEME.accentBarHeight,
              backgroundColor: OG_THEME.accent,
            },
          },
        },
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              flexGrow: 1,
              padding: OG_THEME.padding,
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    flexGrow: 1,
                  },
                  children: body,
                },
              },
              text(input.brand, {
                fontSize: OG_THEME.brandSize,
                fontWeight: 700,
                color: OG_THEME.muted,
              }),
            ],
          },
        },
      ],
    },
  };
}
