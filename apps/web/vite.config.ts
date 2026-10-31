import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import https from 'node:https';
import path from 'node:path';

const gifSearchCache = new Map<string, { timestamp: number; data: any[] }>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

function cleanHtmlEntities(str: string): string {
  return str
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function tenorGifSearchPlugin(): Plugin {
  const handleRequest = async (req: any, res: any, next: () => void) => {
    if (!req.url?.startsWith('/api/v1/gifs/search')) {
      return next();
    }

    try {
      const urlObj = new URL(req.url, 'http://localhost');
      const q = (urlObj.searchParams.get('q') || '').trim();
      const cacheKey = q.toLowerCase() || '__trending__';

      // 1. Check in-memory cache
      const cached = gifSearchCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(JSON.stringify(cached.data));
        return;
      }

      // 2. Fetch from Google Tenor
      const targetUrl = q
        ? `https://tenor.com/search/${encodeURIComponent(q.toLowerCase().replace(/\s+/g, '-'))}-gifs`
        : 'https://tenor.com';

      const fetchGifs = () =>
        new Promise<any[]>((resolve) => {
          const request = https.get(
            targetUrl,
            {
              headers: {
                'User-Agent':
                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
              },
              timeout: 6000,
            },
            (remoteRes) => {
              let html = '';
              remoteRes.on('data', (chunk) => (html += chunk));
              remoteRes.on('end', () => {
                const results: any[] = [];
                const seen = new Set<string>();

                // Primary extraction: img with src and alt
                const imgRegex =
                  /<img\b[^>]*\bsrc=["'](https:\/\/media\.tenor\.com\/[a-zA-Z0-9_-]+\/([a-zA-Z0-9_-]+)\.gif)["'][^>]*\balt=["']([^"']*)["']/gi;
                let m: RegExpExecArray | null;

                while ((m = imgRegex.exec(html)) !== null) {
                  const fullUrl = m[1];
                  const rawName = m[2] || 'gif';
                  const rawAlt = m[3] ? cleanHtmlEntities(m[3]) : '';

                  if (!seen.has(fullUrl)) {
                    seen.add(fullUrl);
                    const fallbackTitle = rawName
                      .replace(/[-_]+/g, ' ')
                      .replace(/\b\w/g, (c) => c.toUpperCase());
                    const title = rawAlt.length > 3 ? rawAlt : fallbackTitle;

                    results.push({
                      id: `tenor-${Math.random().toString(36).substring(2, 9)}`,
                      title,
                      category: 'trending',
                      url: fullUrl,
                      tags: [q, ...rawName.split(/[-_]+/)],
                    });
                  }
                }

                // Fallback extraction: any media.tenor.com gif link
                if (results.length === 0) {
                  const rawRegex =
                    /https:\/\/media\.tenor\.com\/[a-zA-Z0-9_-]+\/([a-zA-Z0-9_-]+)\.gif/g;
                  let rawMatch: RegExpExecArray | null;

                  while ((rawMatch = rawRegex.exec(html)) !== null) {
                    const fullUrl = rawMatch[0];
                    const rawName = rawMatch[1] || 'gif';
                    if (!seen.has(fullUrl)) {
                      seen.add(fullUrl);
                      const title = rawName
                        .replace(/[-_]+/g, ' ')
                        .replace(/\b\w/g, (c) => c.toUpperCase());
                      results.push({
                        id: `tenor-${Math.random().toString(36).substring(2, 9)}`,
                        title,
                        category: 'trending',
                        url: fullUrl,
                        tags: [q, ...rawName.split(/[-_]+/)],
                      });
                    }
                  }
                }

                resolve(results);
              });
            }
          );

          request.on('error', () => resolve([]));
          request.on('timeout', () => {
            request.destroy();
            resolve([]);
          });
        });

      const results = await fetchGifs();
      if (results.length > 0) {
        gifSearchCache.set(cacheKey, { timestamp: Date.now(), data: results });
      }

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.end(JSON.stringify(results));
    } catch (err) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'Search failed' }));
    }
  };

  return {
    name: 'tenor-gif-search-plugin',
    configureServer(server) {
      server.middlewares.use(handleRequest);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handleRequest);
    },
  };
}

export default defineConfig(({ mode }) => {
  const rootDir = path.resolve(__dirname, '../..');
  // Merge env from root workspace and local apps/web directory
  const env = { ...loadEnv(mode, rootDir, ''), ...loadEnv(mode, process.cwd(), '') };
  const appName = env.VITE_APP_NAME || env.APP_NAME || 'IndiChat';

  return {
    base: './',
    envDir: rootDir,
    define: {
      'import.meta.env.VITE_APP_NAME': JSON.stringify(appName),
    },
    plugins: [
      react(),
      tenorGifSearchPlugin(),
      {
        name: 'html-transform-app-name',
        transformIndexHtml(html: string) {
          return html
            .replace(/%VITE_APP_NAME%/g, appName)
            .replace(/WhatsApp Web/g, `${appName} Web`)
            .replace(/WhatsApp/g, appName);
        },
      },
    ],
    server: {
      port: 5174,
      host: true,
      proxy: {
        '/api': {
          target: 'http://localhost:8080',
          changeOrigin: true,
        },
        '/ws': {
          target: 'ws://localhost:8080',
          ws: true,
          changeOrigin: true,
        },
      },
    },
  };
});

