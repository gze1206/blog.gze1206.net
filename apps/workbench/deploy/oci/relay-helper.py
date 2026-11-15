#!/usr/bin/env python3
"""발행 릴레이의 검사 도우미 (NOR-210). 셸 대신 여기서 JSON 과 git diff 출력을 엄격하게 읽는다.

  relay-helper.py copy <원본> <사본> <최대 바이트>  심볼릭 링크를 따라가지 않고 한 번 열어 일반 파일만 복사한다.
  relay-helper.py manifest <파일>   매니페스트를 검증하고 base, format, ref, commit, branch 를 한 줄씩 쓴다.
  relay-helper.py check <정규식 파일>  stdin 의 `git diff --raw -z --no-renames` 를 검사한다.

실패하면 **고정된 사유 코드**(소문자와 하이픈)만 stdout 에 쓰고 1 로 끝난다. ledger 에 그대로 들어가므로
입력에서 온 글자를 섞지 않는다. 자세한 내용은 stderr(journal)에 repr 로 쓴다.
"""
import json
import os
import re
import stat
import sys

SHA = re.compile(r"[0-9a-f]{40}")
REF = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]*\.(bundle|patch)")


def fail(reason: str, detail: object = None) -> None:
    print(reason)
    if detail is not None:
        print(f"relay-helper: {reason}: {detail!r}", file=sys.stderr)
    sys.exit(1)


def copy(source: str, target: str, limit: str) -> None:
    """검사와 읽기 사이에 파일을 바꿔치기하지 못하게, 한 번 연 파일 디스크립터에서만 읽는다."""
    try:
        fd = os.open(source, os.O_RDONLY | os.O_NOFOLLOW | getattr(os, "O_NONBLOCK", 0))
    except OSError:
        fail("not-regular")
    with os.fdopen(fd, "rb") as handle:
        info = os.fstat(handle.fileno())
        if not stat.S_ISREG(info.st_mode):
            fail("not-regular")
        if info.st_size > int(limit):
            fail("too-large")
        data = handle.read(int(limit) + 1)
    if len(data) > int(limit):
        fail("too-large")
    with open(target, "wb") as out:
        out.write(data)


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
    # 브랜치 이름은 쓰지 않는다. bundle 은 커밋으로 가져온다(NOR-214). 개행만 막는다.
    if "\n" in values["branch"] or "\0" in values["branch"]:
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
            fail("mode", (new_mode, path))
        if not any(pattern.fullmatch(path) for pattern in patterns):
            fail("path", path)
        changed += 1
    if changed == 0:
        fail("empty")


if __name__ == "__main__":
    if len(sys.argv) == 5 and sys.argv[1] == "copy":
        copy(sys.argv[2], sys.argv[3], sys.argv[4])
    elif len(sys.argv) == 3 and sys.argv[1] in ("manifest", "check"):
        (manifest if sys.argv[1] == "manifest" else check)(sys.argv[2])
    else:
        fail("usage")
