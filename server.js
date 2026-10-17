import { createServer } from "node:http";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const password = process.env.MASTER_PASSWORD;
if (!password) {
  console.error("MASTER_PASSWORD is not set");
  process.exit(1);
}
const port = Number(process.env.PORT ?? 3000);
const key = process.env.SESSION_SECRET ?? randomBytes(32).toString("hex");
const token = createHmac("sha256", key).update("session").digest("hex");

const equal = (a, b) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

const page = (body) => `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Hello World</title>
<style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#f5f5f4}
main{background:#fff;padding:2rem;border-radius:12px;box-shadow:0 1px 4px #0002;min-width:280px}
input,button{font:inherit;padding:.5rem;width:100%;box-sizing:border-box;margin-top:.5rem}
.error{color:#b91c1c}</style></head><body><main>${body}</main></body></html>`;

const loginForm = (error) => page(`<h1>Sign in</h1>
${error ? `<p class="error">${error}</p>` : ""}
<form method="post" action="/login">
<input type="password" name="password" placeholder="Master password" autofocus required>
<button>Sign in</button></form>`);

const send = (res, status, html, headers = {}) => {
  res.writeHead(status, { "content-type": "text/html; charset=utf-8", ...headers });
  res.end(html);
};

const readBody = (req) =>
  new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 10_000) req.destroy();
    });
    req.on("end", () => resolve(new URLSearchParams(data)));
  });

createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const cookie = /(?:^|;\s*)session=([^;]+)/.exec(req.headers.cookie ?? "")?.[1] ?? "";
  const signedIn = equal(cookie, token);

  if (url.pathname === "/health") {
    res.writeHead(200, { "content-type": "text/plain" });
    return res.end("ok");
  }
  if (url.pathname === "/login" && req.method === "POST") {
    const form = await readBody(req);
    if (!equal(form.get("password") ?? "", password)) {
      return send(res, 401, loginForm("Wrong password."));
    }
    const secure = req.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
    res.writeHead(303, {
      location: "/",
      "set-cookie": `session=${token}; HttpOnly; SameSite=Lax; Path=/${secure}`,
    });
    return res.end();
  }
  if (url.pathname === "/logout" && req.method === "POST") {
    res.writeHead(303, { location: "/", "set-cookie": "session=; Max-Age=0; Path=/" });
    return res.end();
  }
  if (url.pathname !== "/") return send(res, 404, page("<h1>Not found</h1>"));
  if (!signedIn) return send(res, 200, loginForm());
  send(res, 200, page(`<h1>Hello, World!</h1><p>You're signed in.</p>
<form method="post" action="/logout"><button>Sign out</button></form>`));
}).listen(port, () => console.log(`Listening on :${port}`));
