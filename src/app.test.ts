import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';

const landingDocument = await readFile(
  new URL('../index.html', import.meta.url),
  'utf8',
);

describe('public landing page', () => {
  it('L1 serves the same public document without authentication', async () => {
    const app = createApp(landingDocument);
    const anonymous = await app.request('/');
    const withIdentity = await app.request('/', {
      headers: { 'Cf-Access-Jwt-Assertion': 'unverified-test-value' },
    });

    expect(anonymous.status).toBe(200);
    expect(await anonymous.text()).toBe(await withIdentity.text());
    expect(anonymous.headers.get('content-type')).toContain('text/html');
  });

  it('L2 has no link or mention of the protected path', async () => {
    const response = await createApp(landingDocument).request('/');
    const document = await response.text();

    expect(document).not.toContain('/purge');
  });

  it('L3 declares a responsive viewport for mobile and desktop browsers', async () => {
    const response = await createApp(landingDocument).request('/');
    const document = await response.text();

    expect(document).toMatch(
      /<meta\s+name="viewport"\s+content="width=device-width,\s*initial-scale=1(?:\.0)?"\s*\/?>/i,
    );
  });

  it('L1 keeps the public document independent from unknown routes and cache policy', async () => {
    const app = createApp(landingDocument);
    const before = await app.request('/');
    const unknownRoute = await app.request('/not-found');
    const protectedRoute = await app.request('/purge/anything');
    const after = await app.request('/');

    expect(unknownRoute.status).toBe(404);
    expect(protectedRoute.status).toBe(401);
    expect(await before.text()).toBe(await after.text());
    expect(before.headers.get('cache-control')).toBeNull();
  });

  it('H1 returns an empty success response without authentication', async () => {
    const app = createApp(landingDocument);
    const anonymous = await app.request('/health');
    const withIdentity = await app.request('/health', {
      headers: { 'Cf-Access-Jwt-Assertion': 'unverified-test-value' },
    });

    expect(anonymous.status).toBe(200);
    expect(await anonymous.text()).toBe('');
    expect(await withIdentity.text()).toBe('');
  });

  it('H2 keeps health output empty and unknown paths not found', async () => {
    const app = createApp(landingDocument);
    const health = await app.request('/health');
    const unknown = await app.request('/other');

    expect(health.headers.get('content-type')).toBeNull();
    expect(unknown.status).toBe(404);
  });

  it('S1 denies every purge path until identity verification is available', async () => {
    const app = createApp(landingDocument);

    for (const path of ['/purge', '/purge/', '/purge/anything']) {
      expect((await app.request(path)).status).toBe(401);
    }
  });
});
