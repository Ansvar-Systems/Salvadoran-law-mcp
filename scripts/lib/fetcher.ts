/**
 * Rate-limited HTTP client for Salvadoran Law (el-salvador.justia.com)
 *
 * - 500ms minimum delay between requests
 * - User-Agent header identifying the MCP
 * - Fetches Justia HTML law pages
 * - No auth needed (public law database)
 */

const USER_AGENT = 'salvadoran-law-mcp/1.0 (https://github.com/Ansvar-Systems/salvadoran-law-mcp; hello@ansvar.ai)';
const MIN_DELAY_MS = 500;

let lastRequestTime = 0;

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_DELAY_MS) {
    await new Promise(resolve => setTimeout(resolve, MIN_DELAY_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

export interface FetchResult {
  status: number;
  body: string;
  contentType: string;
  url: string;
}

export async function fetchWithRateLimit(url: string, maxRetries = 3): Promise<FetchResult> {
  await rateLimit();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html, */*',
        'Accept-Language': 'es,en;q=0.5',
      },
      redirect: 'follow',
    });

    if (response.status === 429 || response.status >= 500) {
      if (attempt < maxRetries) {
        const backoff = Math.pow(2, attempt + 1) * 1000;
        console.log(`  HTTP ${response.status} for ${url}, retrying in ${backoff}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoff));
        continue;
      }
    }

    const body = await response.text();
    return {
      status: response.status,
      body,
      contentType: response.headers.get('content-type') ?? '',
      url: response.url,
    };
  }

  throw new Error(`Failed to fetch ${url} after ${maxRetries} retries`);
}
