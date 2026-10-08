# TECH_STACK.md — ImageForge purge application

Audience: AI implementer. Technology choices and stack-bound rules only.
Keywords MUST, MUST NOT are used in the RFC 2119 sense.

## 1. Languages / runtimes / frameworks / libraries

- Scope: the purge application, plus the landing page where stated.
- Landing page: one static HTML file in the same repository and the same deployed application as the purge application. CSS: Tailwind CSS v4 loaded with `<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>`. No build step. No JavaScript framework.
- Runtime: Node.js 24.x (Active LTS). `package.json` `engines.node` MUST be `^24`.
- Language: TypeScript `^7.0.2`.
- Server compile/run: `tsc` compiles, `node` runs the compiled output.
- Frontend build and dev server: Vite `^8.3.3`.
- Module system: ESM. `package.json` `"type"` MUST be `"module"`.
- Package manager: npm. Lockfile: `package-lock.json`, committed.
- Web framework: Hono `^4.13.13`.
- Node server adapter: `@hono/node-server` `^2.1.4`.
- JWT verification: `jose` `^6.2.12`.
- CSS (purge application): `tailwindcss` `^4.3.3` with `@tailwindcss/vite` `^4.3.3`.
- Frontend language: plain HTML + TypeScript. No UI framework.
- Test: Vitest `^5.0.3`.
- Node typings: `@types/node` `^24`.
- Cloudflare API client: Node built-in `fetch`. No HTTP client library.
- Config parser: none. Read `process.env` directly.
- Runtime dependencies other than the above MAY be added only if widely used and maintained.

## 2. Framework- or tool-mandated paths and file names only

- `package.json`, `package-lock.json`, `tsconfig.json`.
- `vite.config.ts` holds both Vite and Vitest configuration (`test` key).
- `index.html` is the Vite entry at project root.
- `.github/workflows/` holds CI workflow files.
- Vite `base` MUST be `/purge/`.
- Landing HTML MUST NOT reference Vite-built assets.
- Vite output directory: default `dist`. `tsc` `outDir` MUST NOT equal it.
- Test files MUST match `*.test.ts`.

## 3. Coding conventions specific to the chosen stack

- `tsconfig.json`: `strict` true, `noUncheckedIndexedAccess` true, `module` and `moduleResolution` `NodeNext`.
- Relative imports in server code MUST include the `.js` extension.
- Node built-in modules MUST be imported with the `node:` prefix.
- `any` MUST NOT be used. Use `unknown` and narrow.
- HTTP calls MUST use global `fetch`.
- Tailwind MUST be configured CSS-first (`@import "tailwindcss"`). `tailwind.config.js` MUST NOT exist.
- Frontend MUST use plain DOM APIs.
- Operator UI text MUST be Korean. No i18n library.
- `package.json` scripts MUST include `dev` (Vite dev server), `build` (`tsc` and `vite build`), `start`, `test` (`vitest run`), `typecheck` (`tsc --noEmit`).

## 4. Testing rules

- Test runner: Vitest only.
- Test names MUST include the PRODUCT_SPEC rule ID they verify (for example `V3`, `S4`, `A2`).
- Tests MUST NOT call the real Cloudflare API. Stub global `fetch` with Vitest mocks.
- JWT tests MUST generate keys with `jose` and MUST NOT use real Cloudflare Access tokens.
- Coverage: no threshold. Coverage gating MUST NOT be configured.
- Validation logic MUST be unit-tested without starting a server.

## 5. Configuration rules

- Configuration source: environment variables only. No config file.
- Env var names: `PORT`, `SERVICES`, `IMAGE_HOST`, `CF_ZONE_ID`, `CF_API_TOKEN`, `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`.
- `IMAGE_HOST` value is a bare hostname without scheme.
- `SERVICES` is a comma-separated list.
- A missing required env var MUST stop the process at startup.
- `.env` files MUST be gitignored. Local runs load them with `node --env-file`. `dotenv` MUST NOT be used.
- Secrets (`CF_API_TOKEN`) MUST be stored as Coolify environment secrets.
- Env vars MUST NOT use the `VITE_` prefix.
- Secrets MUST NOT appear in the repository, the client bundle, or logs.

## 6. Deployment rules

- Target: Coolify. One resource serves `if.repl.net`. Docker Compose MUST NOT be used.
- Release: Coolify git integration deploys on push to the default branch.
- Install step MUST use `npm ci`.
- Build step MUST run `npm run build`. Start command MUST be `npm start`.
- CI system: GitHub Actions.
- CI MUST run on pull requests and on pushes to the default branch: `npm ci`, `npm run typecheck`, `npm test`, `npm run build`.
- License: none. `package.json` MUST set `"private": true`. No `LICENSE` file.

## 7. Security rules tied to the chosen stack

- The Cloudflare Access JWT in the `Cf-Access-Jwt-Assertion` header MUST be verified with `jose` (`createRemoteJWKSet`, `jwtVerify`).
- Verification MUST check signature (JWKS from `https://<CF_ACCESS_TEAM_DOMAIN>/cdn-cgi/access/certs`), issuer, audience (`CF_ACCESS_AUD`), and expiry. Algorithm MUST be restricted to `RS256`.
- Verification MUST run as Hono middleware on every `/purge` route, including static assets.
- JWT claims MUST NOT be read without verification.
- Other identity headers (for example `Cf-Access-Authenticated-User-Email`) MUST NOT be trusted.
- JWT or cryptographic logic MUST NOT be hand-written.
- `CF_API_TOKEN` MUST be scoped to Zone → Cache Purge on the single zone.
- Frontend MUST render upstream error text with `textContent`. `innerHTML` MUST NOT be used with external strings.

## 8. Non-goals (technologies and tools explicitly excluded)

- Linters and formatters: ESLint, Prettier, Biome.
- Test tools: `node:test`, Jest, coverage tooling.
- Server frameworks: Express, Fastify, Koa, Next.js, Nuxt, SvelteKit.
- UI frameworks and libraries: React, Vue, Svelte, component libraries.
- Runtimes and package managers: Bun, Deno, yarn, pnpm.
- Server TS runners: `tsx`, `ts-node`.
- Bundlers other than Vite.
- Databases, ORMs, user or session storage.
- Auth libraries: Passport, Auth.js, session middleware.
- S4 mechanisms other than app-side JWT verification: Cloudflare Tunnel, mTLS (Authenticated Origin Pulls).
- Cloudflare SDK (`cloudflare` npm package), `axios`, `node-fetch`, `got`.
- `dotenv`, config libraries.
- Tailwind CDN or browser script in the `/purge` UI. `tailwind.config.js` in any project.
- i18n libraries.
- Docker Compose.
