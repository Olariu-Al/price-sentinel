import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { crossed, evaluate, loadState, saveState } from "../src/alert.js";

const above = { symbol: "X", threshold: 100, direction: "above" };
const below = { symbol: "X", threshold: 100, direction: "below" };

test("crossed above/below, inclusive", () => {
  assert.equal(crossed(100, 100, "above"), true);
  assert.equal(crossed(99, 100, "above"), false);
  assert.equal(crossed(100, 100, "below"), true);
  assert.equal(crossed(101, 100, "below"), false);
});

test("first check already crossed alerts once, no repeat, re-arms after recross", () => {
  let r = evaluate(150, above, undefined);
  assert.equal(r.alert, true);
  r = evaluate(160, above, r.state);
  assert.equal(r.alert, false);
  r = evaluate(90, above, r.state);
  assert.equal(r.alert, false);
  assert.equal(r.state.armed, true);
  assert.equal(evaluate(101, above, r.state).alert, true);
});

test("below direction", () => {
  assert.equal(evaluate(50, below, undefined).alert, true);
  assert.equal(evaluate(150, below, undefined).alert, false);
});

test("missing and corrupt state files are armed; save/load roundtrips", () => {
  const dir = mkdtempSync(join(tmpdir(), "ps-"));
  assert.deepEqual(loadState(join(dir, "none.json")), { armed: true });
  const f = join(dir, "s.json");
  writeFileSync(f, "{not json");
  assert.deepEqual(loadState(f), { armed: true });
  saveState(f, { armed: false });
  assert.deepEqual(loadState(f), { armed: false });
});

test("changing the watch re-arms; same watch stays disarmed", () => {
  const { state } = evaluate(150, above, undefined);
  assert.equal(evaluate(150, above, state).alert, false);
  assert.equal(evaluate(150, { ...above, threshold: 120 }, state).alert, true);
  assert.equal(evaluate(150, { ...above, symbol: "Y" }, state).alert, true);
});
