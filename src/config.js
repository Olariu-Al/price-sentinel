export function loadConfig(env = process.env) {
  const errors = [];
  const get = (k, def) => (env[k]?.trim() ? env[k].trim() : def);
  const oneOf = (k, def, opts) => {
    const v = get(k, def);
    if (!opts.includes(v)) errors.push(`${k} must be one of: ${opts.join(", ")} (got "${v}")`);
    return v;
  };
  const required = (k) => {
    const v = get(k);
    if (!v) errors.push(`${k} is required`);
    return v;
  };

  const mode = oneOf("MODE", "vault", ["vault", "intents"]);
  const agentApiKey = required("ONECLAW_AGENT_API_KEY");
  if (agentApiKey && !agentApiKey.startsWith("ocv_")) errors.push('ONECLAW_AGENT_API_KEY must start with "ocv_"');
  const vaultId = mode === "vault" ? required("ONECLAW_VAULT_ID") : get("ONECLAW_VAULT_ID");

  const thresholdRaw = required("THRESHOLD");
  const threshold = Number(thresholdRaw);
  if (thresholdRaw && !(Number.isFinite(threshold) && threshold > 0)) errors.push("THRESHOLD must be a number > 0");

  const interval = Number(get("INTERVAL_SECONDS", "300"));
  // setTimeout overflows above 2^31-1 ms and would fire immediately.
  if (!Number.isInteger(interval) || interval < 30 || interval > 2147483) errors.push("INTERVAL_SECONDS must be an integer between 30 and 2147483");

  const baseUrl = get("ONECLAW_BASE_URL", "https://api.1claw.co");
  if (!/^https:\/\/|^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(baseUrl)) errors.push("ONECLAW_BASE_URL must be an https:// URL (the agent key is sent to it)");

  const cfg = {
    baseUrl,
    agentId: required("ONECLAW_AGENT_ID"),
    agentApiKey,
    vaultId,
    symbol: required("SYMBOL"),
    threshold,
    direction: oneOf("DIRECTION", "above", ["above", "below"]),
    alertTo: required("ALERT_TO"),
    alertFrom: get("ALERT_FROM", "Price Sentinel <onboarding@resend.dev>"),
    intervalSeconds: interval,
    mode,
    finnhubSecretPath: get("FINNHUB_SECRET_PATH", "price-sentinel/finnhub-api-key"),
    resendSecretPath: get("RESEND_SECRET_PATH", "price-sentinel/resend-api-key"),
    finnhubBinding: get("FINNHUB_BINDING", "finnhub"),
    resendBinding: get("RESEND_BINDING", "resend"),
    stateFile: get("STATE_FILE", ".state.json"),
  };
  if (errors.length) throw new Error("Invalid configuration:\n- " + errors.join("\n- "));
  return Object.freeze(cfg);
}
