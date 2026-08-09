import { makeGenericAPIRouteHandler } from '@keystatic/core/api/generic';
import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import config from '../../../../keystatic.config';

export const prerender = false;

export const ALL: APIRoute = async ({ request }) => {
  const handler = makeGenericAPIRouteHandler(
    {
      config,
      clientId: env.KEYSTATIC_GITHUB_CLIENT_ID,
      clientSecret: env.KEYSTATIC_GITHUB_CLIENT_SECRET,
      secret: env.KEYSTATIC_SECRET,
    },
    { slugEnvName: 'PUBLIC_KEYSTATIC_GITHUB_APP_SLUG' },
  );
  const { body, headers, status } = await handler(request);
  return new Response(body, { headers, status });
};
