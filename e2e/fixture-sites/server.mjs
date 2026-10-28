// Tiny static server for fake business websites used by tests and LEADS_PROVIDER=mock.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.FIXTURE_PORT ?? 4100);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${port}`);
  if (url.pathname === "/redirect") {
    res.writeHead(301, { location: "/good.html" });
    return res.end();
  }
  const name = url.pathname.replace(/^\//, "") || "good.html";
  if (!/^[a-z]+\.html$/.test(name)) {
    res.writeHead(404, { "content-type": "text/plain" });
    return res.end("Not found");
  }
  try {
    const html = await readFile(path.join(here, name), "utf8");
    // The "slow" site takes 3 seconds to respond.
    if (name === "slow.html") await new Promise((r) => setTimeout(r, 3000));
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Not found");
  }
});

server.listen(port, "127.0.0.1", () => console.log(`Fixture sites on http://127.0.0.1:${port}`));
