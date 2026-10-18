export const version = process.env.APP_VERSION || "dev";

const repo = process.env.GITHUB_REPO || "nielsbosma/sliplane-helloworld";
const updateUrl = process.env.UPDATE_URL;
let cached = { at: 0, tag: undefined };

const parts = (tag) => tag.replace(/^v/, "").split(/[.-]/).map((p) => (/^\d+$/.test(p) ? Number(p) : p));

export function isNewer(tag, current) {
  const a = parts(tag);
  const b = parts(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x === y) continue;
    if (typeof x === "number" && typeof y === "number") return x > y;
    return String(x) > String(y);
  }
  return false;
}

async function latestTag() {
  if (Date.now() - cached.at < 60 * 60 * 1000) return cached.tag;
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: { accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(5000),
    });
    cached = { at: Date.now(), tag: res.ok ? (await res.json()).tag_name : cached.tag };
  } catch {
    cached = { ...cached, at: Date.now() };
  }
  return cached.tag;
}

/** The newer release and where to install it, when there is one. */
export async function availableUpdate() {
  if (version === "dev") return undefined;
  const tag = await latestTag();
  if (!tag || !isNewer(tag, version)) return undefined;
  const url = updateUrl ? `${updateUrl}&ref=${encodeURIComponent(tag)}` : `https://github.com/${repo}/releases/tag/${tag}`;
  return { tag, url };
}
