#!/usr/bin/env tsx
/**
 * Salvadoran Law MCP -- Census Script
 *
 * Scrapes el-salvador.justia.com to enumerate national laws, codes,
 * dispositions, and regulations.
 *
 * Pipeline:
 *   1. Fetch /nacionales/leyes/          (laws -- ~383 entries)
 *   2. Fetch /nacionales/codigos/        (codes -- ~12 entries)
 *   3. Fetch /nacionales/disposiciones/  (dispositions -- ~12 entries)
 *   4. Fetch /nacionales/regulaciones/   (regulations -- ~4 entries)
 *   5. Deduplicate and write data/census.json
 *
 * Sources:
 *   - Primary:   https://el-salvador.justia.com/nacionales/leyes/
 *   - Secondary: https://el-salvador.justia.com/nacionales/codigos/
 *   - Tertiary:  https://el-salvador.justia.com/nacionales/disposiciones/
 *   - Plus:      https://el-salvador.justia.com/nacionales/regulaciones/
 *
 * Usage:
 *   npx tsx scripts/census.ts
 *   npx tsx scripts/census.ts --limit 50
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../data');
const CENSUS_PATH = path.join(DATA_DIR, 'census.json');

const JUSTIA_BASE = 'https://el-salvador.justia.com';

const USER_AGENT =
  'salvadoran-law-mcp/1.0 (https://github.com/Ansvar-Systems/Salvadoran-law-mcp; hello@ansvar.ai)';

const MIN_DELAY_MS = 500;

/* ---------- Types ---------- */

interface RawLawEntry {
  title: string;
  url: string;
  slug: string;
  category: string;
  date: string;
  source: 'justia';
}

/* ---------- HTTP Helpers ---------- */

