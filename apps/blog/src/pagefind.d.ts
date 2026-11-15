// Pagefind 는 빌드 뒤 /pagefind 아래 생기는 모듈이다.
// 실제 모양은 SearchPalette.tsx 의 PagefindModule 로 좁혀 쓴다.
declare const pagefind: { search(query: string): Promise<unknown> };
export = pagefind;
