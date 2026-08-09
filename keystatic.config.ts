/**
 * Keystatic CMS 설정 (NOR-19).
 *
 * 이 파일은 `src/content/schemas.ts` 의 zod 스키마를 **폼으로 옮긴 것**이다. 진실의 원천은
 * 어디까지나 zod 쪽이고, 여기서 만들어진 파일이 zod 를 통과하지 못하면 다음 빌드가 깨진다.
 * 그래서 필드 이름·타입·필수 여부·기본값은 zod 와 1:1 로 맞춰 두었다. 대응표와 Keystatic
 * 으로 표현할 수 없는 제약(동반 필수 등)은 `docs/spec/NOR-19-keystatic.md` 에 있다.
 *
 * 어드민 UI 는 Cloudflare Worker 의 `/keystatic`과 `/api/keystatic`에서 실행한다(ADR 0015).
 * GitHub App 비밀값은 배포 환경 변수로만 제공하며 이 파일에는 넣지 않는다.
 */

import { collection, config, fields, singleton } from '@keystatic/core';
import { block, wrapper } from '@keystatic/core/content-components';
import { SLUG_PATTERN, SLUG_PATTERN_MESSAGE } from './src/content/slug-pattern';

const slugPatternValidation = {
  regex: SLUG_PATTERN,
  message: SLUG_PATTERN_MESSAGE,
} as const;

const postContentComponents = {
  bookmark: block({
    label: '북마크',
    schema: {
      url: fields.url({ label: 'URL', validation: { isRequired: true } }),
      title: fields.text({ label: '제목' }),
      description: fields.text({ label: '설명', multiline: true }),
      image: fields.text({ label: '대표 이미지 URL' }),
      siteName: fields.text({ label: '사이트 이름' }),
    },
    ContentView: () => null,
  }),
  github: block({
    label: 'GitHub 카드',
    schema: {
      repo: fields.text({ label: '저장소', validation: { isRequired: true } }),
      description: fields.text({ label: '설명', multiline: true }),
      stars: fields.integer({ label: '스타 수', validation: { min: 0 } }),
      language: fields.text({ label: '주 언어' }),
    },
    ContentView: () => null,
  }),
  callout: wrapper({
    label: '콜아웃',
    schema: {
      type: fields.select({
        label: '유형',
        defaultValue: 'note',
        options: [
          { label: '참고', value: 'note' },
          { label: '정보', value: 'info' },
          { label: '팁', value: 'tip' },
          { label: '성공', value: 'success' },
          { label: '주의', value: 'warning' },
          { label: '위험', value: 'danger' },
        ],
      }),
      title: fields.text({ label: '제목' }),
      children: fields.child({ kind: 'block', placeholder: '콜아웃 내용' }),
    },
    ContentView: () => null,
  }),
};

/**
 * 프론트매터/JSON 의 `slug` 값과 파일명을 **같은 문자열**로 묶는다.
 *
 * Keystatic 의 slug 필드는 `name` 을 데이터에 쓰고 `slug` 를 파일명으로 쓴다. 기본 동작은
 * `name` 을 슬러그화(slugify)하는 것인데, 한글 제목에서 파생시키면 무엇이 나올지 알 수 없다.
 * 그래서 `name` 자체를 슬러그로 받고(패턴 검증) `generate` 를 항등 함수로 둔다.
 * 결과적으로 zod 의 `slugSchema` 를 통과하는 값만 저장할 수 있다.
 */
function slugField(label: string, description: string) {
  return fields.slug({
    name: {
      label,
      description,
      validation: { isRequired: true, pattern: slugPatternValidation },
    },
    slug: {
      label: '파일명',
      description: '위 슬러그와 같은 값을 씁니다. 파일 이름이 되므로 바꾸면 파일이 이동합니다.',
      generate: (name) => name,
      validation: { pattern: slugPatternValidation },
    },
  });
}

