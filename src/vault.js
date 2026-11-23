import { createClient } from "@1claw/sdk";

export const makeClient = (cfg) =>
  createClient({ baseUrl: cfg.baseUrl, apiKey: cfg.agentApiKey, agentId: cfg.agentId });

export function makeSecretGetter(client, vaultId) {
  return async (path) => {
    const fail = (status, type, message) => {
      throw new Error(`1Claw: could not read secret "${path}" (${status} ${type}: ${message})`);
    };
    let res;
    try {
      res = await client.secrets.get(vaultId, path);
    } catch (e) {
      fail("-", e.name, e.message);
    }
    if (res.error || !res.data?.value) {
      fail(res.meta?.status ?? "-", res.error?.type ?? "empty", res.error?.message ?? "no value returned");
    }
    // fetch echoes an invalid header value verbatim in its error, so never let one reach a header.
    if (/[\0\r\n]/.test(res.data.value)) fail(res.meta?.status ?? "-", "invalid", "value contains control characters");
    return res.data.value;
  };
}
