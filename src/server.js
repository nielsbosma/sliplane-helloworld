import { createServer } from "node:http";
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { Readable } from "node:stream";
import * as Sentry from "@sentry/node";
import { databaseInfo, items, migrate, uploads } from "./db.js";
import { diskConfigured, diskState, recordStart, saveNote } from "./disk.js";
import { composioConfigured, composioUserId, connectedAccounts } from "./composio.js";
import { ask, llmConfigured } from "./llm.js";
import { mailConfigured, sendTestMail } from "./mail.js";
import { deleteObject, getObject, putObject, storageConfigured } from "./storage.js";
import { availableUpdate, version } from "./version.js";

const password = process.env.MASTER_PASSWORD;
if (!password) {
  console.error("MASTER_PASSWORD is not set");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
if (process.env.SENTRY_DSN) Sentry.init({ dsn: process.env.SENTRY_DSN });

const port = Number(process.env.PORT ?? 3000);
const key = process.env.SESSION_SECRET ?? randomBytes(32).toString("hex");
const token = createHmac("sha256", key).update("session").digest("hex");
const apiToken = process.env.API_TOKEN;
const MAX_UPLOAD = 10 * 1024 * 1024;

const equal = (a, b) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => entities[c]);

const page = (body) => `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Hello World</title>
<style>body{font-family:system-ui,sans-serif;margin:0;background:#f5f5f4;color:#1c1917}
main{max-width:720px;margin:2rem auto;padding:0 1rem}
section{background:#fff;padding:1.25rem 1.5rem;border-radius:12px;box-shadow:0 1px 4px #0002;margin-bottom:1rem}
h1{margin:.5rem 0 1rem}h2{margin:0 0 .75rem;font-size:1.1rem}
form.row{display:flex;gap:.5rem;margin:.25rem 0}form.row input[type=text],form.row input[type=email]{flex:1;min-width:0}
input,button,textarea{font:inherit;padding:.4rem .6rem}textarea{width:100%;box-sizing:border-box}
ul{list-style:none;padding:0;margin:0}li{display:flex;gap:.5rem;align-items:center;padding:.3rem 0;border-bottom:1px solid #eee}
li form{margin:0}.grow{flex:1}.muted{color:#78716c}.error{color:#b91c1c}.ok{color:#15803d}
pre{white-space:pre-wrap;background:#f5f5f4;padding:.75rem;border-radius:8px}
.login{max-width:320px;margin:20vh auto}.login input,.login button{width:100%;box-sizing:border-box;margin-top:.5rem}
header{display:flex;justify-content:space-between;align-items:center}header h1{margin-bottom:0}
.update{background:#eff6ff;border:1px solid #bfdbfe;padding:.75rem 1rem;border-radius:12px}
a.button{display:inline-block;background:#2563eb;color:#fff;padding:.45rem .9rem;border-radius:8px;text-decoration:none}</style></head><body><main>${body}</main></body></html>`;

const loginPage = (error) =>
  page(`<section class="login"><h1>Sign in</h1>
${error ? `<p class="error">${error}</p>` : ""}
<form method="post" action="/login">
<input type="password" name="password" placeholder="Master password" autofocus required>
<button>Sign in</button></form></section>`);

const notConfigured = (what) => `<p class="muted">${what} isn't configured for this deployment.</p>`;

const itemRow = (i) => `<li>
<form method="post" action="/items/${i.id}/toggle"><button title="Toggle">${i.done ? "✅" : "⬜"}</button></form>
<form method="post" action="/items/${i.id}/rename" class="row grow"><input type="text" name="title" value="${esc(i.title)}" required><button>Save</button></form>
<form method="post" action="/items/${i.id}/delete"><button>Delete</button></form></li>`;

const fileRow = (f) => `<li><a class="grow" href="/files/${f.id}">${esc(f.filename)}</a>
<span class="muted">${(f.size / 1024).toFixed(1)} KB</span>
<form method="post" action="/files/${f.id}/delete"><button>Delete</button></form></li>`;

