import { test } from "node:test";
import assert from "node:assert/strict";
import { directProviders, intentProviders } from "../src/providers.js";

const cfg = {
  finnhubSecretPath: "fp", resendSecretPath: "rp", finnhubBinding: "fb", resendBinding: "rb",
  agentId: "agent", alertFrom: "F <f@x.y>", alertTo: "t@x.y",
};
const resp = (status, body) => ({ ok: status >= 200 && status < 300, status, text: async () => (typeof body === "string" ? body : JSON.stringify(body)) });

test("direct: finnhub URL/header, resend body, secret fetched per call", async () => {
  const calls = [];
  const secrets = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return resp(200, url.includes("finnhub") ? { c: 123.4 } : { id: "1" });
  };
  const getSecret = async (p) => (secrets.push(p), `key-${p}`);
  const p = directProviders({ getSecret, cfg, fetchImpl });
  assert.equal(await p.getPrice("BRK B"), 123.4);
  await p.getPrice("BRK B");
  await p.sendEmail({ subject: "s", text: "t" });
  assert.equal(calls[0].url, "https://finnhub.io/api/v1/quote?symbol=BRK%20B");
  assert.equal(calls[0].init.headers["X-Finnhub-Token"], "key-fp");
  assert.equal(calls[2].url, "https://api.resend.com/emails");
  assert.equal(calls[2].init.method, "POST");
  assert.equal(calls[2].init.headers.Authorization, "Bearer key-rp");
  assert.deepEqual(JSON.parse(calls[2].init.body), { from: cfg.alertFrom, to: [cfg.alertTo], subject: "s", text: "t" });
  assert.deepEqual(secrets, ["fp", "fp", "rp"]);
});

test("direct: c===0 and non-2xx throw (body truncated)", async () => {
  const getSecret = async () => "k";
  await assert.rejects(directProviders({ getSecret, cfg, fetchImpl: async () => resp(200, { c: 0 }) }).getPrice("ZZZ"), /no quote/);
  await assert.rejects(
    directProviders({ getSecret, cfg, fetchImpl: async () => resp(401, "x".repeat(500)) }).getPrice("A"),
    (e) => /401/.test(e.message) && e.message.length < 300,
  );
});

const mockClient = (data, calls = []) => ({
  bindings: { execute: async (...a) => (calls.push(a), { data, error: null }) },
});

test("intents: execute args, string JSON body parsed", async () => {
  const calls = [];
  const client = mockClient({ status: "success", result: { status: 200, body: '{"c": 55}' } }, calls);
  const p = intentProviders({ client, cfg });
  assert.equal(await p.getPrice("AAPL"), 55);
  assert.deepEqual(calls[0], ["agent", { binding: "fb", intent_type: "http", params: { method: "GET", path: "/api/v1/quote?symbol=AAPL" } }]);
  await p.sendEmail({ subject: "s", text: "t" });
  assert.deepEqual(calls[1][1].params, {
    method: "POST", path: "/emails", headers: { "content-type": "application/json" },
    body: { from: cfg.alertFrom, to: [cfg.alertTo], subject: "s", text: "t" },
  });
  assert.equal(calls[1][1].binding, "rb");
});

test("intents: denied and upstream 401 throw", async () => {
  await assert.rejects(intentProviders({ client: mockClient({ status: "denied", error: "nope" }), cfg }).getPrice("A"), /denied/);
  await assert.rejects(
    intentProviders({ client: mockClient({ status: "success", result: { status: 401, body: { error: "bad" } } }), cfg }).getPrice("A"),
    /401/,
  );
});

test("intents: missing upstream status means 200, missing result throws", async () => {
  assert.equal(await intentProviders({ client: mockClient({ status: "success", result: { body: { c: 7 } } }), cfg }).getPrice("A"), 7);
  await assert.rejects(intentProviders({ client: mockClient({ status: "success" }), cfg }).getPrice("A"), /no result/);
});
