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

test('automatic scrape resolves multilingual aliases and returns only requested-language metadata', async () => {
  process.env.TMDB_API_TOKEN = 'test-token';
  const originalFetch = globalThis.fetch;
  const calls: URL[] = [];
  let detailStatus = 200;
  globalThis.fetch = async input => {
    const url = new URL(input instanceof Request ? input.url : String(input)); calls.push(url);
    if (url.pathname.includes('/search/')) {
      const tv = url.pathname.endsWith('/tv');
      if (!tv) assert.equal(url.searchParams.get('year'), '2001');
      return Response.json({ results: [{ id: 129, [tv ? 'name' : 'title']: `${url.searchParams.get('language')} title`,
        overview: `${url.searchParams.get('language')} synopsis`,
        [tv ? 'original_name' : 'original_title']: '千と千尋の神隠し',
        release_date: '2001-07-20', first_air_date: '2001-07-20', popularity: 10 }] });
    }
    assert.match(url.searchParams.get('append_to_response') ?? '', /alternative_titles,translations/);
    const language = url.searchParams.get('language');
    const tv = url.pathname.includes('/tv/');
    return Response.json(detailStatus === 200 ? {
      id: 129, [tv ? 'name' : 'title']: `${language} title`, overview: `${language} synopsis`,
      [tv ? 'original_name' : 'original_title']: '千と千尋の神隠し',
      release_date: '2001-07-20', first_air_date: '2001-07-20', origin_country: ['JP'],
      translations: { translations: [{ data: { title: 'Spirited Away' } }, { data: { title: 'Le Voyage de Chihiro' } }, { data: { name: '千与千寻' } },
        { data: { title: 'Унесённые призраками' } }, { data: { title: 'المخطوفة' } }] },
      alternative_titles: { [tv ? 'results' : 'titles']: [{ title: 'Chihiros Reise' }] },
    } : {}, { status: detailStatus, headers: { 'Retry-After': '3' } });
  };
  const app = new Hono(); app.route('/tmdb', routes);
  const request = (query: string, language: string, type = 'movie') => app.request('/tmdb/search/scrape?' + new URLSearchParams({ query, language, type, year: '2001', match: '1' }));
  try {
    for (const type of ['movie', 'tv']) {
      for (const language of ['zh-CN', 'zh-TW', 'en-US', 'ja-JP', 'fr-FR', 'de-DE', 'es-ES', 'ar-SA', 'ko-KR', 'ru-RU']) {
        for (const query of [`${language} title`, '千と千尋の神隠し', 'Spirited Away', 'Le Voyage de Chihiro', '千与千寻', 'Унесённые призраками', 'المخطوفة', 'Chihiros Reise']) {
          const before = calls.length;
          const response = await request(query, language, type);
          assert.equal(response.status, 200);
          const rows = await response.json() as any[];
          const direct = query === `${language} title` || query === '千と千尋の神隠し';
          assert.equal(calls.length, before + (direct ? 1 : 2), 'details are requested only for aliases');
          assert.equal(calls[before].searchParams.get('language'), language);
          assert.equal(rows.length, 1); const row = rows[0];
          assert.equal(row[type === 'tv' ? 'name' : 'title'], `${language} title`);
          assert.equal(row.overview, `${language} synopsis`);
          assert.equal(calls.at(-1)?.searchParams.get('language'), language);
          assert.ok(row.match_titles.includes(query));
          assert.equal(row.translations, undefined); assert.equal(row.alternative_titles, undefined);
          assert.equal(row.media_type, type);
        }
      }
    }
    const beforeMiss = calls.length;
    assert.deepEqual(await (await request('Near Alias', 'zh-CN')).json(), []);
    assert.equal(calls.length - beforeMiss, 3, 'fallback reuses details for candidates already checked');
    assert.equal((await app.request('/tmdb/search/scrape?query=x&match=1&year=bad')).status, 400);
    detailStatus = 429;
    const limited = await request('limited', 'zh-CN');
    assert.equal(limited.status, 429); assert.equal(limited.headers.get('Retry-After'), '3');
    assert.equal(limited.headers.get('Cache-Control'), 'no-store');
    detailStatus = 503;
    assert.equal((await request('unavailable', 'zh-CN')).status, 502);
  } finally { globalThis.fetch = originalFetch; }
});

test('localized search misses fall back without saving English metadata or hiding failures', async () => {
  const originalFetch = globalThis.fetch;
  const calls: URL[] = [];
  let status = 200;
  globalThis.fetch = async input => {
    const url = new URL(input instanceof Request ? input.url : String(input)); calls.push(url);
    const language = url.searchParams.get('language');
    if (url.pathname.includes('/search/')) {
      if (language === 'zh-CN') {
        // The localized index returns a same-title movie from the wrong year.
        return Response.json({ results: [{ id: 1, title: 'Dear You', release_date: '2025-01-01' }] },
          { status, headers: { 'Retry-After': '7' } });
      }
      assert.equal(language, 'en-US');
      return Response.json({ results: [{ id: 1671548, title: 'Dear You', original_title: '给阿嬷的情书',
        overview: 'English synopsis', release_date: '2026-04-30' }] });
    }
    assert.equal(url.pathname, '/3/movie/1671548');
    assert.equal(language, 'zh-CN');
    return Response.json({ id: 1671548, title: '给阿嬷的情书', original_title: '给阿嬷的情书',
      overview: '中文简介', release_date: '2026-04-30' }, { status, headers: { 'Retry-After': '7' } });
  };
  const app = new Hono(); app.route('/tmdb', routes);
  const request = () => app.request('/tmdb/search/scrape?query=Dear%20You&type=movie&year=2026&language=zh-CN&match=1');
  try {
    const response = await request();
    assert.equal(response.status, 200);
    const rows = await response.json() as any[];
    assert.equal(calls.length, 3, 'localized search, fallback search, localized details');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].title, '给阿嬷的情书'); assert.equal(rows[0].overview, '中文简介');
    assert.ok(rows[0].match_titles.includes('Dear You'));
    status = 429; calls.length = 0;
    const limited = await request();
    assert.equal(limited.status, 429); assert.equal(limited.headers.get('Retry-After'), '7');
    assert.equal(calls.length, 1, 'an upstream error must not trigger a language retry');
  } finally { globalThis.fetch = originalFetch; }
});

test('matching keeps Swift-compatible case folding and all exact same-year candidates', async () => {
  const originalFetch = globalThis.fetch;
  let title = 'Straße';
  let calls = 0;
  globalThis.fetch = async input => {
    const url = new URL(input instanceof Request ? input.url : String(input)); calls++;
    assert.equal(url.pathname, '/3/search/movie', 'exact title matches need no details');
    return Response.json({ results: [1, 2].map(id => ({ id, title, original_title: title, overview: '中文简介',
      original_language: 'de', release_date: '2020-01-01' })) });
  };
  const app = new Hono(); app.route('/tmdb', routes);
  try {
    for (const [stored, query] of [['Straße', 'STRASSE'], ['ΟΣ', 'οσ'], ['ΟΣ', 'ος']]) {
      title = stored; calls = 0;
      const response = await app.request('/tmdb/search/scrape?' + new URLSearchParams({ query, language: 'zh-CN', type: 'movie', year: '2020', match: '1' }));
      assert.equal(response.status, 200);
      assert.deepEqual((await response.json() as any[]).map(row => row.id), [1, 2], 'ambiguity must reach the client');
      assert.equal(calls, 1);
    }
  } finally { globalThis.fetch = originalFetch; }
});
