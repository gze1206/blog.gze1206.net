#!/usr/bin/env python3
"""발행 릴레이의 검사 도우미 (NOR-210). 셸 대신 여기서 JSON 과 git diff 출력을 엄격하게 읽는다.

  relay-helper.py manifest <파일>   매니페스트를 검증하고 base, format, ref, commit, branch 를 한 줄씩 쓴다.
  relay-helper.py check <정규식 파일>  stdin 의 `git diff --raw -z --no-renames` 를 검사한다.

실패하면 이유를 한 단어로 stdout 에 쓰고 1 로 끝난다.
"""
import json
import re
import sys

SHA = re.compile(r"[0-9a-f]{40}")
REF = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]*\.(bundle|patch)")
BRANCH = re.compile(r"content/[A-Za-z0-9][A-Za-z0-9._-]*")


def fail(reason: str) -> None:
    print(reason)
    sys.exit(1)


def manifest(path: str) -> None:
    try:
        with open(path, "rb") as handle:
            raw = handle.read(65537)
    except OSError:
        fail("unreadable")
    if len(raw) > 65536:
        fail("too-large")
    try:
        data = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, ValueError):
        fail("bad-json")
    if not isinstance(data, dict):
        fail("bad-json")
    values = {key: data.get(key) for key in ("baseSha", "exportFormat", "exportRef", "commit", "branch")}
    if not all(isinstance(value, str) for value in values.values()):
        fail("bad-manifest")
    if not SHA.fullmatch(values["baseSha"]) or not SHA.fullmatch(values["commit"]):
        fail("bad-manifest")
    if values["exportFormat"] not in ("bundle", "format-patch") or not REF.fullmatch(values["exportRef"]):
        fail("bad-manifest")
    if not BRANCH.fullmatch(values["branch"]):
        fail("bad-manifest")
    for key in ("baseSha", "exportFormat", "exportRef", "commit", "branch"):
        print(values[key])


def check(regex_file: str) -> None:
    with open(regex_file, encoding="utf-8") as handle:
        patterns = [re.compile(line.strip()) for line in handle if line.strip()]
    tokens = sys.stdin.buffer.read().split(b"\0")
    if tokens and tokens[-1] == b"":
        tokens.pop()
    if len(tokens) % 2 != 0:
        fail("bad-diff")
    changed = 0
    for meta, raw_path in zip(tokens[0::2], tokens[1::2]):
        parts = meta.decode("ascii", "replace").lstrip(":").split()
        if len(parts) != 5:
            fail("bad-diff")
        new_mode, status = parts[1], parts[4]
        try:
            path = raw_path.decode("utf-8")
        except UnicodeDecodeError:
            fail("bad-path")
        if status != "D" and new_mode != "100644":
            fail(f"mode:{new_mode}:{path}")
        if not any(pattern.fullmatch(path) for pattern in patterns):
            fail(f"path:{path}")
        changed += 1
    if changed == 0:
        fail("empty")


if __name__ == "__main__":
    if len(sys.argv) != 3 or sys.argv[1] not in ("manifest", "check"):
        fail("usage")
    (manifest if sys.argv[1] == "manifest" else check)(sys.argv[2])
