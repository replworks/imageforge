const [service, rawPath, prefixPath, ...queries] = process.argv.slice(2);
const requiredEnv = [
  'CF_ZONE_ID',
  'CF_API_TOKEN',
  'IMAGE_HOST',
  'SERVICES',
];

for (const name of requiredEnv) {
  if (!process.env[name]?.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

if (process.env.IMAGE_HOST !== 'img.repl.net') {
  throw new Error('IMAGE_HOST must be img.repl.net for this probe.');
}

const services = process.env.SERVICES.split(',').map((item) => item.trim());
if (!service || !services.includes(service)) {
  throw new Error('Select a service from SERVICES.');
}

if (
  !rawPath ||
  rawPath.startsWith('/') ||
  rawPath.includes('?') ||
  rawPath.includes('#') ||
  !prefixPath ||
  prefixPath.startsWith('/') ||
  prefixPath.includes('?') ||
  prefixPath.includes('#') ||
  !rawPath.startsWith(prefixPath) ||
  queries.length < 2 ||
  queries.some((query) => !query || query.startsWith('?') || query.includes('#'))
) {
  throw new Error(
    'Provide a relative image path, its shorter matching prefix, and at least two query strings.',
  );
}

const origin = `https://${process.env.IMAGE_HOST}`;
const targets = queries.map(
  (query) => `${origin}/${service}/${rawPath}?${query}`,
);
const prefix = `${process.env.IMAGE_HOST}/${service}/${prefixPath}`;
const timeout = () => AbortSignal.timeout(20_000);

async function fetchImage(url) {
  const response = await fetch(url, { signal: timeout() });
  await response.arrayBuffer();
  const cacheStatus = response.headers.get('cf-cache-status');
  if (!response.ok) {
    throw new Error(
      `Image request failed: HTTP ${response.status}.`,
    );
  }
  return cacheStatus?.toUpperCase() ?? 'unavailable';
}

async function purge(body, token = process.env.CF_API_TOKEN) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${process.env.CF_ZONE_ID}/purge_cache`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: timeout(),
    },
  );

  const text = await response.text();
  let result;
  try {
    result = JSON.parse(text);
  } catch {
    throw new Error(`Purge API returned non-JSON (HTTP ${response.status}).`);
  }
  if (!result || typeof result !== 'object') {
    throw new Error(`Purge API returned an invalid response (HTTP ${response.status}).`);
  }

  return { status: response.status, result };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const cacheStatuses = [];
for (const target of targets) {
  cacheStatuses.push(await fetchImage(target));
}
console.log(
  `live_image_variants=${targets.length} http=success cache_status=${cacheStatuses.join(',')}`,
);

const exact = await purge({ files: [targets[0]] });
const exactSucceeded =
  exact.status >= 200 &&
  exact.status < 300 &&
  exact.result.success === true;
assert(exactSucceeded, `Exact purge was not explicitly successful (HTTP ${exact.status}).`);
console.log(
  `exact_purge=accepted api_http=${exact.status} api_success=true query_string_preserved=true`,
);

const prefixResult = await purge({ prefixes: [prefix] });
const prefixSucceeded =
  prefixResult.status >= 200 &&
  prefixResult.status < 300 &&
  prefixResult.result.success === true;
assert(
  prefixSucceeded,
  `Prefix purge was not explicitly successful (HTTP ${prefixResult.status}).`,
);
console.log(
  `prefix_purge=accepted api_http=${prefixResult.status} api_success=true query_free=true prefix=${JSON.stringify(prefix)}`,
);

const controlledFailure = await purge(
  { files: [targets[0]] },
  'invalid-live-probe-token',
);
const failureResult = controlledFailure.result;
const explicitlyFailed =
  controlledFailure.status < 200 ||
  controlledFailure.status >= 300 ||
  failureResult.success === false;
assert(explicitlyFailed, 'Invalid-token control was not reported as a failure.');
assert(
  failureResult.success !== true,
  'Invalid-token control returned explicit success.',
);

const errors = Array.isArray(failureResult.errors) ? failureResult.errors : [];
const firstError = errors[0];
const reason =
  firstError && typeof firstError === 'object'
    ? [firstError.code, firstError.message]
        .filter((part) => typeof part === 'string' || typeof part === 'number')
        .join(': ')
    : '';
console.log(
  `controlled_failure=failed api_http=${controlledFailure.status} api_success=false reason=${reason ? JSON.stringify(reason) : 'unavailable'}`,
);
console.log('probe=PASS');
