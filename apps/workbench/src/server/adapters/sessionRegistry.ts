import { randomBytes } from 'node:crypto';

export interface PublishSession {
  readonly reviewId: string;
  readonly cloneDir: string;
  readonly baseSha: string;
  readonly fingerprint: string;
  readonly createdAt: Date;
  readonly leaseExpiry: Date;
}

export interface PublishSessionRegistryOptions {
  readonly leaseMs?: number;
  readonly now?: () => Date;
  readonly removeClone: (cloneDir: string) => Promise<void>;
}

export class PublishSessionRegistry {
  private readonly sessions = new Map<string, PublishSession>();
  private readonly leaseMs: number;
  private readonly now: () => Date;

  public constructor(private readonly options: PublishSessionRegistryOptions) {
    this.leaseMs = options.leaseMs ?? 10 * 60 * 1000;
    this.now = options.now ?? (() => new Date());
  }

  public register(
    input: Omit<PublishSession, 'reviewId' | 'createdAt' | 'leaseExpiry'>,
  ): PublishSession {
    const createdAt = this.now();
    const session: PublishSession = {
      ...input,
      reviewId: randomBytes(32).toString('base64url'),
      createdAt,
      leaseExpiry: new Date(createdAt.getTime() + this.leaseMs),
    };
    this.sessions.set(session.reviewId, session);
    return session;
  }

  public async get(
    reviewId: string,
    fingerprint: string,
    baseSha: string,
  ): Promise<PublishSession> {
    await this.sweepExpired();
    const session = this.sessions.get(reviewId);
    if (!session || session.fingerprint !== fingerprint || session.baseSha !== baseSha) {
      throw new Error('publish review is stale');
    }
    return session;
  }

  public async lookup(reviewId: string): Promise<PublishSession> {
    await this.sweepExpired();
    const session = this.sessions.get(reviewId);
    if (!session) throw new Error('publish review is stale');
    return session;
  }

  public async consume(reviewId: string, fingerprint: string, baseSha: string): Promise<void> {
    const session = await this.get(reviewId, fingerprint, baseSha);
    this.sessions.delete(session.reviewId);
    await this.options.removeClone(session.cloneDir);
  }

  public async discard(reviewId: string): Promise<void> {
    const session = this.sessions.get(reviewId);
    if (!session) return;
    this.sessions.delete(reviewId);
    await this.options.removeClone(session.cloneDir);
  }

  public async sweepExpired(): Promise<void> {
    const now = this.now().getTime();
    const expired = [...this.sessions.values()].filter(
      (session) => session.leaseExpiry.getTime() <= now,
    );
    await Promise.all(
      expired.map(async (session) => {
        this.sessions.delete(session.reviewId);
        await this.options.removeClone(session.cloneDir);
      }),
    );
  }
}
