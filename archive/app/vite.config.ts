import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import https from 'node:https'
import type { IncomingMessage, ServerResponse } from 'node:http'

const DATA_DIR = path.resolve(__dirname, 'data')
const SNAPSHOTS_DIR = path.join(DATA_DIR, 'snapshots')
const FILES_DIR = path.join(DATA_DIR, 'files')
const PROJECT_FILE = path.join(DATA_DIR, 'project.json')
const CHANGELOG_FILE = path.join(DATA_DIR, 'changelog.ndjson')

function ensureDirs() {
  for (const dir of [DATA_DIR, SNAPSHOTS_DIR, FILES_DIR]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', (chunk: Buffer) => { body += chunk.toString() })
    req.on('end', () => resolve(body))
  })
}

function json(res: ServerResponse, data: unknown, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

// ─── Server-side Jeepland.co.il parts search ─────────────────────────────────
// Fetches jeepland.co.il (ב. ינוביץ — Israeli Jeep parts specialist) and
// parses the search results page into structured product data.
// The site's product descriptions are in English, making them useful to the agent.

interface JeeplandProduct {
  title: string;       // Hebrew product name
  description: string; // English description (compatibility, part type)
  priceILS: string;    // e.g. "₪218"
  url: string;
  barcode?: string;
}

function decodeHtmlEntities(str: string): string {
  // The site double-encodes some entities (e.g. &amp;quot; → &quot; → ")
  // so we run two decode passes.
  const pass = (s: string) => s
    .replace(/&quot;/g, '"').replace(/&#34;/g, '"')
    .replace(/&apos;/g, "'").replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&#60;/g, '<')
    .replace(/&gt;/g, '>').replace(/&#62;/g, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&amp;/g, '&'); // last: &amp; → & (enables next pass to catch &quot; etc)
  return pass(pass(str));
}

function parseJeeplandHtml(html: string): { products: JeeplandProduct[]; total: string } {
  const products: JeeplandProduct[] = [];

  // Extract total results count — page shows "תוצאות 1-20 מתון 131"
  const totalMatch = html.match(/מתון\s+(\d+)/);
  const total = totalMatch ? `${totalMatch[1]} total results` : '';

  // Products are structured as:
  //   <a href="/product/ID-slug">HEBREW TITLE</a>   (inside h3/h4)
  //   <div class="product-brief">ENGLISH DESC</div>
  //   <span class="price-amount">218 ₪</span>
  // Strategy: split on product-brief, look backwards for link, forward for price
  const chunks = html.split('class="product-brief">');
  for (let i = 1; i < chunks.length && products.length < 12; i++) {
    // Description: text before first < in current chunk
    const descMatch = chunks[i].match(/^([^<]+)/);
    if (!descMatch) continue;
    const description = decodeHtmlEntities(descMatch[1])
      .replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim();

    // Link + title: last product link in the preceding chunk
    const prevChunk = chunks[i - 1];
    const linkMatch = prevChunk.match(/href="(\/product\/[^"]+)"[^>]*>([^<]+)<\/a>/g);
    if (!linkMatch) continue;
    const lastLink = linkMatch[linkMatch.length - 1];
    const parsedLink = lastLink.match(/href="(\/product\/[^"]+)"[^>]*>([^<]+)<\/a>/);
    if (!parsedLink) continue;
    const [, href, title] = parsedLink;

    // Price: first price-amount in current chunk
    const priceMatch = chunks[i].match(/class="price-amount">([^<]+)<\/span>/);
    if (!priceMatch) continue;
    // Site shows "218 ₪" — normalise to "₪218"
    const rawPrice = priceMatch[1].trim();
    const numericMatch = rawPrice.match(/[\d,]+/);
    const priceILS = numericMatch ? `₪${numericMatch[0]}` : rawPrice;

    // Barcode: optional, in product-details block
    const barcodeMatch = chunks[i].match(/ברקוד:\s*([\w\-]+)/);

    products.push({
      title: title.trim(),
      description,
      priceILS,
      url: `https://www.jeepland.co.il${href}`,
      barcode: barcodeMatch?.[1],
    });
  }

  return { products, total };
}

function jeeplandSearch(query: string): Promise<string> {
  return new Promise((resolve) => {
    const encoded = encodeURIComponent(query);
    const options = {
      hostname: 'www.jeepland.co.il',
      path: `/search?q=${encoded}`,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; JeepPlanner/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'he-IL,he;q=0.9,en;q=0.8',
      },
    };
    const req = https.get(options, (incoming) => {
      // Follow a single redirect (HTTP→HTTPS or www redirect)
      if (incoming.statusCode && incoming.statusCode >= 300 && incoming.statusCode < 400 && incoming.headers.location) {
        incoming.resume();
        const loc = incoming.headers.location;
        const redir = loc.startsWith('http') ? new URL(loc) : null;
        if (!redir) { resolve(`jeepland.co.il redirect not followed: ${loc}`); return; }
        https.get({ hostname: redir.hostname, path: redir.pathname + redir.search, headers: options.headers }, (res2) => {
          let body = '';
          res2.on('data', (c: Buffer) => { body += c.toString(); });
          res2.on('end', () => resolve(formatJeeplandResult(query, body)));
        }).on('error', () => resolve(`jeepland.co.il unavailable for "${query}".`));
        return;
      }
      let body = '';
      incoming.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      incoming.on('end', () => resolve(formatJeeplandResult(query, body)));
    });
    req.on('error', () => resolve(`jeepland.co.il unavailable for "${query}".`));
    req.setTimeout(12000, () => { req.destroy(); resolve(`jeepland.co.il search timed out for "${query}".`); });
  });
}

