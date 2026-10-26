# Video downloader Worker

The [Twitter video downloader](https://kakahaja07.github.io/xvision/tools/video-downloader.html) needs a tiny helper, because X only lets its own embed site read video data from a browser. This folder holds that helper: a free [Cloudflare Worker](https://workers.cloudflare.com/).

It does two things and nothing else:

- `GET /info?url=<post link>` looks up a public post and returns its MP4 files.
- `GET /download?src=<video url>` streams one MP4 back as a download.

It only ever contacts `cdn.syndication.twimg.com` and `video.twimg.com`, so it can't be misused as an open proxy, and it stores nothing.

## Set it up (about 5 minutes, free)

### 1. Create a free Cloudflare account

Go to **https://dash.cloudflare.com/sign-up** and sign up. No credit card or domain needed.

### 2. Create the Worker

1. In the dashboard sidebar, open **Compute (Workers)** → **Workers & Pages**.
2. Click **Create** → **Create Worker** (choose "Start with Hello World" if asked).
3. Name it `xvision-video` and click **Deploy**.

### 3. Paste the code

1. On the new Worker's page, click **Edit code**.
2. Delete everything in the editor.
3. Copy all of [`xvision-video-worker.js`](xvision-video-worker.js) and paste it in.
4. Click **Deploy**.

### 4. Copy the Worker's address

It looks like:

```
https://xvision-video.<your-subdomain>.workers.dev
```

Open it in a browser. You should see `{"ok":true,...}`.

### 5. Connect the downloader page

1. In this repo, open [`assets/downloader-config.js`](../assets/downloader-config.js) and click the pencil (Edit) icon.
2. Paste your address between the quotes:

   ```js
   window.XV_WORKER_URL = 'https://xvision-video.<your-subdomain>.workers.dev';
   ```

3. Click **Commit changes**.

After a minute, GitHub Pages updates and the downloader works.

### 6. Test it

Open the downloader page, paste a link to a public post with a video, click **Get video**, and download a quality.

## If you host the page somewhere else

The Worker only answers pages on the domains in `ALLOWED_ORIGINS` at the top of the code. If you move the site to your own domain, add it there and deploy again:

```js
const ALLOWED_ORIGINS = [
  'https://kakahaja07.github.io',
  'https://your-domain.com',
];
```

## Limits and notes

- Cloudflare's free plan allows 100,000 Worker requests a day, which is plenty for a personal tool.
- Only public posts work. Private, deleted and age-restricted posts can't be downloaded.
- Only download videos you made or have permission to use, and respect creators' rights.
- Keep this tool on the website. Don't add video downloading to the Chrome extension: the Chrome Web Store does not allow extensions that help download media from other sites.
