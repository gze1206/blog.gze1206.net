# NOR-213 — 발행 검토 diff 를 실제 줄 diff 로, 책 JSON 을 Prettier 형식으로

- 출처: 사용자 보고(2026-11-15). 책장 내보내기 검토의 diff 가 파일 전체를 지우고 다시 쓰는 모양이라 의미가 없다.

## 원인

- 검토 diff 가 비교를 하지 않는다. 기존 줄을 전부 `-`, 새 줄을 전부 `+` 로 찍는다. 글 발행 검토도 같다.
- 책 JSON 을 `JSON.stringify(…, 2)` 로 써서 블로그 저장소의 Prettier 형식(짧은 배열은 한 줄)과 다르다. 같은 값도 바뀐
  줄이 되고, 블로그 CI 의 `format:check` 가 이 형식을 거부해 자동 병합(NOR-210)이 멈출 수 있다.

## 수용 기준

- **AC-1** `unifiedDiff(path, before, after)` 는 바뀐 줄만 `-`·`+` 로, 그 앞뒤 3줄을 문맥으로 보여 주는 표준 unified diff 다. 새 파일은 `/dev/null` 에서 시작한다.
- **AC-2** 책 JSON 직렬화 결과는 저장소 Prettier 설정(`printWidth: 100`)으로 다시 포맷해도 그대로다.
- **AC-3** 값이 같은 책 JSON 을 다시 쓰면 바뀐 줄이 없다(기존 Prettier 형식 파일과 같은 글자다).
