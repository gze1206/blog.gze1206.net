# personal-workbench

Tailnet 안에서만 사용하는 개인 불렛 노트·글쓰기·안전한 블로그 발행 워크벤치다.

## 원칙

- 개인 기록의 원본은 private Git 저장소의 Markdown 파일이다.
- 공개 블로그와 private 기록은 다른 저장소다.
- 자동 이월·자동 발행은 하지 않는다.
- `tailscale serve`를 통해서만 노출하며, 앱 서버는 localhost에만 바인딩한다.

설계와 실행 순서는 [M1 명세](../../docs/spec/workbench/NOR-143-workbench-foundation.md)와
[구현 계획](../../docs/superpowers/plans/2026-08-12-workbench-m1.md)을 따른다.

## 필수 서버 설정

`WORKSPACE_ROOT`, `PUBLIC_BLOG_ROOT`와 함께 IANA 시간대인 `APP_TIME_ZONE`을 명시한다.
앱의 오늘 날짜, 회고 기간과 생성 문서 날짜는 이 시간대를 단일 기준으로 사용한다.
개인 운영 환경의 예시는 `Asia/Seoul`이며 [`.env.example`](./.env.example)을 참고한다.

Docker, 전용 서비스 계정, 저장소 권한, 백업·복구와 Tailnet-only Serve 절차는
[운영 가이드](../../docs/operations/workbench/tailnet-workbench.md)를 따른다. 실제 Serve/ACL 변경과 개인
서버 배포는 별도 최종 승인 전까지 수행하지 않는다.
Tailnet-only personal bullet journal and publishing workbench
