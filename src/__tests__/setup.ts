/**
 * Global test setup — runs before every test file.
 *
 * Responsibilities:
 *  1. Mock fetch so storage never hits real network
 *  2. Mock localStorage so persist middleware works without a browser
 *  3. Mock import.meta.env so API-key guards don't short-circuit code paths
 *  4. Suppress noisy console errors from React 19 act() warnings
 */
import '@testing-library/jest-dom';
import { vi, beforeEach, afterEach } from 'vitest';

// ── import.meta.env ───────────────────────────────────────────────────────────
// Vite replaces these at build time; in tests we shim them manually.
// Setting VITE_ANTHROPIC_API_KEY = 'test-key' ensures every guard that checks
// for a key passes — keeping code paths open — without making real API calls.
vi.stubEnv('VITE_ANTHROPIC_API_KEY', 'test-key-12345');

// ── localStorage mock ─────────────────────────────────────────────────────────
// happy-dom provides a real localStorage but we want full spy control.
const localStorageStore: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string): string | null => localStorageStore[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { localStorageStore[key] = value; }),
  removeItem: vi.fn((key: string) => { delete localStorageStore[key]; }),
  clear: vi.fn(() => { Object.keys(localStorageStore).forEach((k) => delete localStorageStore[k]); }),
  get length() { return Object.keys(localStorageStore).length; },
  key: vi.fn((i: number): string | null => Object.keys(localStorageStore)[i] ?? null),
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

// ── fetch mock ────────────────────────────────────────────────────────────────
// The Zustand store's fileBackedStorage calls /api/project and /api/changelog.
// We want those calls to silently succeed without blocking tests.
globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
  const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;
  const method = init?.method ?? 'GET';

  if (urlStr.includes('/api/project') && method === 'GET') {
    // Storage layer: fall back to localStorage (simulate empty disk)
    return new Response('', { status: 404 });
  }
  if (urlStr.includes('/api/project') && method === 'POST') {
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }
  if (urlStr.includes('/api/changelog')) {
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }
  if (urlStr.includes('/api/search')) {
    return new Response(JSON.stringify({ result: 'Mock search result for testing.' }), { status: 200 });
  }
  // Default: return empty 200
  return new Response(JSON.stringify({}), { status: 200 });
}) as typeof fetch;

// ── Per-test cleanup ──────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  localStorageMock.clear();
});

afterEach(() => {
  vi.useRealTimers(); // ensure fake timers don't leak between tests
});
