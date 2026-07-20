# 커밋 규약

**gitmoji + Conventional Commits + Linear ID** 를 결합해 사용합니다. 작성 언어는 **한국어**.

## 형식

```
<gitmoji> <type>(<scope>): <요약> (NOR-N)

<본문 - 선택>

<푸터 - 선택>
```

- **gitmoji**: 변경 성격을 나타내는 이모지 1개 (아래 표).
- **type**: 변경 종류 (`feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`).
- **scope**: 영향 범위 (아래 표). 애매하면 생략 가능.
- **요약**: 명령형·현재형, 마침표 없이, 50자 내외 권장.
- **(NOR-N)**: 관련 Linear 일감 ID. 여러 개면 `(NOR-16, NOR-17)`. 일감이 없으면 생략.

### Breaking change

호환성이 깨지는 변경은 `type`/`scope` 뒤에 `!` 를 붙이고, 본문 아래에 `BREAKING CHANGE:` 푸터로 이유를 남깁니다.

```
💥 feat(content)!: posts 스키마에서 tags를 필수로 변경 (NOR-9)

BREAKING CHANGE: 기존 tags 없는 글은 빌드 실패. 마이그레이션 필요.
```

## type ↔ gitmoji 매핑

| type       | gitmoji                                 | 용도                           |
| ---------- | --------------------------------------- | ------------------------------ |
| `feat`     | ✨ `:sparkles:`                         | 새 기능                        |
| `fix`      | 🐛 `:bug:`                              | 버그 수정                      |
| `docs`     | 📝 `:memo:`                             | 문서                           |
| `style`    | 🎨 `:art:`                              | 포맷·구조(동작 변화 없음)      |
| `refactor` | ♻️ `:recycle:`                          | 리팩터링                       |
| `perf`     | ⚡️ `:zap:`                              | 성능 개선                      |
| `test`     | ✅ `:white_check_mark:`                 | 테스트 추가/수정               |
| `build`    | 📦 `:package:` / ➕ `:heavy_plus_sign:` | 빌드·의존성                    |
| `ci`       | 👷 `:construction_worker:`              | CI/배포 설정                   |
| `chore`    | 🔧 `:wrench:`                           | 잡무·설정                      |
| (breaking) | 💥 `:boom:`                             | 호환성 파괴 변경               |
| (wip)      | 🚧 `:construction:`                     | 작업 중(로컬 한정, PR 전 정리) |

> 기능 성격이 더 구체적이면 gitmoji를 바꿔도 됩니다(예: 🔒 보안, 🔥 제거, 🚑 핫픽스). 단 **type은 표준 10종 안에서** 유지합니다.

## scope 예시

`infra` · `blog` · `content` · `render` · `cms` · `ui` · `theme` · `seo` · `a11y` · `search` · `comments` · `analytics` · `docs` · `deps`

## 예시

```
✨ feat(blog): 목록 페이지네이션 + draft 제외 로직 추가 (NOR-16)
🐛 fix(render): 다크모드에서 CIL 코드블럭 대비 부족 수정 (NOR-11)
📝 docs: 작업 로드맵 처리 순서 문서화
♻️ refactor(content): Markdoc 커스텀 태그 등록부를 모듈 분리 (NOR-10)
🔧 chore(deps): astro 5.x 업그레이드
```

## 원칙

- **의미 단위로 작게.** 한 커밋 = 한 논리적 변경. 무관한 변경 섞지 않기.
- 커밋은 **사용자가 요청할 때만** 생성합니다.
- AI 에이전트가 만든 커밋은 푸터에 **공동 작성자**를 표기합니다. 형식:

  ```
  Co-Authored-By: <에이전트 이름> <이메일>
  ```

  - 예: `Co-Authored-By: Claude <noreply@anthropic.com>`
  - 사용하는 에이전트/모델에 맞춰 이름·이메일을 바꿔 씁니다(특정 모델 버전에 고정하지 않음).

## 관련 문서

- 브랜치·PR 단위: [branch-pr.md](./branch-pr.md)
