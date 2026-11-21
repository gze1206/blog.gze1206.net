/**
 * 무거운 모듈을 처음 필요할 때 한 번만 불러온다 (NOR-231).
 *
 * 동시에 여러 번 불러도 같은 약속을 돌려줘 두 번 받지 않는다. 실패한 약속은 기억하지 않는다.
 * 기억하면 잠깐 끊긴 네트워크 때문에 그 페이지에서는 영영 다시 시도하지 못한다.
 */
export function lazyOnce<T>(load: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | null = null;
  return () => {
    pending ??= load().catch((error: unknown) => {
      pending = null;
      throw error;
    });
    return pending;
  };
}
