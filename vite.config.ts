import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
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

// https://vite.dev/config/
export default defineConfig({
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

          next()
        })
      },
    },
  ],
})
