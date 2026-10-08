# ARCHITECTURE.md — SpeedCool (if.repl.net)

Audience: AI implementer. Technology-agnostic by design.
Keywords MUST, MUST NOT are used in the RFC 2119 sense.
Rule IDs from PRODUCT_SPEC.md (L1, V3, S4, A5, ...) are referenced, not restated.

---

## 1. Purpose

- Define how the application serving `if.repl.net` works internally: what its parts are, who owns what, how information flows, and what must always hold.
- The application serves two things: a public landing page and an operator-only purge tool.
- The image proxy on `img.repl.net` is not part of this architecture. The only relation is that this application invalidates the cache of images the proxy serves, through an Upstream Purge Service.

## 2. Core Concepts

- **Application**: the set of components C1–C8 below. One application serves the whole host.
- **Public Zone**: the request path exactly `/`.
- **Protected Zone**: the request path `/purge` and every path below it, whether or not that path exists.
- **Unknown Zone**: every other request path.
- **Operator**: the single owner. Identity policy (who counts as the operator) lives in the Edge Identity Layer, not in this application.
- **Identity Assertion**: proof of identity attached to a request by the Edge Identity Layer.
- **Service**: an identifier from the Service Catalog. It is the first path segment of an image URL.
- **Image Host**: the fixed host `img.repl.net`. Never supplied by any request.
- **Purge Command**: one operator request. Fields: mode (`exact` or `prefix`), service id, raw path text, optional confirmation (a service id).
- **Target**: one thing to invalidate. `exact` = a full URL on the Image Host including its query string. `prefix` = Image Host + service + path prefix.
- **Purge Plan**: validated, de-duplicated, ordered list of Targets.
- **Outcome**: result for one Target: `success`, or `failure` with an optional reason.
- **Rejection**: a command that failed validation. Carries the violated rule IDs. Has no effect upstream.
- **External parties** (not components):
  - **Edge Identity Layer**: authenticates the operator before requests reach the Application and issues Identity Assertions.
  - **Upstream Purge Service**: the edge cache provider's invalidation interface.
  - **Image Proxy**: never contacted by the Application.

## 3. System Flow

**Flow 1 — Visitor**

1. Request for `/` arrives at C1.
2. C1 classifies it Public Zone and dispatches to C3.
3. C3 returns the landing document. No identity check occurs.

**Flow 2 — Operator opens the console**

1. Request for `/purge` or `/purge/` (or console assets) arrives at C1.
2. C1 classifies it Protected Zone and asks C2 to verify before anything else.
3. C2 returns Allow. C1 dispatches to C4. C4 returns the console.
4. C5 runs in the operator's browser and requests the `catalog` operation (same gate path). C6 supplies the service list. C5 fills the select box.

**Flow 3 — Purge**

1. C5 collects mode, service, path text and sends a Purge Command through the `execute` operation.
2. C1 → C2 (Allow) → C7.
3. C7 validates and normalizes. On violation it returns a Rejection; flow ends at step 6 with no upstream call.
4. C7 returns a Purge Plan to the handler of `execute`, which passes it to C8.
5. C8 calls the Upstream Purge Service and returns one Outcome per Target.
6. The result (Rejection or Outcomes) returns to C5, which renders it.

**Flow 4 — Entire-service prefix purge (V5, A5)**

1. C5 sends a `prefix` command with empty path and no confirmation.
2. C7 returns a Rejection with rule ID `V5` marked "confirmation required". No upstream call.
3. C5 presents a prompt that names the service. On explicit affirmative action, C5 resends the same command with the confirmation set to the service id.
4. C7 accepts only if the confirmation equals the command's service id. Flow continues as Flow 3 step 4.

**Flow 5 — Denied**

1. C2 returns Deny for any Protected Zone request.
2. C1 returns a denial response. No other protected component runs. The response does not reveal whether the requested path exists.

## 4. Components

| ID  | Name              | Zone served                  | Kind                              |
| --- | ----------------- | ---------------------------- | --------------------------------- |
| C1  | Request Gate      | all                          | entry point, router               |
| C2  | Identity Verifier | Protected                    | decision                          |
| C3  | Landing Provider  | Public                       | content delivery                  |
| C4  | Console Provider  | Protected                    | content delivery                  |
| C5  | Operator Console  | Protected (runs client-side) | interaction and presentation      |
| C6  | Service Catalog   | Protected                    | data holder                       |
| C7  | Purge Planner     | Protected                    | validation and target composition |
| C8  | Purge Executor    | Protected                    | sole upstream caller              |

## 5. Component Responsibilities

### C1 Request Gate