async function dashboard({ notice, answer, prompt, accounts } = {}) {
  const [list, files, update, disk, db] = await Promise.all([
    items.list(),
    storageConfigured ? uploads.list() : [],
    availableUpdate(),
    diskConfigured ? diskState() : undefined,
    databaseInfo(),
  ]);
  const shown = db.others.slice(0, 10).join(", ") + (db.others.length > 10 ? ", …" : "");
  const dbHtml = `<p class="muted">Stored in <code>${esc(db.database)}</code> on <code>${esc(db.host)}</code>. ${
    db.others.length
      ? `It also holds ${db.others.length} table${db.others.length === 1 ? "" : "s"} this app didn't make (${esc(shown)}), from Bugsink or from the app that owned the database before you connected it.`
      : "No other app has tables in it."
  }</p>`;
  const diskHtml = disk
    ? `<p>This app has started <strong>${disk.starts}</strong> time${disk.starts === 1 ? "" : "s"} on this volume. The count and the note below survive redeploys and updates.</p>
<form method="post" action="/note"><textarea name="note" rows="3" placeholder="Write something to keep on disk">${esc(disk.note)}</textarea><button>Save note</button></form>`
    : notConfigured("A volume");
  const filesHtml = storageConfigured
    ? `<ul>${files.map(fileRow).join("")}</ul>
<form method="post" action="/files" enctype="multipart/form-data" class="row"><input type="file" name="file" required><button>Upload</button></form>`
    : notConfigured("A bucket");
  const llm = llmConfigured
    ? `<form method="post" action="/ask"><textarea name="prompt" rows="3" required>${esc(prompt ?? "Say hello to Sliplane in one sentence.")}</textarea><button>Ask</button></form>
${answer ? `<pre>${esc(answer)}</pre>` : ""}`
    : notConfigured("An LLM");
  const mail = mailConfigured
    ? `<form method="post" action="/mail" class="row"><input type="email" name="to" placeholder="you@example.com" required><button>Send</button></form>`
    : notConfigured("SMTP");
  const accountsHtml = accounts
    ? accounts.length
      ? `<ul>${accounts.map((a) => `<li><span class="grow">${esc(a.toolkit)}</span><span class="muted">${esc(a.status)}</span></li>`).join("")}</ul>`
      : `<p class="muted">No connected accounts yet.</p>`
    : "";
  const composio = composioConfigured
    ? `<p>Lists the apps connected for Composio user <code>${esc(composioUserId)}</code>.</p>
<form method="post" action="/composio"><button>List connected accounts</button></form>${accountsHtml}`
    : notConfigured("Composio");
  const errors = process.env.SENTRY_DSN
    ? `<form method="post" action="/boom"><button>Throw a test error</button></form>`
    : `<p class="muted">Create a project in Bugsink and set its DSN as <code>SENTRY_DSN</code> on this service to report errors.</p>`;
  const api = apiToken
    ? `<p>Call the JSON API without signing in, using the token the deployer showed when it finished:</p>
<pre>curl -H "Authorization: Bearer $API_TOKEN" ${esc(process.env.PUBLIC_URL ?? "")}/api/items</pre>`
    : notConfigured("An API token");
  const updateHtml = update
    ? `<p class="update"><a class="button" href="${esc(update.url)}">Update to version ${esc(update.tag)}</a></p>`
    : "";
  return page(`<header><h1>Hello, World!</h1>