function formatJeeplandResult(query: string, html: string): string {
  const { products, total } = parseJeeplandHtml(html);
  if (products.length === 0) {
    return `No parts found on jeepland.co.il for "${query}". Try a different keyword or search in Hebrew.`;
  }
  const header = `jeepland.co.il — "${query}"${total ? ` (${total})` : ''}, showing top ${products.length}:\n`;
  const lines = products.map((p) => {
    const parts = [`  ${p.title} — ${p.priceILS} incl. VAT`, `    ${p.description}`];
    if (p.barcode) parts.push(`    Part#: ${p.barcode}`);
    parts.push(`    ${p.url}`);
    return parts.join('\n');
  });
  return header + lines.join('\n\n');
}

// ─── Server-side web search (DuckDuckGo, bypasses browser CORS) ──────────────
function serverSearch(query: string): Promise<string> {
  return new Promise((resolve) => {
    const encoded = encodeURIComponent(query);
    const options = {
      hostname: 'api.duckduckgo.com',
      path: `/?q=${encoded}&format=json&no_html=1&skip_disambig=1`,
      headers: { 'User-Agent': 'JeepPlanner/1.0 (personal restoration tool)' },
    };
    const req = https.get(options, (res) => {
      let body = '';
      res.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          const parts: string[] = [];
          if (data.AbstractText) {
            parts.push(`Summary: ${data.AbstractText}${data.AbstractSource ? ` (${data.AbstractSource})` : ''}`);
          }
          if (data.Answer) parts.push(`Answer: ${data.Answer}`);
          if (data.RelatedTopics?.length > 0) {
            const topics = (data.RelatedTopics as Array<{ Text?: string; Topics?: Array<{ Text?: string }> }>)
              .flatMap((t) => t.Topics ?? [t])
              .filter((t) => t.Text)
              .slice(0, 8)
              .map((t) => `• ${t.Text}`)
              .join('\n');
            if (topics) parts.push(`Related:\n${topics}`);
          }
          if (data.Results?.length > 0) {
            const results = (data.Results as Array<{ Text?: string; FirstURL?: string }>)
              .slice(0, 4)
              .map((r) => `• ${r.Text}${r.FirstURL ? `\n  ${r.FirstURL}` : ''}`)
              .join('\n');
            if (results) parts.push(`Top results:\n${results}`);
          }
          resolve(parts.length > 0
            ? `Search: "${query}"\n\n${parts.join('\n\n')}`
            : `No structured results for "${query}".`
          );
        } catch {
          resolve(`Search parse error for "${query}".`);
        }
      });
    });
    req.on('error', () => resolve(`Search unavailable for "${query}".`));
    req.setTimeout(10000, () => { req.destroy(); resolve(`Search timed out for "${query}".`); });
  });
}

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: '0.0.0.0',   // ← accessible on local network (phone in garage!)
    port: 5175,
  },
  plugins: [
    react(),
    {
      name: 'jeep-planner-persistence',
      configureServer(server) {
        ensureDirs()

        server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
          const url = req.url ?? ''
          const method = req.method ?? 'GET'

          // ── GET /api/project ─────────────────────────────────────────────
          if (method === 'GET' && url === '/api/project') {
            if (!fs.existsSync(PROJECT_FILE)) {
              res.writeHead(404)
              res.end('')
              return
            }
            const data = fs.readFileSync(PROJECT_FILE, 'utf-8')
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(data)
            return
          }

          // ── POST /api/project ─────────────────────────────────────────────
          if (method === 'POST' && url === '/api/project') {
            const body = await readBody(req)
            ensureDirs()
            fs.writeFileSync(PROJECT_FILE, body, 'utf-8')
            json(res, { ok: true })
            return
          }

          // ── POST /api/changelog ───────────────────────────────────────────
          if (method === 'POST' && url === '/api/changelog') {
            const body = await readBody(req)
            ensureDirs()
            fs.appendFileSync(CHANGELOG_FILE, body + '\n', 'utf-8')
            json(res, { ok: true })
            return
          }

          // ── GET /api/snapshots ────────────────────────────────────────────
          if (method === 'GET' && url === '/api/snapshots') {
            const files = fs.existsSync(SNAPSHOTS_DIR)
              ? fs.readdirSync(SNAPSHOTS_DIR).filter(f => f.endsWith('.json')).sort().reverse()
              : []
            json(res, { snapshots: files })
            return
          }

          // ── POST /api/snapshots ───────────────────────────────────────────
          if (method === 'POST' && url === '/api/snapshots') {
            const body = await readBody(req)
            ensureDirs()
            const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
            const snapshotFile = path.join(SNAPSHOTS_DIR, `${ts}.json`)
            fs.writeFileSync(snapshotFile, body, 'utf-8')
            json(res, { ok: true, file: `${ts}.json` })
            return
          }

          // ── GET /api/snapshots/:file ──────────────────────────────────────
          if (method === 'GET' && url.startsWith('/api/snapshots/')) {
            const filename = url.replace('/api/snapshots/', '')
            const file = path.join(SNAPSHOTS_DIR, filename)
            if (!fs.existsSync(file) || !filename.endsWith('.json')) {
              res.writeHead(404); res.end(''); return
            }
            const data = fs.readFileSync(file, 'utf-8')
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(data)
            return
          }

          // ── GET /api/search?q=... ─────────────────────────────────────────
          // Server-side search proxy — bypasses browser CORS restrictions.
          // DuckDuckGo instant answers API, no key required.
          if (method === 'GET' && url.startsWith('/api/search')) {
            const params = new URLSearchParams(url.split('?')[1] ?? '')
            const q = params.get('q') ?? ''
            if (!q) { json(res, { result: 'No query provided.' }); return }
            const result = await serverSearch(q)
            json(res, { result })
            return
          }

          // ── GET /api/jeepland?q=... ───────────────────────────────────────
          // Scrapes jeepland.co.il (Israeli Jeep parts shop) and returns
          // structured product listings with Hebrew/English names + ILS prices.
          if (method === 'GET' && url.startsWith('/api/jeepland')) {
            const params = new URLSearchParams(url.split('?')[1] ?? '')
            const q = params.get('q') ?? ''
            if (!q) { json(res, { result: 'No query provided.' }); return }
            const result = await jeeplandSearch(q)
            json(res, { result })
            return
          }

          next()
        })
      },
    },
  ],
})
