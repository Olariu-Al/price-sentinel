import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runOnce } from "../src/index.js";
import { loadState } from "../src/alert.js";

const mk = () => ({ symbol: "AAPL", threshold: 100, direction: "above", alertTo: "t@x.y", stateFile: join(mkdtempSync(join(tmpdir(), "ps-")), "s.json") });

test("email failure leaves state armed, success disarms", async () => {
  const cfg = mk();
  const bad = { getPrice: async () => 150, sendEmail: async () => { throw new Error("boom"); } };
  await assert.rejects(runOnce(cfg, bad), /boom/);
  assert.equal(loadState(cfg.stateFile).armed, true);
  const sent = [];
  const good = { getPrice: async () => 150, sendEmail: async (m) => sent.push(m) };
  await runOnce(cfg, good);
  await runOnce(cfg, good);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].subject, "Price alert: AAPL is above 100 (now 150)");
  assert.equal(loadState(cfg.stateFile).armed, false);
});
