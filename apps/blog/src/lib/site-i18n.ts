/**
 * 사이트 콘텐츠(프로필·경력·포트폴리오)의 언어별 값 (NOR-251).
 *
 * 항목마다 선택 필드 `en` 에 번역할 글자만 둔다. 영어 값이 없거나 비면 한국어 값을 쓴다 —
 * 번역을 빠뜨린 칸이 빈칸으로 보이는 것보다 낫다. 날짜·링크·이미지 경로는 두 언어가 함께 쓴다.
 */
import type { Lang } from './i18n';

interface ProfileLike {
  readonly name: string;
  readonly headline: string;
  readonly tagline?: string | undefined;
  readonly introduction: string;
  readonly about: readonly string[];
  readonly skills: readonly string[];
  readonly links: readonly {
    readonly label: string;
    readonly url: string;
    readonly handle?: string | undefined;
  }[];
  readonly en?:
    | {
        readonly name?: string | undefined;
        readonly headline: string;
        readonly tagline?: string | undefined;
        readonly introduction: string;
        readonly about: readonly string[];
        readonly linkLabels: Readonly<Record<string, string>>;
      }
    | undefined;
}

export function localizeProfile<T extends ProfileLike>(profile: T, lang: Lang) {
  const en = lang === 'en' ? profile.en : undefined;
  if (en === undefined) return profile;
  return {
    ...profile,
    name: en.name ?? profile.name,
    headline: en.headline,
    tagline: en.tagline ?? profile.tagline,
    introduction: en.introduction,
    about: en.about.length > 0 ? en.about : profile.about,
    links: profile.links.map((link) => ({
      ...link,
      label: en.linkLabels[link.label] ?? link.label,
    })),
  };
}

interface ExperienceLike {
  readonly organization: string;
  readonly role: string;
  readonly period: string;
  readonly highlights: readonly string[];
  readonly en?:
    | {
        readonly organization?: string | undefined;
        readonly role: string;
        readonly highlights: readonly string[];
      }
    | undefined;
}

export function localizeExperience(experience: ExperienceLike, lang: Lang) {
  const en = lang === 'en' ? experience.en : undefined;
  return {
    organization: en?.organization ?? experience.organization,
    role: en?.role ?? experience.role,
    // 기간 형식(NOR-236)의 "현재" 만 영어로 바꾼다. 날짜는 그대로다.
    period: lang === 'en' ? experience.period.replace('현재', 'Present') : experience.period,
    highlights: en?.highlights ?? experience.highlights,
  };
}

interface PortfolioLike {
  readonly title: string;
  readonly summary: string;
  readonly role?: string | undefined;
  readonly period?: string | undefined;
  readonly stack: readonly string[];
  readonly highlights: readonly string[];
  readonly media: readonly {
    readonly src: string;
    readonly alt: string;
    readonly width: number;
    readonly height: number;
    readonly caption?: string | undefined;
  }[];
  readonly en?:
    | {
        readonly title?: string | undefined;
        readonly summary: string;
        readonly role?: string | undefined;
        readonly stack?: readonly string[] | undefined;
        readonly highlights: readonly string[];
        readonly media: readonly { readonly alt: string; readonly caption?: string | undefined }[];
      }
    | undefined;
}

export function localizePortfolio<T extends PortfolioLike>(entry: T, lang: Lang) {
  const en = lang === 'en' ? entry.en : undefined;
  if (en === undefined) return entry;
  return {
    ...entry,
    title: en.title ?? entry.title,
    summary: en.summary,
    role: en.role ?? entry.role,
    period: entry.period?.replace('현재', 'Present'),
    stack: en.stack ?? entry.stack,
    highlights: en.highlights.length > 0 ? en.highlights : entry.highlights,
    // 이미지 설명은 순서대로 맞춘다. 영어가 없는 이미지는 한국어 설명을 쓴다.
    media: entry.media.map((image, index) => {
      const text = en.media[index];
      return text === undefined
        ? image
        : {
            ...image,
            alt: text.alt,
            ...(text.caption === undefined ? {} : { caption: text.caption }),
          };
    }),
  };
}
