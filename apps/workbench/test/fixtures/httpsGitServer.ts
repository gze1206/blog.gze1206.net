import { execFile, spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:https';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

export interface HttpsGitServer {
  readonly remote: string;
  readonly certificateAuthority: string;
  close(): Promise<void>;
}

export async function startHttpsGitServer(sourceRepository: string): Promise<HttpsGitServer> {
  const root = await mkdtemp(path.join(tmpdir(), 'https-git-server-'));
  const repositoryName = 'public-blog.git';
  const repository = path.join(root, repositoryName);
  const certificateAuthority = path.join(root, 'certificate.pem');
  const key = path.join(root, 'key.pem');
  await run('git', ['clone', '--bare', sourceRepository, repository], { encoding: 'utf8' });
  await run(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-keyout',
      key,
      '-out',
      certificateAuthority,
      '-days',
      '1',
      '-subj',
      '/CN=127.0.0.1',
      '-addext',
      'subjectAltName=IP:127.0.0.1',
    ],
    { encoding: 'utf8' },
  );
  const server = createServer(
    { key: await readFile(key), cert: await readFile(certificateAuthority) },
    (request, response) => {
      const child = spawn('git', ['http-backend'], {
        env: {
          PATH: process.env.PATH,
          GIT_PROJECT_ROOT: root,
          GIT_HTTP_EXPORT_ALL: '1',
          REQUEST_METHOD: request.method ?? 'GET',
          PATH_INFO: new URL(request.url ?? '/', 'https://127.0.0.1').pathname,
          QUERY_STRING: new URL(request.url ?? '/', 'https://127.0.0.1').search.slice(1),
          CONTENT_TYPE: request.headers['content-type'] ?? '',
          CONTENT_LENGTH: request.headers['content-length'] ?? '',
        },
      });
      const chunks: Buffer[] = [];
      child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
      child.on('error', () => response.destroy());
      child.on('close', () => {
        const payload = Buffer.concat(chunks);
        const marker = payload.indexOf('\r\n\r\n');
        const separatorLength = marker >= 0 ? 4 : 2;
        const boundary = marker >= 0 ? marker : payload.indexOf('\n\n');
        if (boundary < 0) {
          response.writeHead(500);
          response.end();
          return;
        }
        const header = payload.subarray(0, boundary).toString('utf8');
        const headers: Record<string, string> = {};
        let status = 200;
        for (const line of header.split(/\r?\n/u)) {
          const separator = line.indexOf(':');
          if (separator < 0) continue;
          const name = line.slice(0, separator).trim();
          const value = line.slice(separator + 1).trim();
          if (name.toLowerCase() === 'status') status = Number(value.slice(0, 3));
          else headers[name] = value;
        }
        response.writeHead(status, headers);
        response.end(payload.subarray(boundary + separatorLength));
      });
      request.pipe(child.stdin);
    },
  );
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('HTTPS fixture did not bind a TCP port');
  return {
    remote: `https://127.0.0.1:${address.port}/${repositoryName}`,
    certificateAuthority,
    async close() {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      await rm(root, { recursive: true, force: true });
    },
  };
}
