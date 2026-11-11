/** `/smoke`와 그 하위 검증 페이지만 사이트맵에서 제외한다 (NOR-30). */
export function isSitemapPage(page: string): boolean {
  const { pathname } = new URL(page);
  return pathname !== '/smoke' && !pathname.startsWith('/smoke/');
}
