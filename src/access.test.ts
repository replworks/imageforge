import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
} from 'jose';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { createIdentityVerifier } from './access.js';
import { createApp } from './app.js';

const teamDomain = 'imageforge-test.cloudflareaccess.com';
const audience = 'imageforge-test-audience';
const issuer = `https://${teamDomain}`;
const keyId = 'test-signing-key';
const { privateKey, publicKey } = await generateKeyPair('RS256');
const exportedPublicKey = await exportJWK(publicKey);
const keySet = createLocalJWKSet({
  keys: [
    {
      ...exportedPublicKey,
      alg: 'RS256',
      kid: keyId,
      use: 'sig',
    },
  ],
});
const verifyIdentity = createIdentityVerifier(teamDomain, audience, keySet);
const landingDocument = await readFile(
  new URL('../index.html', import.meta.url),
  'utf8',
);
const purgeDocument = await readFile(
  new URL('../purge/index.html', import.meta.url),
  'utf8',
);

async function createAssertion(
  options: {
    issuer?: string;
    audience?: string | string[];
    expirationTime?: string | number;
    noExpiration?: boolean;
  } = {},
): Promise<string> {
  const token = new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', kid: keyId })
    .setIssuer(options.issuer ?? issuer)
    .setAudience(options.audience ?? audience)
    .setIssuedAt();

  if (!options.noExpiration) {
    token.setExpirationTime(options.expirationTime ?? '5m');
  }

  return token.sign(privateKey);
}

describe('Cloudflare Access identity verification', () => {
  it('SA1 allows a correctly signed assertion with the expected issuer, audience, and expiry', async () => {
    const assertion = await createAssertion();
    const request = new Request('https://if.repl.net/purge/', {
      headers: { 'Cf-Access-Jwt-Assertion': assertion },
    });

    await expect(verifyIdentity(request)).resolves.toBe(true);
  });

  it('SA1 serves the protected page only after identity verification', async () => {
    const assertion = await createAssertion();
    const app = createApp(landingDocument, purgeDocument, verifyIdentity);
    const denied = await app.request('/purge/anything');
    const allowed = await app.request('/purge/', {
      headers: { 'Cf-Access-Jwt-Assertion': assertion },
    });
    const redirect = await app.request('/purge', {
      headers: { 'Cf-Access-Jwt-Assertion': assertion },
    });

    expect(denied.status).toBe(401);
    expect(await denied.text()).toBe('');
    expect(allowed.status).toBe(200);
    expect(await allowed.text()).toContain('<main id="app">');
    expect(redirect.status).toBe(302);
    expect(redirect.headers.get('location')).toBe('/purge/');
  });

  it('SA1 and S4 gate every protected asset and operation before route resolution', async () => {
    const assertion = await createAssertion();
    const app = createApp(landingDocument, purgeDocument, verifyIdentity);
    const protectedAsset = await app.request(
      '/purge/assets/not-present.js',
    );
    const protectedOperation = await app.request('/purge/execute', {
      method: 'POST',
    });
    const authorizedMissingAsset = await app.request(
      '/purge/assets/not-present.js',
      { headers: { 'Cf-Access-Jwt-Assertion': assertion } },
    );

    expect(protectedAsset.status).toBe(401);
    expect(protectedOperation.status).toBe(401);
    expect(authorizedMissingAsset.status).toBe(404);
  });

  it('FB1 denies a missing or malformed assertion', async () => {
    await expect(
      verifyIdentity(new Request('https://if.repl.net/purge/')),
    ).resolves.toBe(false);
    await expect(
      verifyIdentity(
        new Request('https://if.repl.net/purge/', {
          headers: { 'Cf-Access-Jwt-Assertion': 'not-a-jwt' },
        }),
      ),
    ).resolves.toBe(false);
  });

  it('FB1 denies assertions with the wrong issuer, audience, or expiry', async () => {
    const assertions = [
      await createAssertion({ issuer: 'https://wrong.example.com' }),
      await createAssertion({ audience: 'wrong-audience' }),
      await createAssertion({ expirationTime: -1 }),
      await createAssertion({ noExpiration: true }),
    ];

    for (const assertion of assertions) {
      await expect(
        verifyIdentity(
          new Request('https://if.repl.net/purge/', {
            headers: { 'Cf-Access-Jwt-Assertion': assertion },
          }),
        ),
      ).resolves.toBe(false);
    }
  });

  it('FB1 denies algorithms outside RS256', async () => {
    const assertion = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256', kid: keyId })
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(new TextEncoder().encode('test-only-secret'));

    await expect(
      verifyIdentity(
        new Request('https://if.repl.net/purge/', {
          headers: { 'Cf-Access-Jwt-Assertion': assertion },
        }),
      ),
    ).resolves.toBe(false);
  });

  it('FB1 denies when verification material cannot be obtained', async () => {
    const failingVerifier = createIdentityVerifier(
      teamDomain,
      audience,
      async () => {
        throw new Error('test-only JWKS outage');
      },
    );
    const assertion = await createAssertion();

    await expect(
      failingVerifier(
        new Request('https://if.repl.net/purge/', {
          headers: { 'Cf-Access-Jwt-Assertion': assertion },
        }),
      ),
    ).resolves.toBe(false);
  });
});
