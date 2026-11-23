import { test } from "node:test";
import assert from "node:assert/strict";
import { makeSecretGetter } from "../src/vault.js";

const client = (res) => ({ secrets: { get: async () => (res instanceof Error ? Promise.reject(res) : res) } });

test("returns the value; errors name the path but never the value", async () => {
  assert.equal(await makeSecretGetter(client({ data: { value: "k" }, error: null }), "v")("p"), "k");
  await assert.rejects(makeSecretGetter(client({ data: null, error: { type: "auth_error", message: "no" }, meta: { status: 403 } }), "v")("p"),
    /"p" \(403 auth_error: no\)/);
  await assert.rejects(makeSecretGetter(client(new Error("fetch failed")), "v")("p"), /Error: fetch failed/);
  await assert.rejects(makeSecretGetter(client({ data: { value: "SEC\r\nRET" }, error: null }), "v")("p"),
    (e) => /control characters/.test(e.message) && !e.message.includes("SEC"));
});
