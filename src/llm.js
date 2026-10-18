const { LLM_BASE_URL, LLM_API_KEY, LLM_MODEL } = process.env;

export const llmConfigured = Boolean(LLM_BASE_URL && LLM_MODEL);

export async function ask(prompt) {
  const res = await fetch(`${LLM_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(LLM_API_KEY ? { authorization: `Bearer ${LLM_API_KEY}` } : {}),
    },
    body: JSON.stringify({ model: LLM_MODEL, messages: [{ role: "user", content: prompt }] }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error?.message ?? `The API answered ${res.status}`);
  return body.choices?.[0]?.message?.content ?? "";
}
