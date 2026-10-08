import { afterEach, describe, expect, it, vi } from 'vitest';
import { executePurgeCommand, makeUrlTargets } from './purge.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('URL purge validation', () => {
  it('V3 normalizes leading slashes, preserves query strings, and collapses duplicates', () => {
    const targets = makeUrlTargets(
      'images',
      'img.repl.net',
      ['images', 'avatars'],
      ['/images/logo.png?size=large', 'logo.png?size=large', '/images/logo.png?size=large'],
    );

    expect(targets).toEqual([
      'https://img.repl.net/images/logo.png?size=large',
    ]);
  });

  it('V3 ignores pasted full URLs and keeps the fixed image host', () => {
    const targets = makeUrlTargets(
      'images',
      'img.repl.net',
      ['images'],
      ['https://cdn.example.com/images/logo.png?size=large'],
    );

    expect(targets).toEqual([
      'https://img.repl.net/images/logo.png?size=large',
    ]);
  });

  it('V6 and V7 reject empty or whitespace-only input before any upstream request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const result = await executePurgeCommand(
      {
        mode: 'url',
        service: 'images',
        paths: ['', '   '],
      },
      'img.repl.net',
      ['images'],
      'zone-id',
      'token',
    );

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('V3: each URL path line must be non-empty');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('V3 accepts valid URL targets and reports upstream success notice', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    const result = await executePurgeCommand(
      {
        mode: 'url',
        service: 'images',
        paths: ['/images/logo.png?size=large', '/images/logo.png?size=large'],
      },
      'img.repl.net',
      ['images'],
      'zone-id',
      'token',
    );

    expect(result.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.notice).toContain('Cloudflare accepted the purge request');
    expect(result.results?.[0]).toMatchObject({
      target: 'https://img.repl.net/images/logo.png?size=large',
      success: true,
    });
  });
});

describe('Prefix purge validation', () => {
  it('V4 rejects query-string prefixes and normalizes leading slashes', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    const rejected = await executePurgeCommand(
      {
        mode: 'prefix',
        service: 'images',
        path: '/assets/logo?size=large',
      },
      'img.repl.net',
      ['images'],
      'zone-id',
      'token',
    );

    expect(rejected.ok).toBe(false);
    expect(rejected.errors).toContain('V4: prefix path must not contain a query string');
    expect(fetchSpy).not.toHaveBeenCalled();

    const accepted = await executePurgeCommand(
      {
        mode: 'prefix',
        service: 'images',
        path: '/assets/logo/',
      },
      'img.repl.net',
      ['images'],
      'zone-id',
      'token',
    );

    expect(accepted.ok).toBe(true);
    expect(accepted.results?.[0]).toMatchObject({
      target: 'img.repl.net/images/assets/logo/',
      success: true,
    });
  });

  it('V5 requires confirmation for the entire service prefix and rejects mismatches', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    const missing = await executePurgeCommand(
      {
        mode: 'prefix',
        service: 'images',
        path: '   ',
      },
      'img.repl.net',
      ['images'],
      'zone-id',
      'token',
    );

    const mismatched = await executePurgeCommand(
      {
        mode: 'prefix',
        service: 'images',
        path: '',
        confirmation: 'avatars',
      },
      'img.repl.net',
      ['images', 'avatars'],
      'zone-id',
      'token',
    );

    const valid = await executePurgeCommand(
      {
        mode: 'prefix',
        service: 'images',
        path: '',
        confirmation: 'images',
      },
      'img.repl.net',
      ['images'],
      'zone-id',
      'token',
    );

    expect(missing.ok).toBe(false);
    expect(missing.errors).toContain('V5: entire-service prefix purge requires confirmation matching the selected service');
    expect(mismatched.ok).toBe(false);
    expect(mismatched.errors).toContain('V5: entire-service prefix purge requires confirmation matching the selected service');
    expect(valid.ok).toBe(true);
    expect(valid.results?.[0]).toMatchObject({
      target: 'img.repl.net/images/',
      success: true,
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('V7 rejects empty prefix values without any upstream call', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const result = await executePurgeCommand(
      {
        mode: 'prefix',
        service: 'images',
        path: '',
      },
      'img.repl.net',
      ['images'],
      'zone-id',
      'token',
    );

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('V5: entire-service prefix purge requires confirmation matching the selected service');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
