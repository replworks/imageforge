import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

const validEnv: NodeJS.ProcessEnv = {
  PORT: '3000',
  SERVICES: 'images,avatars',
  IMAGE_HOST: 'img.repl.net',
  CF_ZONE_ID: 'zone-id',
  CF_API_TOKEN: 'token',
  CF_ACCESS_TEAM_DOMAIN: 'team.cloudflareaccess.com',
  CF_ACCESS_AUD: 'audience',
};

describe('configuration', () => {
  it('V1 rejects missing required configuration before the application starts', () => {
    const { CF_API_TOKEN: _token, ...incompleteEnv } = validEnv;

    expect(() => loadConfig(incompleteEnv)).toThrow(
      'Missing or invalid required configuration: CF_API_TOKEN',
    );
  });

  it('V1 rejects an empty or invalid service catalog', () => {
    expect(() => loadConfig({ ...validEnv, SERVICES: '' })).toThrow(
      'SERVICES',
    );
    expect(() => loadConfig({ ...validEnv, SERVICES: 'images,images' })).toThrow(
      'SERVICES',
    );
    expect(() => loadConfig({ ...validEnv, SERVICES: 'images/private' })).toThrow(
      'SERVICES',
    );
  });

  it('V1 rejects invalid port and host configuration', () => {
    expect(() => loadConfig({ ...validEnv, PORT: '0' })).toThrow('PORT');
    expect(() =>
      loadConfig({ ...validEnv, IMAGE_HOST: 'https://img.repl.net' }),
    ).toThrow('IMAGE_HOST');
  });

  it('V1 loads all required configuration without exposing credentials in errors', () => {
    const config = loadConfig(validEnv);

    expect(config).toMatchObject({
      port: 3000,
      services: ['images', 'avatars'],
      imageHost: 'img.repl.net',
    });

    expect(() => loadConfig({ ...validEnv, CF_ZONE_ID: '' })).toThrow(
      'Missing or invalid required configuration: CF_ZONE_ID',
    );
  });
});
