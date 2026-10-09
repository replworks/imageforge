import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import type { IdentityVerifier } from "./access.js";
import { createApp } from "./app.js";

const landingDocument = await readFile(
  new URL("../index.html", import.meta.url),
  "utf8",
);
const purgeDocument = await readFile(
  new URL("../purge/index.html", import.meta.url),
  "utf8",
);
const denyIdentity: IdentityVerifier = async () => false;
const allowIdentity: IdentityVerifier = async () => true;

function createTestApp() {
  return createApp(landingDocument, purgeDocument, denyIdentity);
}

describe("public landing page", () => {
  it("L1 serves the same public document without authentication", async () => {
    const app = createTestApp();
    const anonymous = await app.request("/");
    const withIdentity = await app.request("/", {
      headers: { "Cf-Access-Jwt-Assertion": "unverified-test-value" },
    });

    expect(anonymous.status).toBe(200);
    expect(await anonymous.text()).toBe(await withIdentity.text());
    expect(anonymous.headers.get("content-type")).toContain("text/html");
  });

  it("L2 includes only a plain operator utility link to the protected path", async () => {
    const response = await createTestApp().request("/");
    const document = await response.text();
    const links = [
      ...document.matchAll(
        /<a\b[^>]*href="\/purge\/"[^>]*>([\s\S]*?)<\/a>/gi,
      ),
    ];

    expect(links).toHaveLength(1);
    expect(links[0]?.[1]?.replace(/<[^>]*>/g, "").trim()).toBe("/purge");
    expect(document.replace(links[0]?.[0] ?? "", "")).not.toContain("/purge");
  });

  it("L3 declares a responsive viewport for mobile and desktop browsers", async () => {
    const response = await createTestApp().request("/");
    const document = await response.text();

    expect(document).toMatch(
      /<meta\s+name="viewport"\s+content="width=device-width,\s*initial-scale=1(?:\.0)?"\s*\/?>/i,
    );
  });

  it("L1 serves og.png publicly when provided without authentication", async () => {
    const fakeImage = new Uint8Array([137, 80, 78, 71]);
    const app = createApp(
      landingDocument,
      purgeDocument,
      denyIdentity,
      [],
      undefined,
      fakeImage,
    );
    const response = await app.request("/og.png");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(bytes).toEqual(fakeImage);
  });

  it("L1 keeps the public document independent from unknown routes and cache policy", async () => {
    const app = createTestApp();
    const before = await app.request("/");
    const unknownRoute = await app.request("/not-found");
    const protectedRoute = await app.request("/purge/anything");
    const after = await app.request("/");

    expect(unknownRoute.status).toBe(404);
    expect(protectedRoute.status).toBe(401);
    expect(await before.text()).toBe(await after.text());
    expect(before.headers.get("cache-control")).toBeNull();
  });

  it("H1 returns an empty success response without authentication", async () => {
    const app = createTestApp();
    const anonymous = await app.request("/health");
    const withIdentity = await app.request("/health", {
      headers: { "Cf-Access-Jwt-Assertion": "unverified-test-value" },
    });

    expect(anonymous.status).toBe(200);
    expect(await anonymous.text()).toBe("");
    expect(await withIdentity.text()).toBe("");
  });

  it("H2 keeps health output empty and unknown paths not found", async () => {
    const app = createTestApp();
    const health = await app.request("/health");
    const unknown = await app.request("/other");

    expect(health.headers.get("content-type")).toBeNull();
    expect(unknown.status).toBe(404);
  });

  it("V1 serves the predefined catalog as a read-only service list", async () => {
    const app = createApp(
      landingDocument,
      purgeDocument,
      allowIdentity,
      ["images", "avatars"],
    );
    const response = await app.request("/purge/catalog");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ services: ["images", "avatars"] });
  });

  it("SA1 and SA2 deny all protected paths and methods without a valid identity", async () => {
    const app = createTestApp();

    for (const path of ["/purge", "/purge/", "/purge/anything"]) {
      expect((await app.request(path)).status).toBe(401);
    }
    expect(
      (
        await app.request("/purge/execute", {
          method: "POST",
        })
      ).status,
    ).toBe(401);
  });
});
