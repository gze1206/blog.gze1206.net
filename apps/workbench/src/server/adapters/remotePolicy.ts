export interface RemoteCloneConfig {
  readonly effectiveUrl: string;
  readonly gitConfigArgs: readonly string[];
  readonly extraEnv?: Readonly<Record<string, string>>;
}

export interface RemotePolicy {
  assertAllowed(remoteUrl: string): void;
  cloneConfig(remoteUrl: string): RemoteCloneConfig;
}

export interface ProductionRemotePolicyOptions {
  readonly allowedHost: string;
  readonly expectedPath: string;
}

export class ProductionRemotePolicy implements RemotePolicy {
  public constructor(private readonly options: ProductionRemotePolicyOptions) {}

  public assertAllowed(remoteUrl: string): void {
    let parsed: URL;
    try {
      parsed = new URL(remoteUrl);
    } catch {
      throw new Error('public blog remote is not allowed');
    }
    if (
      parsed.protocol !== 'https:' ||
      parsed.hostname.toLowerCase() !== this.options.allowedHost.toLowerCase() ||
      (parsed.port !== '' && parsed.port !== '443') ||
      parsed.username !== '' ||
      parsed.password !== '' ||
      parsed.search !== '' ||
      parsed.hash !== '' ||
      parsed.pathname !== this.options.expectedPath
    ) {
      throw new Error('public blog remote is not allowed');
    }
  }

  public cloneConfig(remoteUrl: string): RemoteCloneConfig {
    this.assertAllowed(remoteUrl);
    return {
      effectiveUrl: remoteUrl,
      gitConfigArgs: [
        'protocol.allow=never',
        'protocol.https.allow=always',
        'http.followRedirects=false',
      ],
    };
  }
}
