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

          next()
        })
      },
    },
  ],
})
