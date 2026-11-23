import { pathToFileURL } from "node:url";
import { loadConfig } from "./config.js";
import { makeClient, makeSecretGetter } from "./vault.js";
import { directProviders, intentProviders } from "./providers.js";
import { evaluate, loadState, saveState } from "./alert.js";

export async function runOnce(cfg, providers) {
  const price = await providers.getPrice(cfg.symbol);
  console.log(`[${new Date().toISOString()}] ${cfg.symbol} = ${price} (threshold ${cfg.direction} ${cfg.threshold})`);
  const { alert, state } = evaluate(price, cfg, loadState(cfg.stateFile));
  if (alert) {
    await providers.sendEmail({
      subject: `Price alert: ${cfg.symbol} is ${cfg.direction} ${cfg.threshold} (now ${price})`,
      text: `${cfg.symbol} is now ${price}, which is ${cfg.direction} your threshold of ${cfg.threshold}.`,
    });
    console.log(`Alert emailed to ${cfg.alertTo}`);
  }
  // Only reached after a successful send, so a failed email retries next tick.
  saveState(cfg.stateFile, state);
}

async function main() {
  let cfg;
  try {
    cfg = loadConfig();
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
  try {
    saveState(cfg.stateFile, loadState(cfg.stateFile)); // fail now, not after an email went out
  } catch (e) {
    console.error(`Cannot write STATE_FILE "${cfg.stateFile}": ${e.message}`);
    process.exit(1);
  }
  const client = makeClient(cfg);
  const providers =
    cfg.mode === "intents"
      ? intentProviders({ client, cfg })
      : directProviders({ getSecret: makeSecretGetter(client, cfg.vaultId), cfg });
  console.log(
    cfg.mode === "intents"
      ? "mode=intents (1Claw calls the APIs; keys never leave the vault)"
      : "mode=vault (keys fetched from 1Claw each check)",
  );

  if (process.argv.includes("--once")) {
    // A hung request must not let overlapping cron runs both send the email.
    setTimeout(() => { console.error("Error: timed out after 120s"); process.exit(1); }, 120_000).unref();
    try {
      await runOnce(cfg, providers);
      process.exit(0);
    } catch (e) {
      console.error(`Error: ${e.message}`);
      process.exit(1);
    }
  }

  let timer;
  const tick = async () => {
    try {
      await runOnce(cfg, providers);
    } catch (e) {
      console.error(`[${new Date().toISOString()}] Error: ${e.message}`);
    }
    timer = setTimeout(tick, cfg.intervalSeconds * 1000);
  };
  for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { clearTimeout(timer); process.exit(0); });
  tick();
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
