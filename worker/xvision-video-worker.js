/**
 * XVision video downloader: a small Cloudflare Worker.
 *
 * X's public embed data can only be read by X's own embed site, so a static
 * page cannot fetch it directly. This Worker does two narrow jobs:
 *
 *   GET /info?url=<post link or id>   -> JSON with the post's video files
 *   GET /download?src=<video url>&name=<file name>
 *                                     -> streams one MP4 back as a download
 *
 * It only ever contacts cdn.syndication.twimg.com and video.twimg.com, so it
 * cannot be used as a general-purpose proxy.
 */

// Sites allowed to call /info from the browser. Add your own domain here if
// you host the downloader page somewhere else.
const ALLOWED_ORIGINS = [
  'https://kakahaja07.github.io',
  'http://localhost:8766',
];

const EMBED_API = 'https://cdn.syndication.twimg.com/tweet-result';
const VIDEO_HOST = 'video.twimg.com';
const POST_ID = /(?:x|twitter)\.com\/[^/]+\/status(?:es)?\/(\d{1,25})|^(\d{1,25})$/i;

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') ?? '';
    const cors = ALLOWED_ORIGINS.includes(origin)
      ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
      : {};

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: { ...cors, 'Access-Control-Allow-Methods': 'GET' } });
    }
    if (request.method !== 'GET') return json({ error: 'Only GET is supported.' }, 405, cors);

    try {
      if (url.pathname === '/info') return await info(url, cors);
      if (url.pathname === '/download') return await download(url);
      return json({ ok: true, routes: ['/info?url=', '/download?src='] }, 200, cors);
    } catch {
      return json({ error: 'Something went wrong. Try again in a moment.' }, 502, cors);
    }
  },
};

async function info(url, cors) {
  const input = (url.searchParams.get('url') ?? '').trim();
  const match = input.match(POST_ID);
  const id = match?.[1] ?? match?.[2];
  if (!id) return json({ error: 'Paste a link to a post, like x.com/name/status/123…' }, 400, cors);

  // The embed API wants a token derived from the post id (same as X's embeds).
  const token = ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '');
  const res = await fetch(`${EMBED_API}?id=${id}&lang=en&token=${token}`, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    cf: { cacheTtl: 300 },
  });
  if (res.status === 404) return json({ error: 'Post not found. It may be deleted or private.' }, 404, cors);
  if (!res.ok) return json({ error: 'X did not return this post. Try again shortly.' }, 502, cors);

  const post = await res.json();
  if (post.__typename === 'TweetTombstone') {
    return json({ error: 'This post is unavailable (deleted, private or age-restricted).' }, 404, cors);
  }

  const videos = (post.mediaDetails ?? [])
    .filter((m) => m.type === 'video' || m.type === 'animated_gif')
    .map((m, i) => ({
      index: i + 1,
      kind: m.type === 'animated_gif' ? 'gif' : 'video',
      poster: m.media_url_https,
      durationMs: m.video_info?.duration_millis ?? null,
      files: (m.video_info?.variants ?? [])
        .filter((v) => v.content_type === 'video/mp4')
        .map((v) => ({
          url: v.url,
          bitrate: v.bitrate ?? 0,
          resolution: v.url.match(/\/(\d+x\d+)\//)?.[1] ?? null,
        }))
        .sort((a, b) => b.bitrate - a.bitrate),
    }))
    .filter((v) => v.files.length);

  if (!videos.length) return json({ error: 'This post has no video or GIF.' }, 404, cors);

  return json(
    {
      id,
      text: post.text ?? '',
      author: { name: post.user?.name ?? '', handle: post.user?.screen_name ?? '' },
      videos,
    },
    200,
    { ...cors, 'Cache-Control': 'public, max-age=300' },
  );
}

async function download(url) {
  let src;
  try {
    src = new URL(url.searchParams.get('src') ?? '');
  } catch {
    return new Response('Bad video link.', { status: 400 });
  }
  // Only X's own video host, over HTTPS. Anything else is refused.
  if (src.protocol !== 'https:' || src.hostname !== VIDEO_HOST) {
    return new Response('Only video.twimg.com links are allowed.', { status: 403 });
  }

  const upstream = await fetch(src.toString(), { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!upstream.ok || !upstream.body) return new Response('Video not available.', { status: 502 });

  const name = (url.searchParams.get('name') ?? 'x-video.mp4').replace(/[^\w.-]+/g, '_').slice(0, 80);
  const headers = new Headers({
    'Content-Type': 'video/mp4',
    'Content-Disposition': `attachment; filename="${name.endsWith('.mp4') ? name : `${name}.mp4`}"`,
    'Cache-Control': 'public, max-age=3600',
  });
  const length = upstream.headers.get('Content-Length');
  if (length) headers.set('Content-Length', length);
  return new Response(upstream.body, { status: 200, headers });
}

function json(body, status, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}
