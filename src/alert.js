import { readFileSync, writeFileSync } from "node:fs";

export const crossed = (price, threshold, direction) =>
  direction === "above" ? price >= threshold : price <= threshold;

// State is tied to the watch, so changing SYMBOL/DIRECTION/THRESHOLD starts armed.
const watchKey = (cfg) => `${cfg.symbol}|${cfg.direction}|${cfg.threshold}`;

export function evaluate(price, cfg, state) {
  const key = watchKey(cfg);
  const armed = state?.key === key ? state.armed : true;
  if (!crossed(price, cfg.threshold, cfg.direction)) return { alert: false, state: { key, armed: true } };
  return { alert: armed, state: { key, armed: false } };
}

export function loadState(file) {
  try {
    const s = JSON.parse(readFileSync(file, "utf8"));
    return typeof s?.armed === "boolean" ? s : { armed: true };
  } catch {
    return { armed: true };
  }
}

export const saveState = (file, state) => writeFileSync(file, JSON.stringify(state));