export default config({
  storage: { kind: 'github', repo: 'gze1206/blog.gze1206.net' },

  ui: {
    brand: { name: 'gze1206.net' },
    navigation: { 콘텐츠: ['posts', 'series', 'portfolio', 'profile', 'experience'] },
  },

  singletons: {
    profile: singleton({
      label: '소개',
      path: 'src/content/profile',
      format: { data: 'json' },
      schema: {
        name: fields.text({ label: '이름', validation: { isRequired: true } }),
        headline: fields.text({ label: '한 줄 소개', validation: { isRequired: true } }),
        introduction: fields.text({
          label: '소개',
          multiline: true,
          validation: { isRequired: true },
        }),
        skills: fields.array(fields.text({ label: '기술' }), {
          label: '주요 기술',
          validation: { length: { min: 1 } },
        }),
      },
    }),
  },

  collections: {
    posts: collection({
      label: '글',
      // 엔트리 하나 = 파일 하나(`src/content/posts/<slug>.mdoc`).
      path: 'src/content/posts/*',
      format: { contentField: 'content' },
      slugField: 'slug',
      columns: ['title', 'publishedAt'],
      entryLayout: 'content',
      // 순서 = 프론트매터 키 순서. 손으로 쓴 기존 글과 같은 순서로 맞춰 둔다.
      schema: {
        title: fields.text({
          label: '제목',
          validation: { isRequired: true },
        }),
        description: fields.text({
          label: '설명',
          description: '목록 카드와 검색 결과에 쓰입니다.',
          multiline: true,
          validation: { isRequired: true },
        }),
        slug: slugField('슬러그', '글의 URL 이 됩니다: /blog/<슬러그>'),
        category: fields.text({
          label: '카테고리',
          description: '글 하나당 하나. 목록은 /category 에서 만들어집니다.',
          validation: { isRequired: true },
        }),
        tags: fields.array(fields.text({ label: '태그' }), {
          label: '태그',
          description: '최소 1개.',
          itemLabel: (props) => props.value,
          validation: { length: { min: 1 } },
        }),
        series: fields.relationship({
          label: '시리즈',
          collection: 'series',
          description:
            '시리즈에 넣지 않으려면 비워 둡니다. 채웠다면 아래 "시리즈 순서"도 필수입니다.',
        }),
        seriesOrder: fields.integer({
          label: '시리즈 순서',
          description: '시리즈를 지정했을 때만 채웁니다. 1 이상, 시리즈 안에서 유일해야 합니다.',
          validation: { min: 1 },
        }),
        publishedAt: fields.date({
          label: '발행일',
          defaultValue: { kind: 'today' },
          validation: { isRequired: true },
        }),
        updatedAt: fields.date({
          label: '수정일',
          defaultValue: { kind: 'today' },
          validation: { isRequired: true },
        }),
        draft: fields.checkbox({
          label: '초안',
          description: '켜 두면 프로덕션 빌드에서 제외됩니다(개발 서버에서는 보입니다).',
          defaultValue: false,
        }),
        content: fields.markdoc({
          label: '본문',
          extension: 'mdoc',
          options: {
            image: {
              directory: 'public/uploads',
              publicPath: '/uploads/',
            },
          },
          components: postContentComponents,
        }),
      },
    }),

    series: collection({
      label: '시리즈',
      path: 'src/content/series/*',
      format: { data: 'json' },
      slugField: 'slug',
      columns: ['name'],
      schema: {
        name: fields.text({ label: '이름', validation: { isRequired: true } }),
        slug: slugField('슬러그', '시리즈 페이지의 URL 이 됩니다: /series/<슬러그>'),
        description: fields.text({
          label: '설명',
          multiline: true,
          validation: { isRequired: true },
        }),
      },
    }),

    portfolio: collection({
      label: '포트폴리오',
      path: 'src/content/portfolio/*',
      format: { data: 'json' },
      slugField: 'id',
      columns: ['title'],
      schema: {
        id: slugField('ID', '항목을 구분하는 식별자입니다. 파일 이름이 됩니다.'),
        title: fields.text({ label: '제목', validation: { isRequired: true } }),
        summary: fields.text({
          label: '요약',
          multiline: true,
          validation: { isRequired: true },
        }),
        stack: fields.array(fields.text({ label: '기술' }), {
          label: '기술 스택',
          description: '최소 1개.',
          itemLabel: (props) => props.value,
          validation: { length: { min: 1 } },
        }),
        links: fields.array(
          fields.object(
            {
              repo: fields.url({ label: '저장소' }),
              demo: fields.url({ label: '데모' }),
              video: fields.url({ label: '영상' }),
              article: fields.url({ label: '글' }),
            },
            { label: '링크' },
          ),
          {
            label: '링크',
            description: '최소 1개. 링크 하나당 URL 을 최소 1개는 채워야 합니다.',
            itemLabel: (props) =>
              props.fields.repo.value ??
              props.fields.demo.value ??
              props.fields.video.value ??
              props.fields.article.value ??
              '(빈 링크)',
            validation: { length: { min: 1 } },
          },
        ),
        thumbnail: fields.text({
          label: '썸네일 경로',
          description: '선택. 비워 두면 저장되지 않습니다.',
        }),
      },
    }),

    experience: collection({
      label: '경력',
      path: 'src/content/experience/*',
      format: { data: 'json' },
      slugField: 'id',
      columns: ['organization', 'role', 'visible'],
      schema: {
        id: slugField('ID', '항목을 구분하는 식별자입니다. 파일 이름이 됩니다.'),
        organization: fields.text({ label: '조직', validation: { isRequired: true } }),
        role: fields.text({ label: '역할', validation: { isRequired: true } }),
        period: fields.text({
          label: '공개 기간',
          description: '공개해도 되는 기간 표기를 직접 입력합니다.',
          validation: { isRequired: true },
        }),
        endDate: fields.date({
          label: '종료일',
          description: '정렬 전용입니다. 현재 재직 중이면 비워 둡니다.',
        }),
        highlights: fields.array(fields.text({ label: '성과' }), {
          label: '주요 성과',
          validation: { length: { min: 1 } },
        }),
        visible: fields.checkbox({
          label: '공개',
          description: '켜야 정적 사이트에 표시됩니다.',
          defaultValue: false,
        }),
      },
    }),
  },
});
