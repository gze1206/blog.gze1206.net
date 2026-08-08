# Master 게시글 이관 설계

## 목표

`master` 브랜치의 운영 중인 Nuxt 블로그 게시글 4개를 Astro Content Collections의 `posts` 컬렉션으로 이관한다. 기존 공개 URL의 슬러그와 발행일·분류·태그를 유지하고, 새 사이트가 빌드 가능한 Markdoc 본문으로 정규화한다.

## 범위

- 대상: `master:app/content/articles/*.md`의 게시글 4개
- 제외: `v3` 브랜치, `app/content/careers/` 경력 콘텐츠, 도메인/DNS 변경
- 자산: 이관 대상 글이 실제로 참조하는 `master:app/static/img/` 파일만 `public/`으로 복사

## 데이터 변환

| 기존 필드/표기 | 새 형식 |
| --- | --- |
| `title`, `slug`, `category`, `tags` | 동일 값 보존 |
| `date` | `publishedAt`, `updatedAt`에 같은 ISO 시각 설정 |
| 기존 `description` | 사용하지 않음 |
| 본문 첫 의미 단락 | 글 내용을 바탕으로 작성한 한국어 `description` |
| `<!--more-->` | 제거 |
| `:br` | 빈 줄로 정규화 |
| ````lang[filename]` | ````lang title="filename"` |

모든 이관 게시글에는 `draft: false`를 명시한다. 시리즈 정보는 원본에 없으므로 추가하지 않는다.

## 구현 구조

재사용 가능한 순수 변환 함수는 `src/lib/legacy-post-migration.ts`에 둔다. 이 함수는 원본 frontmatter와 본문을 입력으로 받아, 새 스키마에 맞는 frontmatter와 정규화한 Markdoc 본문을 반환한다. 이관 실행은 저장소의 `master` Git 객체를 읽어 그 결과를 `src/content/posts/`에 반영한다.

변환기는 Nuxt 전용 줄바꿈 표기·excerpt marker·코드 펜스 파일명만 변경한다. 나머지 Markdown 문법과 원문은 보존해 의미를 임의로 바꾸지 않는다.

## 오류 처리

- 필수 frontmatter(`title`, `slug`, `date`, `category`, `tags`)가 없으면 해당 글을 이관하지 않고 오류를 낸다.
- 영문 kebab-case 슬러그가 아니면 현재 Content Collections 스키마를 통과할 수 없으므로 오류를 낸다.
- 참조 이미지가 원본 Git 트리에 없으면 본문 경로를 바꾸지 않고 오류를 낸다.

## 검증

- 변환 함수 테스트: Nuxt 표기 정규화, 코드 블록 title 변환, 메타데이터 매핑, 필수 입력 누락 오류
- 이관 후 4개 글의 슬러그/날짜/카테고리/태그 및 `draft: false` 확인
- `pnpm lint`, `pnpm test`, `pnpm build` 통과

## 완료 기준

`src/content/posts/`에 이관된 4개 게시글이 존재하고, 새 Cloudflare Pages 배포에서 기존 `/blog/<slug>/` 경로로 정적 렌더링된다. 기존 도메인과 DNS에는 변경을 가하지 않는다.
