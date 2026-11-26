/**
 * 블로그 다국어 (NOR-250).
 *
 * 페이지 언어는 **경로로 정한다**: `/en` 으로 시작하면 영어, 그 밖은 한국어다. 레이아웃·헤더·메타가
 * 저마다 `Astro.url.pathname` 에서 언어를 읽으므로, 언어 값을 위에서부터 넘겨줄 필요가 없고
 * 한 페이지 안에서 언어가 어긋날 수 없다.
 */
import type { PostLang } from '@gze1206/content-contract';

export type Lang = PostLang;

const EN_PREFIX = '/en';

export function langFromPath(pathname: string): Lang {
  return pathname === EN_PREFIX || pathname.startsWith(`${EN_PREFIX}/`) ? 'en' : 'ko';
}

/** 한국어 기준 경로(`/blog/x`)를 그 언어의 경로로 바꾼다. 영어 루트는 `/en` 이다. */
export function localizePath(lang: Lang, path: string): string {
  if (lang === 'ko') return path;
  return path === '/' ? EN_PREFIX : `${EN_PREFIX}${path}`;
}

const DATE_FORMATS: Record<Lang, Intl.DateTimeFormat> = {
  ko: new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }),
  en: new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }),
};

/** 화면에 보이는 날짜. 프론트매터 날짜는 UTC 자정이라 UTC 로 고정한다(`date.ts` 와 같은 이유). */
export function formatDate(date: Date, lang: Lang): string {
  return DATE_FORMATS[lang].format(date);
}

/** 읽는 시간 표기. 한국어는 `estimateReadingTime` 의 문구를 그대로 쓴다. */
export function readingLabel(time: { seconds: number; minutes: number }, lang: Lang): string {
  if (lang === 'en') return time.seconds < 60 ? 'Under 1 min' : `${time.minutes} min read`;
  return time.seconds < 60 ? '1분 미만' : `약 ${time.minutes}분`;
}

/** 화면 문구. 두 언어의 키가 같아야 한다(테스트가 확인한다). */
export const UI = {
  ko: {
    htmlLang: 'ko',
    locale: 'ko_KR',
    rssLanguage: 'ko-KR',
    skipToContent: '본문으로 건너뛰기',
    mainNav: '주요',
    footerNav: '보조',
    navBlog: '글',
    navAbout: '소개',
    navPortfolio: '포트폴리오',
    navTopics: '탐색',
    switchLanguage: 'English',
    readTranslation: 'Read in English',
    blogHeading: '블로그',
    blogDescription: 'gze1206이 쓴 글 목록입니다.',
    noPosts: '아직 발행된 글이 없습니다.',
    category: '카테고리',
    tags: '태그',
    updated: '수정',
    readingTime: '읽는 시간',
    draft: '초안',
    series: '시리즈',
    seriesPart: '편',
    previousPage: '이전 페이지',
    nextPage: '다음 페이지',
    pagination: '블로그 목록 페이지네이션',
    home: '홈',
    comments: '댓글',
    commentsHint: '이름만 적으면 남길 수 있습니다. 확인한 뒤 공개합니다.',
    commentsNoScript: '댓글을 보려면 JavaScript 를 켜야 합니다.',
    rss: 'RSS',
  },
  en: {
    htmlLang: 'en',
    locale: 'en_US',
    rssLanguage: 'en-US',
    skipToContent: 'Skip to content',
    mainNav: 'Main',
    footerNav: 'Secondary',
    navBlog: 'Blog',
    navAbout: 'About',
    navPortfolio: 'Portfolio',
    navTopics: 'Topics',
    switchLanguage: '한국어',
    readTranslation: '한국어로 읽기',
    blogHeading: 'Blog',
    blogDescription: 'Posts written in English by gze1206.',
    noPosts: 'No posts in English yet.',
    category: 'Category',
    tags: 'Tags',
    updated: 'Updated',
    readingTime: 'Reading time',
    draft: 'Draft',
    series: 'Series',
    seriesPart: 'Part',
    previousPage: 'Previous page',
    nextPage: 'Next page',
    pagination: 'Blog pagination',
    home: 'Home',
    comments: 'Comments',
    commentsHint: 'Just leave a name to comment. Comments appear after review.',
    commentsNoScript: 'Turn on JavaScript to see comments.',
    rss: 'RSS',
  },
} as const satisfies Record<Lang, Record<string, string>>;

interface Translatable {
  readonly data: { readonly lang: Lang; readonly translationKey?: string | undefined };
}

/** 같은 `translationKey` 를 가진 다른 언어 글. 없으면 undefined. */
export function findTranslation<T extends Translatable>(
  post: T,
  candidates: readonly T[],
): T | undefined {
  const key = post.data.translationKey;
  if (key === undefined) return undefined;
  return candidates.find(
    (candidate) => candidate.data.lang !== post.data.lang && candidate.data.translationKey === key,
  );
}