let lastRequestTime = 0;

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_DELAY_MS) {
    await new Promise(resolve => setTimeout(resolve, MIN_DELAY_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

async function fetchPage(url: string): Promise<string> {
  await rateLimit();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html, */*',
        'Accept-Language': 'es-SV,es;q=0.9,en;q=0.5',
      },
      redirect: 'follow',
      signal: controller.signal,
    });

    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

/* ---------- Parsing Helpers ---------- */

function stripTags(text: string): string {
  return text.replace(/<[^>]*>/g, '');
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#209;/g, 'N').replace(/&#241;/g, 'n')
    .replace(/&#193;/g, 'A').replace(/&#225;/g, 'a')
    .replace(/&#201;/g, 'E').replace(/&#233;/g, 'e')
    .replace(/&#205;/g, 'I').replace(/&#237;/g, 'i')
    .replace(/&#211;/g, 'O').replace(/&#243;/g, 'o')
    .replace(/&#218;/g, 'U').replace(/&#250;/g, 'u')
    .replace(/&#252;/g, 'u').replace(/&#220;/g, 'U')
    .replace(/&aacute;/g, 'a').replace(/&eacute;/g, 'e')
    .replace(/&iacute;/g, 'i').replace(/&oacute;/g, 'o')
    .replace(/&uacute;/g, 'u').replace(/&ntilde;/g, 'n')
    .replace(/&Aacute;/g, 'A').replace(/&Eacute;/g, 'E')
    .replace(/&Iacute;/g, 'I').replace(/&Oacute;/g, 'O')
    .replace(/&Uacute;/g, 'U').replace(/&Ntilde;/g, 'N')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)));
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60);
}

function parseArgs(): { limit: number | null } {
  const args = process.argv.slice(2);
  let limit: number | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    }
  }

  return { limit };
}

/* ---------- Justia Parsing ---------- */

/**
 * Justia El Salvador category pages list laws as anchor tags:
 *   <a href="/nacionales/leyes/{slug}/">{Title}</a>
 *   <a href="/nacionales/leyes/{slug}/gdoc/">{Title}</a>
 *   <a href="/nacionales/codigos/{slug}/">{Title}</a>
 *   <a href="/nacionales/disposiciones/{slug}/">{Title}</a>
 *   <a href="/nacionales/regulaciones/{slug}/">{Title}</a>
 *
 * The listing pages show all entries on a single page (no pagination).
 */
function parseJustiaListingPage(
  html: string,
  sectionPath: string,
  category: string,
): RawLawEntry[] {
  const entries: RawLawEntry[] = [];
  const seen = new Set<string>();

  const escapedPath = sectionPath.replace(/\//g, '\\/');
  const linkRe = new RegExp(
    `<a\\s[^>]*href=["'](${escapedPath}([^"'/]+)(?:\\/[^"']*)?)["'][^>]*>([\\s\\S]*?)<\\/a>`,
    'gi',
  );
  let match: RegExpExecArray | null;

  while ((match = linkRe.exec(html)) !== null) {
    const href = match[1];
    const slug = match[2];
    const rawTitle = stripTags(match[3]).trim();

    if (!rawTitle || rawTitle.length < 5) continue;
    if (!slug || slug.length < 2) continue;
    if (seen.has(slug)) continue;
    seen.add(slug);

    const title = decodeEntities(rawTitle);
    const url = `${JUSTIA_BASE}${href}`;

    entries.push({
      title,
      url,
      slug,
      category,
      date: '',
      source: 'justia',
    });
  }

  return entries;
}

/**
 * Fetch all Justia category pages and combine results.
 */
async function censusFromJustia(limit: number | null): Promise<RawLawEntry[]> {
  const allEntries: RawLawEntry[] = [];

  const categories: Array<{ path: string; label: string; category: string }> = [
    { path: '/nacionales/leyes/', label: 'Laws', category: 'leyes' },
    { path: '/nacionales/codigos/', label: 'Codes', category: 'codigos' },
    { path: '/nacionales/disposiciones/', label: 'Dispositions', category: 'disposiciones' },
    { path: '/nacionales/regulaciones/', label: 'Regulations', category: 'regulaciones' },
  ];

  for (const { path: sectionPath, label, category } of categories) {
    const url = `${JUSTIA_BASE}${sectionPath}`;
    process.stdout.write(`  Fetching ${label} (${url})... `);

    try {
      const html = await fetchPage(url);
      const entries = parseJustiaListingPage(html, sectionPath, category);
      allEntries.push(...entries);
      console.log(`${entries.length} entries`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`FAILED: ${msg}`);
    }

    if (limit && allEntries.length >= limit) break;
  }

  return allEntries;
}

/* ---------- Main ---------- */

async function main(): Promise<void> {
  const { limit } = parseArgs();

  console.log('Salvadoran Law MCP -- Census');
  console.log('============================\n');
  console.log('  Primary: el-salvador.justia.com/nacionales/ (leyes, codigos,');
  console.log('           disposiciones, regulaciones)');
  if (limit) console.log(`  --limit ${limit}`);
  console.log('');

  fs.mkdirSync(DATA_DIR, { recursive: true });

  // Step 1: Primary source -- Justia
  console.log('[1/1] Justia (primary)\n');
  let allEntries = await censusFromJustia(limit);
  console.log(`\n  Justia total: ${allEntries.length} entries\n`);

  // Deduplicate by slug
  const deduped = new Map<string, RawLawEntry>();
  for (const entry of allEntries) {
    const key = entry.slug || slugify(entry.title);
    if (!deduped.has(key)) {
      deduped.set(key, entry);
    }
  }
  allEntries = Array.from(deduped.values());

  // Apply limit
  if (limit && allEntries.length > limit) {
    allEntries = allEntries.slice(0, limit);
  }

  // Build census entries
  const laws = allEntries.map((entry) => {
    const id = `sv-${entry.category}-${slugify(entry.title).substring(0, 50)}`;

    return {
      id,
      title: entry.title,
      identifier: entry.title,
      url: entry.url,
      status: 'in_force' as const,
      category: mapCategory(entry.category),
      classification: 'ingestable' as const,
      ingested: false,
      provision_count: 0,
      ingestion_date: null as string | null,
      issued_date: entry.date || '',
      portal_slug: entry.slug,
    };
  });

  const ingestable = laws.filter(l => l.classification === 'ingestable').length;
  const inaccessible = laws.filter(l => l.classification === 'inaccessible').length;

  const census = {
    schema_version: '2.0',
    jurisdiction: 'SV',
    jurisdiction_name: 'El Salvador',
    portal: 'el-salvador.justia.com',
    census_date: new Date().toISOString().split('T')[0],
    agent: 'salvadoran-law-mcp/census.ts',
    summary: {
      total_laws: laws.length,
      ingestable,
      ocr_needed: 0,
      inaccessible,
      excluded: 0,
      by_category: {
        leyes: allEntries.filter(e => e.category === 'leyes').length,
        codigos: allEntries.filter(e => e.category === 'codigos').length,
        disposiciones: allEntries.filter(e => e.category === 'disposiciones').length,
        regulaciones: allEntries.filter(e => e.category === 'regulaciones').length,
      },
    },
    laws,
  };

  fs.writeFileSync(CENSUS_PATH, JSON.stringify(census, null, 2));

  console.log('\n==================================================');
  console.log('CENSUS COMPLETE');
  console.log('==================================================');
  console.log(`  Portal:          el-salvador.justia.com`);
  console.log(`  Total laws:      ${laws.length}`);
  console.log(`  Ingestable:      ${ingestable}`);
  console.log(`  Inaccessible:    ${inaccessible}`);
  console.log(`\n  By category:`);
  console.log(`    leyes:          ${census.summary.by_category.leyes}`);
  console.log(`    codigos:        ${census.summary.by_category.codigos}`);
  console.log(`    disposiciones:  ${census.summary.by_category.disposiciones}`);
  console.log(`    regulaciones:   ${census.summary.by_category.regulaciones}`);
  console.log(`\n  Output: ${CENSUS_PATH}`);
}

function mapCategory(category: string): 'act' | 'code' | 'decree' | 'regulation' {
  switch (category) {
    case 'codigos': return 'code';
    case 'regulaciones': return 'regulation';
    case 'disposiciones': return 'decree';
    default: return 'act';
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
