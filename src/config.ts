export interface AppConfig {
  port: number;
  services: string[];
  imageHost: string;
  cfZoneId: string;
  cfApiToken: string;
  cfAccessTeamDomain: string;
  cfAccessAud: string;
}

const requiredNames = [
  'PORT',
  'SERVICES',
  'IMAGE_HOST',
  'CF_ZONE_ID',
  'CF_API_TOKEN',
  'CF_ACCESS_TEAM_DOMAIN',
  'CF_ACCESS_AUD',
] as const;

function requiredValue(
  env: NodeJS.ProcessEnv,
  name: (typeof requiredNames)[number],
): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`Missing or invalid required configuration: ${name}`);
  }
  return value;
}

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const invalid: string[] = [];
  const values = Object.fromEntries(
    requiredNames.map((name) => {
      try {
        return [name, requiredValue(env, name)];
      } catch {
        invalid.push(name);
        return [name, ''];
      }
    }),
  ) as Record<(typeof requiredNames)[number], string>;

  const port = Number(values.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    invalid.push('PORT');
  }

  const services = values.SERVICES.split(',').map((service) => service.trim());
  if (
    services.some((service) => !service || service.includes('/')) ||
    new Set(services).size !== services.length
  ) {
    invalid.push('SERVICES');
  }

  if (!/^[a-zA-Z0-9.-]+$/.test(values.IMAGE_HOST)) {
    invalid.push('IMAGE_HOST');
  }

  if (!/^[a-zA-Z0-9.-]+$/.test(values.CF_ACCESS_TEAM_DOMAIN)) {
    invalid.push('CF_ACCESS_TEAM_DOMAIN');
  }

  if (invalid.length > 0) {
    throw new Error(
      `Missing or invalid required configuration: ${[...new Set(invalid)].join(', ')}`,
    );
  }

  return {
    port,
    services,
    imageHost: values.IMAGE_HOST,
    cfZoneId: values.CF_ZONE_ID,
    cfApiToken: values.CF_API_TOKEN,
    cfAccessTeamDomain: values.CF_ACCESS_TEAM_DOMAIN,
    cfAccessAud: values.CF_ACCESS_AUD,
  };
}
