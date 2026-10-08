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
