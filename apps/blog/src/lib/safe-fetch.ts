/**
 * 빌드 중 외부 URL 조회의 SSRF 차단 (NOR-211).
 *
 * 글은 워크벤치에서 자동 병합되므로(NOR-210), 작성자가 적은 URL 을 CI 러너와 Pages 빌드가 요청한다.
 * 연결하는 순간의 DNS 해석 결과를 검사하고(미리 확인한 뒤 다른 주소로 연결하는 DNS 리바인딩을 막는다),
 * 리디렉션은 직접 따라가며 매번 같은 검사를 한다.
 */
import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import { BlockList, isIP } from 'node:net';
import { Agent } from 'undici';

const blocked = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const)
  blocked.addSubnet(network, prefix, 'ipv4');
for (const [network, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
  ['2001:db8::', 32],
  ['64:ff9b::', 96],
] as const)
  blocked.addSubnet(network, prefix, 'ipv6');

/** 루프백·사설·링크 로컬·CGNAT·예약·멀티캐스트가 아니면 참. IPv4 매핑 IPv6 는 IPv4 로 본다. */
export function isPublicAddress(ip: string): boolean {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/iu.exec(ip)?.[1];
  const address = mapped ?? ip;
  const family = isIP(address);
  if (family === 0) return false;
  return !blocked.check(address, family === 4 ? 'ipv4' : 'ipv6');
}

type LookupCallback = (
  error: NodeJS.ErrnoException | null,
  address: string | LookupAddress[],
  family?: number,
) => void;

/** 해석 결과 중 하나라도 공개 주소가 아니면 연결하지 않는다. */
function guardedLookup(
  hostname: string,
  options: { all?: boolean },
  callback: LookupCallback,
): void {
  dnsLookup(hostname, { all: true }, (error, addresses) => {
    if (error) return callback(error, []);
    if (addresses.length === 0 || addresses.some((entry) => !isPublicAddress(entry.address))) {
      const denied: NodeJS.ErrnoException = new Error(`내부 주소로 해석되는 호스트: ${hostname}`);
      denied.code = 'EADDRNOTPUBLIC';
      return callback(denied, []);
    }
    if (options.all) return callback(null, addresses);
    const first = addresses[0] as LookupAddress;
    return callback(null, first.address, first.family);
  });
}

const agent = new Agent({ connect: { lookup: guardedLookup as never } });

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

// 전역 fetch(Node 내장 undici)에 연결 시점 검사가 걸린 dispatcher 를 넘긴다.
const defaultFetch: FetchLike = (url, init) =>
  fetch(url, { ...init, dispatcher: agent } as RequestInit);

function assertAllowedUrl(raw: string): URL {
  const url = new URL(raw);
  if (url.protocol !== 'http:' && url.protocol !== 'https:')
    throw new Error(`허용하지 않는 스킴: ${url.protocol}`);
  if (url.username !== '' || url.password !== '') throw new Error('사용자 정보가 든 URL');
  const host = url.hostname.replace(/^\[|\]$/gu, '');
  if (isIP(host) !== 0 && !isPublicAddress(host)) throw new Error(`내부 주소: ${host}`);
  return url;
}

/**
 * 안전한 GET. 리디렉션은 최대 `maxRedirects` 번 직접 따라가며 매번 검사한다.
 * 돌려주는 `url` 은 마지막 응답의 주소다.
 */
export async function safeFetch(
  url: string,
  init: RequestInit = {},
  options: { fetchImpl?: FetchLike; maxRedirects?: number } = {},
): Promise<{ response: Response; url: string }> {
  const fetchImpl = options.fetchImpl ?? defaultFetch;
  const maxRedirects = options.maxRedirects ?? 3;
  let current = assertAllowedUrl(url);
  for (let hop = 0; ; hop += 1) {
    const response = await fetchImpl(current.href, { ...init, redirect: 'manual' });
    const location = response.headers.get('location');
    if (response.status < 300 || response.status >= 400 || location === null)
      return { response, url: current.href };
    await response.body?.cancel().catch(() => undefined);
    if (hop >= maxRedirects) throw new Error('리디렉션이 너무 많다');
    current = assertAllowedUrl(new URL(location, current).href);
  }
}
