export type PurgeMode = 'url' | 'prefix';

export interface UrlPurgeCommand {
  mode: 'url';
  service: string;
  paths: string[];
}

export interface PrefixPurgeCommand {
  mode: 'prefix';
  service: string;
  path: string;
  confirmation?: string;
}

export type PurgeCommand = UrlPurgeCommand | PrefixPurgeCommand;

export interface PurgeOutcome {
  target: string;
  success: boolean;
  reason?: string;
}

export interface PurgeExecutionResult {
  ok: boolean;
  results?: PurgeOutcome[];
  error?: string;
  errors?: string[];
  notice?: string;
}

export function validateCatalog(catalog: readonly string[]): string[] {
  const cleaned = catalog
    .map((service) => service.trim())
    .filter((service) => service.length > 0);

  if (cleaned.length !== new Set(cleaned).size || cleaned.some((service) => service.includes('/'))) {
    throw new Error('SERVICES');
  }

  return cleaned;
}

function buildUrlTarget(service: string, imageHost: string, rawPath: string): string {
  const trimmed = rawPath.trim();
  if (!trimmed) {
    throw new Error('V3: URL path is required');
  }

  const candidate = trimmed.startsWith('http://') || trimmed.startsWith('https://')
    ? new URL(trimmed).pathname + new URL(trimmed).search
    : trimmed;

  const withLeadingSlashRemoved = candidate.replace(/^\/+/, '');
  const [pathnamePart = '', queryPart = ''] = withLeadingSlashRemoved.split('?');
  const segments = pathnamePart.split('/').filter((segment) => segment.length > 0);

  const normalizedSegments =
    segments[0] === service && segments.length > 1
      ? segments.slice(1)
      : segments;

  if (normalizedSegments.length === 0) {
    throw new Error('V3: URL path is required');
  }

  const normalizedPathname = normalizedSegments.join('/');
  const normalizedQuery = queryPart ? `?${queryPart}` : '';
  return `https://${imageHost}/${service}/${normalizedPathname}${normalizedQuery}`;
}

export function makeUrlTargets(
  service: string,
  imageHost: string,
  catalog: readonly string[],
  rawPaths: readonly string[],
): string[] {
  const catalogSet = new Set(validateCatalog(catalog));
  if (!catalogSet.has(service)) {
    throw new Error('V1: service must be selected from the predefined catalog');
  }

  const entries = rawPaths
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (entries.length === 0) {
    throw new Error('V6: at least one non-empty path is required');
  }

  const seen = new Set<string>();
  const uniqueTargets: string[] = [];

  for (const entry of entries) {
    const target = buildUrlTarget(service, imageHost, entry);
    if (seen.has(target)) {
      continue;
    }
    seen.add(target);
    uniqueTargets.push(target);
  }

  return uniqueTargets;
}

function responseReason(payload: unknown): string {
  if (payload && typeof payload === 'object' && 'errors' in payload) {
    const errors = (payload as { errors?: { message?: string }[] }).errors;
    if (Array.isArray(errors) && errors.length > 0) {
      const reason = errors[0]?.message;
      if (reason && typeof reason === 'string' && reason.trim().length > 0) {
        return reason;
      }
    }
  }

  return 'failed, reason unknown';
}

export async function executeUrlPurge(
  command: UrlPurgeCommand,
  imageHost: string,
  catalog: readonly string[],
  zoneId: string,
  apiToken: string,
): Promise<PurgeExecutionResult> {
  try {
    const targets = makeUrlTargets(command.service, imageHost, catalog, command.paths);

    const results: PurgeOutcome[] = [];
    for (const target of targets) {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ files: [target] }),
        },
      );

      const payload = (await response.json().catch(() => null)) as unknown;
      const success = response.ok && payload !== null && !!(payload as { success?: boolean }).success;
      results.push({
        target,
        success,
        reason: success ? undefined : responseReason(payload),
      });
    }

    const notice = results.some((result) => result.success)
      ? 'Cloudflare accepted the purge request. Browser caches are not cleared; stale images may remain visible for up to 4 hours.'
      : undefined;

    return {
      ok: true,
      results,
      notice,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'failed, reason unknown';
    return {
      ok: false,
      error: message,
      errors: [message],
    };
  }
}

export async function executePurgeCommand(
  command: PurgeCommand,
  imageHost: string,
  catalog: readonly string[],
  zoneId: string,
  apiToken: string,
): Promise<PurgeExecutionResult> {
  if (command.mode === 'url') {
    if (!Array.isArray(command.paths) || command.paths.length === 0) {
      return {
        ok: false,
        errors: ['V6: at least one non-empty path is required'],
      };
    }

    const hasEmptyEntry = command.paths.some((line) => line.trim().length === 0);
    if (hasEmptyEntry) {
      return {
        ok: false,
        errors: ['V3: each URL path line must be non-empty'],
      };
    }

    return executeUrlPurge(command, imageHost, catalog, zoneId, apiToken);
  }

  return {
    ok: false,
    errors: ['Prefix mode is not available yet'],
  };
}