- **Responsibilities**: classify each request path into Public, Protected, or Unknown Zone; for Protected, invoke C2 first and proceed only on Allow; dispatch to C3, C4, the `catalog` operation (C6), or the `execute` operation (C7 then C8); answer Unknown Zone with a not-found response; produce the denial response.
- **Inputs**: every inbound request.
- **Outputs**: dispatched request, denial response, or not-found response.
- **Owns**: zone classification; the ordering "verify before resolve".
- **Does not own**: the identity decision (C2), any validation (C7).

### C2 Identity Verifier

- **Responsibilities**: decide whether a request carries a valid Identity Assertion for this application: authentic, unexpired, intended for this application. Fail closed.
- **Inputs**: the request's Identity Assertion; trust configuration (trusted issuer, intended audience).
- **Outputs**: `Allow` or `Deny` (with an internal reason category, never exposed to the requester).
- **Owns**: assertion authenticity and validity.
- **Does not own**: which person is the operator; sessions (none exist); routing.

### C3 Landing Provider

- **Responsibilities**: return the landing document for the Public Zone.
- **Inputs**: a Public Zone request.
- **Outputs**: the landing document.
- **Owns**: delivery of the landing document.
- **Does not own**: anything about the Protected Zone. It has no dependency on C2, C4–C8 and its output contains no reference to the Protected Zone (L2).

### C4 Console Provider

- **Responsibilities**: return the console page and its static assets.
- **Inputs**: a request already allowed by C2.
- **Outputs**: console files.
- **Owns**: delivery of C5's files.
- **Does not own**: console behavior (C5), access decisions (C2).

### C5 Operator Console

- **Responsibilities**: single-screen interaction (mode switch, service select, path input, execute, result area); build Purge Commands; run the second-confirmation interaction; render Rejections and Outcomes per R1–R4; map rule IDs to operator-facing wording; show the R3 notice; apply non-authoritative convenience pre-checks.
- **Inputs**: operator actions; service list from `catalog`; Rejections and Outcomes from `execute`.
- **Outputs**: Purge Commands; the rendered result area.
- **Owns**: all operator-visible wording and layout; the confirmation interaction; clearing of results on reload (it persists nothing).
- **Does not own**: validation authority (C7), the Image Host, the service list, the upstream credential.

### C6 Service Catalog

- **Responsibilities**: hold the predefined service list; answer "list" and "is this id a member".
- **Inputs**: the owner-maintained service list, supplied once before the Application starts serving.
- **Outputs**: ordered list of service ids; membership answer.
- **Owns**: the set of valid services. Immutable for the life of the process. Not editable through any operation of the Application.
- **Does not own**: path rules, display.

### C7 Purge Planner

- **Responsibilities**: authoritatively enforce V1, V3–V7 and the V5 confirmation check; normalize paths; compose Targets on the Image Host; de-duplicate.
- **Inputs**: a Purge Command; C6; the Image Host value supplied before start.
- **Outputs**: a Purge Plan, or a Rejection.
- **Owns**: every input rule; the Image Host (A3); Target composition.
- **Does not own**: calling upstream (C8), wording of rejections (C5).

### C8 Purge Executor

- **Responsibilities**: send the Purge Plan's Targets to the Upstream Purge Service; split into as many upstream requests as the service requires; translate each upstream answer into per-Target Outcomes; pass through the upstream's reason text verbatim when present.
- **Inputs**: a Purge Plan; the upstream credential supplied before start.
- **Outputs**: one Outcome per Target, same order as the Plan.
- **Owns**: the upstream credential; all upstream purge calls; success/failure judgement of those calls.
- **Does not own**: validation, host choice, rendering. It MUST NOT report `success` without explicit upstream success (A4).

## 6. Responsibility Boundaries

| Question                                            | Sole owner |
| --------------------------------------------------- | ---------- |
| Which zone is this request in                       | C1         |
| Is this request from the operator (assertion valid) | C2         |
| Does the requested console file exist               | C4         |
| Which services exist                                | C6         |
| Is this command valid                               | C7         |
| Which host is purged                                | C7         |
| What upstream calls are made and how                | C8         |
| Did the upstream purge succeed                      | C8         |
| What the operator reads and sees                    | C5         |
| Who may hold the upstream credential                | C8         |

- C5 MAY duplicate C7's checks for convenience. If they disagree, C7 wins.
- C3 shares no state or data with any other component.
- C1 MUST NOT interpret command contents. C8 MUST NOT interpret raw input.

## 7. Data Flow

