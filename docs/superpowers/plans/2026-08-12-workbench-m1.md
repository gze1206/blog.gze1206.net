# Private Workbench M1 실행 계획

## 모델 역할

- 설계·명세 검토: Claude `claude-opus-4-8` (architecture profile)
- 구현·TDD·통합: Codex `gpt-5.6-terra`/`gpt-5.6-sol`
- 독립 구현 리뷰: Claude 요구사항 관점 + Codex 테스트·회귀 관점

## 의존성 순서

1. **NOR-143**: Vite + React + Hono 스캐폴드, strict 도구 체인, 분리된 workspace Git 경계, path guard, frontmatter parser, 원자 저장, 기본 템플릿, 문서 API/UI.
2. **NOR-144**: 일일 로그 grammar, keyboard-first capture, 상태 변경, 간편/의식적 이월과 원본 이력.
3. **NOR-145**: 주·월 period 계산, 비파괴 제안 상태, 회고 템플릿 생성과 링크.
4. **NOR-146**: public draft validator, Markdoc transform, dry-run diff, 명시적 브랜치 커밋.
5. **NOR-147**: Docker/systemd 운영물, health endpoint, Tailscale Serve/ACL·백업·복구 문서. 실제 개인 서버 적용과 Serve 설정은 마지막 외부 검증 단계다.

## NOR-143 TDD 순서

1. `parseTemplate()`가 유효 frontmatter를 읽고 허용하지 않은 kind를 거부하는 실패 테스트 작성.
2. `resolveWorkspacePath()`가 traversal·absolute path·symlink escape를 거부하는 실패 테스트 작성.
3. same-directory temporary file + `rename`을 쓰는 `writeDocumentAtomically()` 실패 테스트 작성.
4. 위 도메인 모듈을 구현하고 green 확인.
5. `listTemplates`, `createFromTemplate`, `readDocument`, `writeDocument` server API와 최소 UI를 추가.
6. unit/API tests, lint, format, build를 통과시키고 커밋·독립 리뷰.

## 완료 후 검토

각 NOR slice마다 Codex 구현자가 테스트 결과·변경·위험을 기록한다. Claude는 명세·보안 경계, Codex는 구현·회귀를 독립 리뷰한다. 중요 지적은 구현자가 수정하고 scoped re-review를 통과해야 다음 slice로 진행한다.
