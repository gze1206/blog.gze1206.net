# NOR-143 — Private Workbench M1 기반 명세

## 목적

단일 사용자가 Tailnet 안에서 오늘의 불렛을 빠르게 기록하고, Markdown 템플릿으로 비공개 글·회고를 만들며, 명시적 검토를 거쳐 public 블로그의 Markdoc 초안을 만드는 기반을 제공한다.

## 설계 결정

- **UI/서버**: Vite + React 19 + Hono(Node runtime) + TypeScript strict + Tailwind를 쓴다. Hono API만 파일·Git을 다루고, React 클라이언트는 검증된 HTTP 계약만 사용한다.
- **원본**: 앱 코드와 분리된 `WORKSPACE_ROOT` Git 저장소의 Markdown/YAML frontmatter다. 데이터베이스는 만들지 않는다. 나중에 검색 인덱스를 추가해도 재생성 가능한 캐시여야 한다.
- **보안**: Node 서버는 `127.0.0.1`에만 바인딩한다. Tailscale Serve가 HTTPS·Tailnet ACL 경계를 제공하며 Funnel은 사용하지 않는다. Serve identity header는 localhost에서 들어온 요청에만 신뢰한다.
- **Git**: `WORKSPACE_ROOT` Git은 개인 원본의 이력이다. public 블로그 Git은 읽기 전용 clone에서 시작하고, 사용자가 발행을 확정한 경우에만 별도 `content/<slug>` 브랜치에 커밋한다. 자동 push는 없다.

이 선택은 Claude `claude-opus-4-8` 아키텍처 자문의 Vite + React + Hono/Tailscale Serve 권고와 현재 공개 블로그의 Markdoc 계약을 반영한다.

## 세 저장소와 디렉터리 계약

`personal-workbench`는 앱 코드·문서만 담는 private 저장소다. 개인 콘텐츠는 별도 private `WORKSPACE_ROOT` Git 저장소에, 공개 출력은 별도 public 블로그 clone에 둔다. 어느 저장소도 다른 저장소의 submodule이 아니다.

```text
WORKSPACE_ROOT/
  inbox/YY-MM-DD.md
  journal/YYYY/YYYY-MM-DD.md
  notes/<slug>.md
  drafts/<slug>.md
  reviews/weekly/YYYY-Www.md
  reviews/monthly/YYYY-MM.md
  templates/<kind>.md
  assets/<document-id>/...
```

모든 API 입력 경로는 `WORKSPACE_ROOT`를 `realpath`한 뒤 그 하위인지 검증한다. `..`, 심볼릭 링크 탈출, 절대 경로는 거부한다. 문서 저장은 같은 디렉터리의 임시 파일에 쓴 뒤 `rename`해 원자적으로 교체한다.

## 템플릿 계약

템플릿은 일반 Markdown이며 다음 frontmatter를 반드시 갖는다.

```yaml
---
title: 주간 회고
kind: weekly-review
defaultPath: reviews/weekly
publicEligible: false
---
```

허용 `kind`: `capture`, `private-post`, `public-draft`, `weekly-review`, `monthly-review`. 앱은 frontmatter와 본문을 복제할 뿐 템플릿 안의 코드를 실행하지 않는다.

## 불렛과 이월 계약

일일 로그의 빠른 기록은 Git diff 친화적인 Markdown 목록이다.

```md
- [ ] □ 발행 후보 정리 <!-- wb:id=01JABC -->
- • 재현 조건 메모 <!-- wb:id=01JABD -->
```

`•` 메모, `–` 노트, `○` 일정, `□` 할 일을 지원한다. 날짜 전환은 미완료 행을 절대 복제하지 않는다. 이월은 사용자가 `quick` 또는 `intentional` 모드로 실행하는 변경이며, 대상 문서에는 `<!-- wb:migrated-from=01JABC -->`, 원본에는 이월 이력을 남긴다. intentional 모드는 설정된 확인 문구 없이는 실패한다.

## 회고 계약

주간·월간 회고는 템플릿으로 만드는 일반 문서다. 앱을 연 현재 시점에 완료된 기간의 회고가 없을 경우에만 한 번 제안한다. 제안은 파일을 만들지 않으며 `작성하기`, `나중에`, `건너뛰기`를 제공한다. 과거 기간은 항상 수동 생성할 수 있다.

## 공개 발행 계약

`publicEligible: true`인 draft만 변환 후보가 된다. 변환은 아래 검증을 모두 통과해야 한다.

1. public blog의 post schema에 맞는 title, slug, category, tags, publishedAt을 가진다.
2. `file://`, `workspace/`, private root, `assets/private/`와 private-only 링크를 포함하지 않는다.
3. public 저장소 worktree가 깨끗하다.
4. 생성된 `.mdoc`, allowlist 자산 복사 목록, unified diff를 dry-run으로 보여 준다.
5. `confirmPublish: true`가 있어야 브랜치·커밋을 만든다. push와 deploy는 하지 않는다.

실패는 원본 Markdown과 public worktree를 변경하지 않고, 파일·필드·재시도 방법을 반환한다.

## 검증

- Template parser와 path guard, atomic write, bullet parser/migration, review suggestion, publish validator/transform은 Vitest로 TDD한다.
- publish 테스트는 temporary Git repo로 dirty worktree, private leak 거부, dry-run 무변경, 확정 커밋을 검증한다.
- Playwright는 키보드 capture, 두 이월 방식, 회고 제안·수동 생성, 발행 검토를 확인한다.
- `pnpm test`, `pnpm lint`, `pnpm format:check`, `pnpm build`, `pnpm e2e`가 M1 완료 기준이다.

### 검토 보강 계약

- 문서 API와 `FileStore`는 `inbox`, `journal`, `notes`, `drafts`, `reviews` 아래의 일반 `.md` 파일만 읽고 쓴다. dot directory, `templates`, `assets`, 그 밖의 파일은 문서 ID를 위조해도 접근할 수 없다.
- 문서 ID는 서버가 발급한 불투명 식별자이며, 경로를 단순 인코딩한 값을 클라이언트가 새로 만들 수 없다.
- 서버 루트는 시작 시 존재하는 실제 디렉터리로 canonicalize하며, 직접 또는 symlink를 통한 동일·중첩 루트를 거부한다.
- 편집 저장은 파싱된 문서를 정규 직렬화해 파일과 응답에 동일하게 반영하고 미해석 frontmatter를 보존한다.
- 회고 생성은 kind에 맞는 `YYYY-Www` 또는 `YYYY-MM` 기간을 요구하며 잘못된 사용자 입력은 HTTP 400으로 응답한다.
- 문서 목록은 지원 문서 디렉터리만 탐색한다. 루트 README나 `.git` 등 관계없는 파일은 탐색·파싱하지 않는다.
- 새 하위 디렉터리를 만든 뒤 가능한 플랫폼에서는 생성된 디렉터리와 기존 부모를 fsync한 후 파일을 원자 저장한다.

## 제외

다중 사용자 협업·CRDT, AI 자동 분류·요약·발행, 자동 이월, 모바일 네이티브 앱, 시간 추적/생산성 점수, Funnel과 공용 인터넷 공개는 M1에 넣지 않는다.
