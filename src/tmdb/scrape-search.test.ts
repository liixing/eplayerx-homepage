import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Hono } from 'hono';
import routes, { tmdbCacheMiddleware } from './routes.js';

test('scrape search excludes people, coalesces requests and caches only valid results', async () => {
  process.env.TMDB_API_TOKEN = 'test-token';
  const originalFetch = globalThis.fetch;
  const originalCaches = globalThis.caches;
  const entries = new Map<string, Response>();
  const writes: Promise<unknown>[] = [];
  const calls: URL[] = [];
  let status = 200;
  let empty = false;
  Object.defineProperty(globalThis, 'caches', { configurable: true, value: { default: {
    match: async (request: Request) => entries.get(request.url)?.clone(),
    put: async (request: Request, response: Response) => { entries.set(request.url, response); },
  } } });
  globalThis.fetch = async (input) => {
    const url = new URL(input instanceof Request ? input.url : String(input)); calls.push(url);
    await new Promise(resolve => setTimeout(resolve, 5));
    const tv = url.pathname.endsWith('/tv');
    return Response.json(status === 200 ? { results: empty ? [] : [{ id: tv ? 2 : 1, title: tv ? undefined : 'Movie', name: tv ? 'Series' : undefined,
      overview: 'Synopsis', poster_path: '/poster.jpg', popularity: 10 }] } : {}, { status, headers: { 'Retry-After': '12' } });
  };
  const app = new Hono(); app.use('/tmdb/*', tmdbCacheMiddleware); app.route('/tmdb', routes);
  const request = (query: string) => app.request('/tmdb/search/scrape?' + query, {}, {}, { props: {}, waitUntil: (p: Promise<unknown>) => { writes.push(p); }, passThroughOnException() {} });
  try {
    const [one, two] = await Promise.all([request('query=Dune&language=zh-CN&type=tv'), request('query=Dune&language=zh-CN&type=tv')]);
    assert.equal(one.status, 200); assert.equal(two.status, 200); assert.equal(calls.length, 1);
    assert.equal(calls[0].pathname, '/3/search/tv');
    const data = await one.json() as any[];
    assert.equal(data[0].overview, 'Synopsis'); assert.equal(data[0].poster_path, '/poster.jpg'); assert.equal(data[0].media_type, 'tv');
    await Promise.all(writes);
    assert.equal((await request('query=Dune&language=zh-CN&type=tv')).status, 200); assert.equal(calls.length, 1);
    const all = await request('query=Dune&language=en-US&type=all');
    assert.deepEqual((await all.json() as any[]).map(x => x.media_type).sort(), ['movie', 'tv']);
    assert.ok(calls.every(url => !/multi|person/.test(url.pathname)));
    assert.equal((await request('query=x&type=person')).status, 400);
    status = 429;
    const limited = await request('query=limited&type=movie');
    assert.equal(limited.status, 429); assert.equal(limited.headers.get('Retry-After'), '12'); assert.equal(limited.headers.get('Cache-Control'), 'no-store');
    const before = calls.length; await request('query=limited&type=movie'); assert.equal(calls.length, before + 1);
    status = 200; empty = true;
    const noResults = await request('query=empty&type=tv'); assert.match(noResults.headers.get('Cache-Control')!, /max-age=300/);
    await Promise.all(writes);
    assert.match((await request('query=empty&type=tv')).headers.get('Cache-Control')!, /max-age=300/);
  } finally {
    globalThis.fetch = originalFetch;
    Object.defineProperty(globalThis, 'caches', { configurable: true, value: originalCaches });
  }
});