<form method="post" action="/logout"><button>Sign out</button></form></header>
<p class="muted">Version ${esc(version)}</p>${updateHtml}
${notice ? `<p class="${notice.ok ? "ok" : "error"}">${esc(notice.text)}</p>` : ""}
<section><h2>Items <span class="muted">(Postgres)</span></h2>${dbHtml}
<ul>${list.map(itemRow).join("")}</ul>
<form method="post" action="/items" class="row"><input type="text" name="title" placeholder="New item" required><button>Add</button></form></section>
<section><h2>Files <span class="muted">(bucket)</span></h2>${filesHtml}</section>
<section><h2>Disk <span class="muted">(volume)</span></h2>${diskHtml}</section>
<section><h2>Ask the LLM <span class="muted">(OpenAI-compatible API)</span></h2>${llm}</section>
<section><h2>Send a test email <span class="muted">(SMTP)</span></h2>${mail}</section>
<section><h2>Agent tools <span class="muted">(Composio)</span></h2>${composio}</section>
<section><h2>Error reporting <span class="muted">(Bugsink)</span></h2>${errors}</section>
<section><h2>API token <span class="muted">(generated secret)</span></h2>${api}</section>`);
}

const send = (res, status, html) => {
  res.writeHead(status, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
};
const json = (res, status, data) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(data === undefined ? undefined : JSON.stringify(data));
};
const redirect = (res, location = "/", headers = {}) => {
  res.writeHead(303, { location, ...headers });
  res.end();
};

const readText = async (req) => {
  let data = "";
  for await (const chunk of req) {
    data += chunk;
    if (data.length > 100_000) throw Object.assign(new Error("Request too large"), { status: 413 });
  }
  return data;
};
const readForm = async (req) => new URLSearchParams(await readText(req));
const readJson = async (req) => {
  try {
    return JSON.parse((await readText(req)) || "{}");
  } catch {
    throw Object.assign(new Error("Invalid JSON"), { status: 400 });
  }
};

const routes = [];
const route = (method, path, handler) =>
  routes.push({ method, pattern: new RegExp(`^${path.replace(":id", "(\\d+)")}$`), handler });

route("POST", "/items", async (req, res) => {
  const title = (await readForm(req)).get("title")?.trim();
  if (title) await items.create(title);
  redirect(res);
});
route("POST", "/items/:id/toggle", async (req, res, id) => {
  const item = await items.get(id);
  if (item) await items.update(id, { done: !item.done });
  redirect(res);
});
route("POST", "/items/:id/rename", async (req, res, id) => {
  const title = (await readForm(req)).get("title")?.trim();
  if (title) await items.update(id, { title });
  redirect(res);
});
route("POST", "/items/:id/delete", async (req, res, id) => {
  await items.remove(id);
  redirect(res);
});

route("GET", "/api/items", async (req, res) => json(res, 200, await items.list()));
route("POST", "/api/items", async (req, res) => {
  const { title } = await readJson(req);
  if (typeof title !== "string" || !title.trim()) return json(res, 400, { error: "title is required" });
  json(res, 201, await items.create(title.trim()));
});
route("GET", "/api/items/:id", async (req, res, id) => {
  const item = await items.get(id);
  item ? json(res, 200, item) : json(res, 404, { error: "Not found" });
});
route("PUT", "/api/items/:id", async (req, res, id) => {
  const { title, done } = await readJson(req);
  const item = await items.update(id, {
    title: typeof title === "string" && title.trim() ? title.trim() : undefined,
    done: typeof done === "boolean" ? done : undefined,
  });
  item ? json(res, 200, item) : json(res, 404, { error: "Not found" });
});
route("DELETE", "/api/items/:id", async (req, res, id) => {
  (await items.remove(id)) ? json(res, 204) : json(res, 404, { error: "Not found" });
});

route("POST", "/files", async (req, res) => {
  if (!storageConfigured) return redirect(res);
  if (Number(req.headers["content-length"] ?? 0) > MAX_UPLOAD + 10_000)
    return send(res, 413, await dashboard({ notice: { text: "Files can be at most 10 MB." } }));
  const form = await new Request("http://localhost/", {
    method: "POST",
    headers: { "content-type": req.headers["content-type"] ?? "" },
    body: Readable.toWeb(req),
    duplex: "half",
  }).formData();
  const file = form.get("file");
  if (!file || typeof file === "string" || !file.size)
    return send(res, 400, await dashboard({ notice: { text: "Choose a file to upload." } }));
  const key = `uploads/${randomUUID()}`;
  const contentType = file.type || "application/octet-stream";
  await putObject(key, Buffer.from(await file.arrayBuffer()), contentType);
  await uploads.create({ key, filename: file.name, contentType, size: file.size });
  redirect(res);
});
route("GET", "/files/:id", async (req, res, id) => {
  const file = storageConfigured && (await uploads.get(id));
  if (!file) return send(res, 404, page("<h1>Not found</h1>"));
  const body = await getObject(file.key);
  res.writeHead(200, {
    "content-type": file.content_type,
    "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
  });
  body.pipe(res);
});
route("POST", "/files/:id/delete", async (req, res, id) => {
  const file = storageConfigured && (await uploads.remove(id));
  if (file) await deleteObject(file.key);
  redirect(res);
});

route("POST", "/note", async (req, res) => {
  const note = (await readForm(req)).get("note") ?? "";
  if (diskConfigured) await saveNote(note.slice(0, 10_000));
  redirect(res);
});

route("POST", "/ask", async (req, res) => {
  const prompt = (await readForm(req)).get("prompt") ?? "";
  if (!llmConfigured) return redirect(res);
  try {
    send(res, 200, await dashboard({ prompt, answer: await ask(prompt) }));
  } catch (error) {
    send(res, 502, await dashboard({ prompt, notice: { text: `The LLM request failed: ${error.message}` } }));
  }
});

route("POST", "/mail", async (req, res) => {
  const to = (await readForm(req)).get("to");
  if (!mailConfigured || !to) return redirect(res);
  try {
    await sendTestMail(to);
    send(res, 200, await dashboard({ notice: { ok: true, text: `Sent a test email to ${to}.` } }));
  } catch (error) {
    send(res, 502, await dashboard({ notice: { text: `Sending failed: ${error.message}` } }));
  }
});

route("POST", "/composio", async (req, res) => {
  if (!composioConfigured) return redirect(res);
  try {
    send(res, 200, await dashboard({ accounts: await connectedAccounts() }));
  } catch (error) {
    send(res, 502, await dashboard({ notice: { text: `The Composio request failed: ${error.message}` } }));
  }
});

route("POST", "/boom", async () => {
  throw new Error("Test error from Sliplane Hello World");
});

async function handle(req, res) {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/health") {
    res.writeHead(200, { "content-type": "text/plain" });
    return res.end("ok");
  }
  if (url.pathname === "/login" && req.method === "POST") {
    if (!equal((await readForm(req)).get("password") ?? "", password))
      return send(res, 401, loginPage("Wrong password."));
    const secure = req.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
    return redirect(res, "/", { "set-cookie": `session=${token}; HttpOnly; SameSite=Lax; Path=/${secure}` });
  }
  if (url.pathname === "/logout" && req.method === "POST") {
    return redirect(res, "/", { "set-cookie": "session=; Max-Age=0; Path=/" });
  }

  const cookie = /(?:^|;\s*)session=([^;]+)/.exec(req.headers.cookie ?? "")?.[1] ?? "";
  const bearer = /^Bearer (.+)$/.exec(req.headers.authorization ?? "")?.[1] ?? "";
  const viaToken = Boolean(apiToken) && url.pathname.startsWith("/api/") && equal(bearer, apiToken);
  if (!equal(cookie, token) && !viaToken) {
    if (url.pathname.startsWith("/api/")) return json(res, 401, { error: "Sign in first" });
    return url.pathname === "/" ? send(res, 200, loginPage()) : redirect(res);
  }
  if (url.pathname === "/" && req.method === "GET") return send(res, 200, await dashboard());
  for (const r of routes) {
    const match = r.method === req.method && r.pattern.exec(url.pathname);
    if (match) return r.handler(req, res, match[1] && Number(match[1]));
  }
  send(res, 404, page("<h1>Not found</h1>"));
}

await migrate();
await recordStart();

createServer((req, res) => {
  handle(req, res).catch((error) => {
    if (!error.status) {
      console.error(error);
      if (process.env.SENTRY_DSN) Sentry.captureException(error);
    }
    if (res.headersSent) return res.destroy();
    send(
      res,
      error.status ?? 500,
      page(`<section><h1>Something went wrong</h1><p class="error">${esc(error.message)}</p><p><a href="/">Back</a></p></section>`),
    );
  });
}).listen(port, () => console.log(`Listening on :${port}`));