| Data                                    | Produced by            | Consumed by            | Crosses boundary       |
| --------------------------------------- | ---------------------- | ---------------------- | ---------------------- |
| Identity Assertion                      | Edge Identity Layer    | C2                     | external → Application |
| Verification material                   | Edge Identity Layer    | C2                     | external → Application |
| Landing document                        | C3                     | visitor                | Application → browser  |
| Console files                           | C4                     | operator               | Application → browser  |
| Service list                            | C6                     | C5                     | Application → browser  |
| Purge Command                           | C5                     | C7                     | browser → Application  |
| Rejection                               | C7                     | C5                     | Application → browser  |
| Purge Plan                              | C7                     | C8                     | internal only          |
| Upstream request (Targets + credential) | C8                     | Upstream Purge Service | Application → external |
| Upstream answer                         | Upstream Purge Service | C8                     | external → Application |
| Outcomes                                | C8                     | C5                     | Application → browser  |

- The credential travels only on the C8 → Upstream Purge Service edge. It appears nowhere else.
- Purge Commands, Plans, and Outcomes exist only for the duration of one request.

## 8. Architectural Rules

- **AR1** For the Protected Zone, C2's Allow MUST precede every other decision, including whether the path exists (SA1, SA2).
- **AR2** C7 is the only validation authority. A Purge Command is never trusted because of where it came from, including C5.
- **AR3** Only C8 contacts the Upstream Purge Service. Only C8 reads the upstream credential.
- **AR4** The Image Host is fixed configuration owned by C7. No request field, header, or path text can change it (P3, A3).
- **AR5** `catalog` is read-only and never causes an upstream call. `execute` is the only operation that may cause one.
- **AR6** The Application holds no persistent state and no session. Identity is verified on every Protected Zone request (S2, S5, R4).
- **AR7** C2 runs for every Protected Zone request regardless of how the request reached the Application (S4).
- **AR8** C3 is isolated from C2 and C4–C8 (L1, L2, S6).
- **AR9** Required configuration (service list, Image Host, upstream credential, trust configuration) is supplied before the Application serves anything. Missing or invalid configuration prevents the Application from serving at all.
- **AR10** No component sets or overrides browser-cache lifetime on any response (PRODUCT_SPEC section 5).
- **AR11** No component sends requests to, or depends on the configuration of, the Image Proxy.
- **AR12** No component records Targets, paths, Purge Commands, Identity Assertion contents, or the credential. Operational logs MAY record only: request zone, allow/deny, rejection rule IDs, count of successful and failed Targets.

## 9. Failure Boundaries

- **FB1** C2 cannot establish validity (assertion missing, malformed, expired, wrong audience, verification material unavailable) → Deny. No protected component runs.
- **FB2** C7 Rejection → return Rejection. C8 is not invoked. Valid parts of a rejected command are not executed.
- **FB3** Upstream unreachable, timed out, or non-success → the affected Targets get `failure`. When no reason is available, the Outcome carries no reason and C5 shows the unknown-reason text (R2).
- **FB4** A timed-out upstream call has an unknown real result. It is reported as `failure`. Repeating the same command is always safe.
- **FB5** Targets sent in one upstream request share that request's result. Targets in different upstream requests have independent results.
- **FB6** A failure in C4, C5, C6, C7, or C8 MUST NOT change C3's behavior. A failure in C3 MUST NOT change the Protected Zone's behavior.
- **FB7** Edge Identity Layer outage is treated as FB1.
- **FB8** Invalid or missing configuration → AR9 (no partial service).

## 10. Non-Goals

- No persistence layer, session store, or cache of any kind inside the Application.
- No application-side user model, role model, or allow-list of people.
- No asynchronous execution, queue, scheduler, or background job. A purge completes within the handling of one command.
- No automatic retry. Retrying is an operator action.
- No abstraction over multiple upstream providers. One Upstream Purge Service contract exists.
- No per-Target purge strategies, grouping tags, or purge-by-tag.
- No runtime editing of the Service Catalog.
- No coordination or shared state across multiple running copies of the Application.
- No split of C1–C8 into independently operated parts.

## 11. Architectural Invariants

- **I1** No request in the Protected Zone reaches C4, C6, C7, or C8 without a C2 Allow.
- **I2** A command that yields a Rejection causes zero upstream calls (V7, A5).
- **I3** Every Target's host equals the Image Host.
- **I4** Every Target's service is a member of the Service Catalog (A3).
- **I5** An Outcome is `success` only if the Upstream Purge Service explicitly confirmed that Target's invalidation (A4).
- **I6** The number and order of Outcomes equal the number and order of Targets in the Plan.
- **I7** The upstream credential never appears in any response, log, or Public Zone output.
- **I8** The response for `/` is identical regardless of identity.
- **I9** In `exact` mode, each Target's query string equals the input's query string character for character (after trimming surrounding whitespace of the line).
- **I10** An empty-path `prefix` command without a confirmation equal to its service id causes zero upstream calls.
- **I11** Zone membership is decided only by the request path as defined in Core Concepts.

