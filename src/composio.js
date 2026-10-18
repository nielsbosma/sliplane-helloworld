const { COMPOSIO_API_KEY, COMPOSIO_USER_ID } = process.env;

export const composioConfigured = Boolean(COMPOSIO_API_KEY);
export const composioUserId = COMPOSIO_USER_ID || "default";

export async function connectedAccounts() {
  const url = new URL("https://backend.composio.dev/api/v3/connected_accounts");
  url.searchParams.set("user_ids", composioUserId);
  url.searchParams.set("limit", "50");
  const res = await fetch(url, { headers: { "x-api-key": COMPOSIO_API_KEY } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error?.message ?? body.message ?? `Composio answered ${res.status}`);
  return (body.items ?? []).map((a) => ({ toolkit: a.toolkit?.slug ?? "unknown", status: a.status ?? "" }));
}
