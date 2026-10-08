import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';

const landingDocument = await readFile(
  new URL('../landing.html', import.meta.url),
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
    expect(document).not.toMatch(/<a\b/i);
  });

  it('L3 declares a responsive viewport for mobile and desktop browsers', async () => {
    const response = await createApp(landingDocument).request('/');
    const document = await response.text();

    expect(document).toMatch(
      /<meta\s+name="viewport"\s+content="width=device-width,\s*initial-scale=1(?:\.0)?"\s*\/?>/i,
    );
  });

  it('FB6 keeps the public document independent from unknown routes and cache policy', async () => {
    const app = createApp(landingDocument);
    const before = await app.request('/');
    const unknownRoute = await app.request('/not-found');
    const after = await app.request('/');

    expect(unknownRoute.status).toBe(404);
    expect(await before.text()).toBe(await after.text());
    expect(before.headers.get('cache-control')).toBeNull();
  });
});
