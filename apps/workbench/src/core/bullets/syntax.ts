export type BulletType = 'memo' | 'note' | 'event' | 'task';
export type BulletStatus = 'open' | 'completed' | 'cancelled';
export type BulletAction = 'complete' | 'cancel' | 'reopen';

export interface Bullet {
  readonly id: string;
  readonly type: BulletType;
  readonly status: BulletStatus;
  readonly text: string;
  readonly migratedFrom?: string;
  readonly migratedTo?: { readonly id: string; readonly at: string };
}

const typeOrder: readonly BulletType[] = ['task', 'memo', 'note', 'event'];
const crockford = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function transitionBullet(bullet: Bullet, action: BulletAction): Bullet {
  if (bullet.type !== 'task') throw new Error('only tasks have completion state');
  const status: BulletStatus =
    action === 'complete' ? 'completed' : action === 'cancel' ? 'cancelled' : 'open';
  return { ...bullet, status };
}

export function cycleBulletType(bullet: Bullet): Bullet {
  const index = typeOrder.indexOf(bullet.type);
  return { ...bullet, type: typeOrder[(index + 1) % typeOrder.length] ?? 'memo', status: 'open' };
}

export function createBulletId(
  timestamp: number = Date.now(),
  random: () => number = Math.random,
): string {
  if (!Number.isSafeInteger(timestamp) || timestamp < 0 || timestamp > 281_474_976_710_655) {
    throw new Error('invalid ULID timestamp');
  }
  let time = timestamp;
  let encodedTime = '';
  for (let index = 0; index < 10; index += 1) {
    encodedTime = crockford[time % 32] + encodedTime;
    time = Math.floor(time / 32);
  }
  let encodedRandom = '';
  for (let index = 0; index < 16; index += 1) {
    encodedRandom += crockford[Math.floor(random() * 32)] ?? '0';
  }
  return `${encodedTime}${encodedRandom}`;
}

export function assertBulletId(value: string): void {
  if (!/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/u.test(value)) throw new Error('invalid bullet ULID');
}

export function assertBulletText(value: string): void {
  if (!value.trim() || /[\r\n]/u.test(value) || /<!--\s*wb:/iu.test(value)) {
    throw new Error('bullet text must be one line without workbench metadata');
  }
}
