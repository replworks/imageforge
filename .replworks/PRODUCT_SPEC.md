# PRODUCT_SPEC.md — ImageForge (if.repl.net)

Audience: AI agents. Not for human reading.

Scope of this document: WHAT the product does and how it behaves for its users. It does NOT define tech stack, deployment, internal structure, or code. Those belong to TECH_STACK.md and ARCHITECTURE.md. If you are about to write a framework, library, hosting, or file-structure decision here, stop and leave it for those documents.

Keywords MUST, MUST NOT, SHOULD are used in the RFC 2119 sense.

---

## 1. Context

- Two hosts exist:
  - `img.repl.net`: the image proxy (resize, format conversion, edge-cached delivery). It already exists and is running. It is OUT OF SCOPE for this spec. Do not redesign, reimplement, or modify it.
  - `if.repl.net`: the host of this product. It has no relation to the image proxy and serves only what this spec defines.
- Image URL format served by the proxy: `https://img.repl.net/{service}/{path}` plus query-string parameters (for example `w`, `h`, `q`, `f`). Each distinct query string is a distinct cached variant.
- The proxy accepts any `{service}` value (free-form). The purge tool restricts `{service}` to a predefined list (see 4.2).
- This spec covers exactly two things on `if.repl.net`:
  1. One landing page at `/`.
  2. One operator tool at `/purge` that only purges the cache of images served from `img.repl.net`.
- `/purge` MUST NOT be implemented inside the image proxy application.

## 2. Actors

| Actor                                    | Access                           | Authentication |
| ---------------------------------------- | -------------------------------- | -------------- |
| Visitor                                  | `/` only                         | none           |
| Operator (exactly one person, the owner) | `/purge` and everything under it | required       |

- There is no multi-user model, no roles, no sign-up, no user table.

## 3. Landing page (`/`)

- The landing page is already prepared. Its content and layout are finalized in a separate discussion between the owner and a coding AI. This spec does NOT define its content.
- Constraints this spec places on it:
  - **L1** `/` MUST be publicly reachable without authentication.
  - **L2** `/` MUST NOT link to or mention `/purge`.
  - **L3** `/` MUST work on mobile and desktop viewports.
  - **L4** Not in scope: sign-up, login, pricing, billing, dashboards.

## 4. Purge tool (`/purge`)

Purpose: after an image is replaced, invalidate its cached copies immediately.

### 4.1 Operations

| Operation    | Input                                                                            | Effect                                                                                      |
| ------------ | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| URL purge    | a service (select) + one or more paths, one per line, each with its query string | invalidates exactly those URLs (query string must match exactly)                            |
| Prefix purge | a service (select) + one path prefix without query string                        | invalidates every cached variant under `{service}/{path-prefix}` regardless of query string |

- **P1** Full-host or full-zone purge MUST NOT be implemented. The owner does that in the Cloudflare dashboard.
- **P2** Not in scope: purge history, scheduled purge, bulk file upload, statistics, undo.
- **P3** The target host is fixed to `img.repl.net` and is not an input. Pasting a full URL is not supported.

### 4.2 Input and validation

- **V1** `service` MUST be chosen from a select box. The option list is a predefined set of services maintained by the owner. Free-text service entry is not offered in this tool.
- **V2** Unused. Intentionally left blank so that other rule IDs stay stable.
- **V3** URL mode: each path line MUST be non-empty. A leading `/` is optional and normalized. A query string is allowed and preserved exactly as typed.
- **V4** Prefix mode: the path MUST NOT contain a query string. Reject it (do not silently strip).
- **V5** Prefix mode with an empty path means "the entire service". Allow it only after an explicit second confirmation that names the service.
- **V6** Reject empty or whitespace-only input.
- **V7** A rejected input MUST NOT trigger any upstream request.

### 4.3 UI (single screen)

1. Mode switch: URL / Prefix.
2. Service select box.
3. Path input (multi-line in URL mode, single line in Prefix mode).
4. Execute button.
5. Result area.

Result area rules:

- **R1** Show, per target: the full resulting URL or prefix (on `img.repl.net`) and success or failure.
- **R2** On failure show the reason returned by the upstream API. If no reason is available, show "failed, reason unknown". NEVER display a failed purge as successful.
- **R3** On success, always show this notice: "Edge cache invalidated. Browser caches are not cleared; stale images may remain visible for up to 4 hours."
- **R4** No result history is stored. The result area is cleared on reload.

### 4.4 Acceptance criteria

- **A1** After purging a cached image URL, the next request to that exact URL returns a cache status of MISS or EXPIRED (not HIT).
- **A2** After a prefix purge, previously cached variants under that prefix with different query strings are all re-fetched from origin on next request.
- **A3** There is no way to target a host other than `img.repl.net` or a service outside the predefined list from the UI.
- **A4** A failed upstream call is shown as failed.
- **A5** Prefix mode with empty path does nothing until the second confirmation is given.

## 5. Browser cache decision

- Browser cache lifetime for images served from `img.repl.net` is 4 hours (14400 seconds). It is configured in Cloudflare, not in any application. No application in this spec sets or overrides browser cache headers.
- Consequence, accepted by the owner: after a purge, clients that already cached an image may keep showing the old one for up to 4 hours. Only edge cache is invalidated immediately.

## 6. Access control for `/purge`

This section states requirements only. The mechanism is decided in TECH_STACK.md.

- **S1** Only the owner can reach `/purge` and every path below it: the page, its static assets, and the endpoint that executes purge.
- **S2** No database-backed user storage, no password storage, no sign-up screen.
- **S3** Use the simplest authentication that satisfies S1. The owner's preference is Cloudflare Access if it can be applied.
- **S4** Requests that bypass the edge (for example direct requests to the origin address) MUST NOT reach `/purge` or its execute endpoint unauthenticated.
- **S5** No logout screen.
- **S6** The purge application is isolated from the image proxy application: separate application, so that purge credentials and authentication are not reachable through the proxy.

Acceptance:

- **SA1** Unauthenticated `GET /purge`, `/purge/`, and `/purge/anything` are all blocked.
- **SA2** Unauthenticated purge-execute requests fail.

## 7. Out of scope (do not build)

- Rate limiting (single operator for now; revisit before any public exposure).
- Image upload or management, customer accounts, billing, pricing.
- Usage statistics or log viewer.
- Full-host or full-zone purge.
- Any change to the image proxy or to `img.repl.net`.
- Localization. Operator UI language: Korean only.

## 8. Success criteria

- The owner can replace an image and finish invalidating its cache from `/purge` in under 30 seconds.
- Nobody except the owner can reach `/purge`.

## 9. Open items

1. How `/` and `/purge` are served and separated inside the application that serves `if.repl.net`. Decide in ARCHITECTURE.md.

## 10. Handoff to TECH_STACK.md and ARCHITECTURE.md

- Authentication mechanism and the exact protected path range.
- How S4 is enforced.
- Credential scope and storage for the cache-purge API.
- How purge requests are executed upstream, and whether cache tags are used.
- Storage and editing of the service list (V1).
- Implementation stack and deployment location for the application serving `if.repl.net`.
