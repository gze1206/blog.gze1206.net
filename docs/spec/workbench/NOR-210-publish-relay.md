# NOR-210 — 발행을 PR 로 자동 전달하고 CI 통과 시 자동 병합

- 결정: 사용자(2026-11-15). 호스트의 별도 서비스가 PR 을 만들고, CI 가 통과하면 자동 병합한다.
- 이어받는 것: [tailnet-workbench.md](../../operations/workbench/tailnet-workbench.md) "확정한 커밋을 공개 블로그로 보내기"(지금까지 사람이 손으로 했다)

## 신뢰 경계

워크벤치 컨테이너는 공개 저장소 자격을 갖지 않는다(ADR 0016). 확정한 발행은 outbox 에 산출물(bundle 또는
format-patch, 매니페스트 JSON)로 남는다. **릴레이**는 컨테이너와 다른 호스트 계정(`workbench-relay`)으로 돌며
그 산출물을 읽기만 하고, 검사를 통과한 것만 deploy key 로 `content/*` 브랜치에 push 한다.

`content/**` push 에서 도는 GitHub 워크플로는 그 브랜치의 워크플로 파일로 실행된다. 그래서 브랜치에 무엇이
들어갈 수 있는지는 GitHub 쪽이 아니라 **릴레이가 정한다**. 릴레이는 콘텐츠 경로만 바꾼 커밋만 내보낸다.
main 은 ruleset(필수 체크, 강제 push·삭제 금지)이 지키므로 deploy key 로도 직접 쓸 수 없다.

## 수용 기준

### 릴레이 (`apps/workbench/deploy/oci/publish-relay.sh`)

- **AC-1** outbox 의 매니페스트마다 산출물을 받아 `content/<산출물 이름>` 브랜치로 push 한다. bundle 은 매니페스트의 커밋과 같아야 하고, format-patch 는 base 위에 적용한다.
- **AC-2** 매니페스트의 base 가 `origin/main` 의 조상이 아니면 push 하지 않고 `stale` 로 기록한다.
- **AC-3** base 에서 바뀐 경로가 하나라도 허용 목록(`content-paths.regex`) 밖이거나, 심볼릭 링크·서브모듈이면 push 하지 않고 `rejected` 로 기록한다.
- **AC-4** 처리한 매니페스트는 기록(ledger)에 남기고 다시 처리하지 않는다. outbox 는 고치지 않는다.
- **AC-5** 동시에 두 번 돌지 않는다(잠금).

### GitHub

- **AC-6** (manual) `content/**` push 에서 CI 의 필수 체크(verify, e2e, spec-check, tdd-evidence)가 돈다.
- **AC-8** 발행 확정 버튼은 "발행" 이고, 결과는 손으로 칠 git 명령 대신 자동 전달(릴레이가 PR 을 만들고 CI 통과 시 자동 병합)을 알린다. 책 내보내기 결과도 같은 안내를 보여 준다.
- **AC-7** (manual) `content/**` push 에서 main 으로 가는 PR 을 만든다. 바뀐 경로가 모두 허용 목록(main 의 것) 안이면 자동 병합(merge commit)을 켠다. 병합하면 브랜치를 지운다.