## 12. Resolved Decisions

1. **Prefix matching semantics** (V4, A2). Ambiguous: whether a prefix matches raw string prefixes or whole path segments. Decided: raw string prefix of `{Image Host}/{service}/{path}`, following the Upstream Purge Service's own prefix semantics (owner-approved). An empty path becomes `{Image Host}/{service}/`, so service `a` never matches `ab/`. Leading `/` of the path is optional and normalized in both modes. **Assumption**: the Upstream Purge Service supports string-prefix invalidation covering all query-string variants. If it does not, A2 cannot be met and this decision MUST be revisited.
2. **Blank lines in `exact` mode** (V3, V6). Ambiguous: V3 says every line is non-empty; V6 rejects only fully empty input. Decided (owner-approved): blank lines are ignored; surrounding whitespace of each line is trimmed; characters inside a line (including the query string) are preserved; duplicate lines collapse to one Target; if nothing remains, Rejection `V6`.
3. **Recording of purge targets** (R4, P2). Ambiguous: whether operational logs count as history. Decided (owner-approved): targets and paths are never recorded; only the summary in AR12.
4. **Validation duplicated in C5 and C7** (conflicting responsibility). Decided: C7 is the sole authority (AR2); C5 pre-checks are convenience only. Why: the `execute` operation can be called without the console, and a client-side check cannot be trusted.
5. **Missing responsibility: how C5 learns the service list.** Decided: a read-only `catalog` operation owned by C6, behind the same gate as everything else. Why: V1 requires a select box fed by the predefined list; embedding it elsewhere would create a second source of truth.
6. **Identity enforced in two places** (S3, S4). Decided: the Edge Identity Layer is the outer gate; C2 is a mandatory inner check that never assumes the outer one ran. Deciding which person is the operator stays with the Edge Identity Layer so the Application needs no user storage (S2).
7. **Unknown paths.** Ambiguous: behavior outside `/` and `/purge`. Decided: not-found response. Why: visitors are limited to `/`.
8. **Unauthenticated access to nonexistent protected paths** (SA1). Decided: AR1. A requester without a valid assertion gets denial for any path under `/purge`, so existence is never revealed.
9. **`/purge` and `/purge/`.** Decided: equivalent console entry points, both in the Protected Zone, both gated before any other handling.
10. **Confirmation form for entire-service purge** (V5, A5). Ambiguous: what "explicit second confirmation that names the service" requires. Decided: C5 shows a prompt naming the service; an explicit affirmative action resends the command carrying the service id as confirmation; C7 accepts only when it equals the command's service id. Typing the name is not required. Flag for the owner: this is the minimal reading of the spec; a typed-name requirement would change only C5's interaction.
11. **When the R3 notice appears** (R3). Ambiguous: "on success" for mixed results. Decided: shown whenever at least one Target succeeded; never when none did.
12. **Validation is all-or-nothing** (V7). Decided: any violated rule rejects the whole command; valid lines are not executed alone.
13. **Full URL pasted as a path** (P3). Decided: no special detection. The text is treated as a path as typed. R1 shows the resulting full URL, which makes the mistake visible. Why: the spec says "not supported", not "rejected".
14. **Rejection reporting.** Decided: C7 returns rule IDs; C5 owns the wording. Upstream failure reasons are passed through verbatim by C8 (R2).
15. **Mixed and partial results.** Decided: Outcomes are per Target; Targets sent together share a result (FB5); the Plan may be split across upstream requests by C8.
16. **Service Catalog validity.** Decided: the catalog MUST be non-empty, ids non-empty, unique, and contain no path separator; otherwise AR9 applies. Why: a service id is one URL path segment (I3, I4). Rule V2 is intentionally unused in the spec and needs no catalog check.
17. **Startup failure behavior** (AR9). Decided: invalid configuration stops the whole Application, including the Public Zone. Why: no partial or degraded mode, so protected behavior is never weaker than intended.
18. **Browser-cache headers vs. protected content** (PRODUCT_SPEC section 5). The spec forbids this Application from setting cache directives (AR10). Consequence recorded: keeping shared caches from storing Protected Zone responses is the responsibility of the edge configuration, outside this architecture.
19. **Timeouts** (A4). Decided: an unknown upstream result is a `failure` (FB4); purge is idempotent, so retrying is safe.
20. **PRODUCT_SPEC vs TECH_STACK conflicts.** None found. Every component above can be realized within TECH_STACK.md.
