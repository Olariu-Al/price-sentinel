import { test } from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../src/config.js";

const ok = {
  ONECLAW_AGENT_ID: "00000000-0000-4000-8000-000000000001", ONECLAW_AGENT_API_KEY: "ocv_x", ONECLAW_VAULT_ID: "00000000-0000-4000-8000-000000000002",
  SYMBOL: "AAPL", THRESHOLD: "100", ALERT_TO: "a@b.c",
};

test("valid env gets defaults and is frozen", () => {
  const c = loadConfig(ok);
  assert.equal(c.threshold, 100);
  assert.equal(c.direction, "above");
  assert.equal(c.mode, "vault");
  assert.equal(c.intervalSeconds, 300);
  assert.equal(c.baseUrl, "https://api.1claw.co");
  assert.equal(c.stateFile, ".state.json");
  assert.ok(Object.isFrozen(c));
});

test("empty env lists all problems", () => {
  assert.throws(() => loadConfig({}), (e) =>
    ["ONECLAW_AGENT_API_KEY", "ONECLAW_VAULT_ID", "SYMBOL", "THRESHOLD", "ALERT_TO"].every((k) => e.message.includes(k)));
});

test("bad values are rejected", () => {
  assert.throws(() => loadConfig({ ...ok, DIRECTION: "up" }), /DIRECTION/);
  assert.throws(() => loadConfig({ ...ok, MODE: "x" }), /MODE/);
  assert.throws(() => loadConfig({ ...ok, THRESHOLD: "abc" }), /THRESHOLD/);
  assert.throws(() => loadConfig({ ...ok, THRESHOLD: "0" }), /THRESHOLD/);
  assert.throws(() => loadConfig({ ...ok, ONECLAW_AGENT_API_KEY: "nope" }), /ocv_/);
});

test("interval minimum", () => {
  assert.throws(() => loadConfig({ ...ok, INTERVAL_SECONDS: "29" }), /INTERVAL_SECONDS/);
  assert.throws(() => loadConfig({ ...ok, INTERVAL_SECONDS: "60.5" }), /INTERVAL_SECONDS/);
  assert.equal(loadConfig({ ...ok, INTERVAL_SECONDS: "30" }).intervalSeconds, 30);
  assert.throws(() => loadConfig({ ...ok, INTERVAL_SECONDS: "3000000" }), /INTERVAL_SECONDS/);
});

test("vault id not required in intents mode", () => {
  const { ONECLAW_VAULT_ID, ...rest } = ok;
  assert.equal(loadConfig({ ...rest, MODE: "intents" }).mode, "intents");
});

test("base URL must be https (localhost allowed)", () => {
  assert.throws(() => loadConfig({ ...ok, ONECLAW_BASE_URL: "http://api.1claw.co" }), /https/);
  assert.throws(() => loadConfig({ ...ok, ONECLAW_BASE_URL: "api.1claw.co" }), /https/);
  assert.equal(loadConfig({ ...ok, ONECLAW_BASE_URL: "http://localhost:8080" }).baseUrl, "http://localhost:8080");
});

test("agent id: optional in vault mode, required in intents mode, must be a UUID", () => {
  const { ONECLAW_AGENT_ID, ...noId } = ok;
  assert.equal(loadConfig(noId).agentId, undefined);
  assert.throws(() => loadConfig({ ...noId, MODE: "intents" }), /ONECLAW_AGENT_ID is required/);
  assert.throws(() => loadConfig({ ...ok, ONECLAW_AGENT_ID: "price-sentinel" }), /agent's UUID/);
  assert.throws(() => loadConfig({ ...ok, ONECLAW_VAULT_ID: "default" }), /vault's UUID/);
});
