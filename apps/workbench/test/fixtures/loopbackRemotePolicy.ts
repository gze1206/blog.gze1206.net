import { URL } from 'node:url';

import type { RemoteCloneConfig, RemotePolicy } from '../../src/server/adapters/remotePolicy.js';

export class LoopbackTestRemotePolicy implements RemotePolicy {
  public constructor(private readonly certificateAuthority: string) {}

  public assertAllowed(remoteUrl: string): void {
    const parsed = new URL(remoteUrl);
    if (
      parsed.protocol !== 'https:' ||
      parsed.hostname !== '127.0.0.1' ||
      parsed.port === '' ||
      parsed.username !== '' ||
      parsed.password !== '' ||
      parsed.search !== '' ||
      parsed.hash !== ''
    ) {
      throw new Error('test remote is not allowed');
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
        `http.sslCAInfo=${this.certificateAuthority}`,
      ],
    };
  }
}
