const TIMEOUT = 15000;

const checkQuote = (symbol, q) => {
  if (typeof q?.c !== "number" || q.c === 0) throw new Error(`Finnhub: no quote for "${symbol}" (unknown symbol?)`);
  return q.c;
};

export function directProviders({ getSecret, cfg, fetchImpl = fetch }) {
  const call = async (url, init) => {
    const res = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(TIMEOUT) });
    const text = await res.text();
    if (!res.ok) throw new Error(`${init.method} ${new URL(url).host} failed: ${res.status} ${text.slice(0, 200)}`);
    return text ? JSON.parse(text) : {};
  };
  return {
    async getPrice(symbol) {
      const key = await getSecret(cfg.finnhubSecretPath);
      const q = await call(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}`, {
        method: "GET",
        headers: { "X-Finnhub-Token": key },
      });
      return checkQuote(symbol, q);
    },
    async sendEmail({ subject, text }) {
      const key = await getSecret(cfg.resendSecretPath);
      await call("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({ from: cfg.alertFrom, to: [cfg.alertTo], subject, text }),
      });
    },
  };
}

export function intentProviders({ client, cfg }) {
  const run = async (binding, params) => {
    const { data, error, meta } = await client.bindings.execute(cfg.agentId, { binding, intent_type: "http", params });
    if (error) throw new Error(`1Claw: binding "${binding}" failed (${meta?.status ?? "-"} ${error.type}: ${error.message})`);
    if (data.status !== "success") throw new Error(`1Claw: binding "${binding}" ${data.status}${data.error ? `: ${data.error}` : ""}`);
    if (!data.result) throw new Error(`1Claw: binding "${binding}" returned no result`);
    // Same unpacking as 1Claw's own CLI proxy (binding-proxy.js): upstream status defaults to 200.
    const status = data.result.status ?? 200;
    let body = data.result.body;
    if (typeof body === "string") {
      const raw = body;
      try { body = JSON.parse(raw); } catch { body = raw; }
    }
    if (!(status >= 200 && status < 300)) {
      const shown = typeof body === "string" ? body : JSON.stringify(body);
      throw new Error(`Upstream via "${binding}" failed: ${status} ${(shown ?? "").slice(0, 200)}`);
    }
    return body;
  };
  return {
    async getPrice(symbol) {
      const q = await run(cfg.finnhubBinding, { method: "GET", path: `/api/v1/quote?symbol=${encodeURIComponent(symbol)}` });
      return checkQuote(symbol, q);
    },
    async sendEmail({ subject, text }) {
      await run(cfg.resendBinding, {
        method: "POST",
        path: "/emails",
        headers: { "content-type": "application/json" },
        body: { from: cfg.alertFrom, to: [cfg.alertTo], subject, text },
      });
    },
  };
}
