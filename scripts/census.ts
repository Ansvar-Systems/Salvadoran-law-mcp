#!/usr/bin/env tsx
/**
 * Salvadoran Law MCP -- Census Script
 *
 * Scrapes el-salvador.justia.com/nacionales/leyes/ to enumerate Salvadoran laws.
 * Justia provides a reliable, structured index of Salvadoran legislation
 * with links to full-text HTML pages.
 *
 * Source: https://el-salvador.justia.com/nacionales/leyes/
 * Language: Spanish (civil law)
 *
 * Usage:
 *   npx tsx scripts/census.ts
 *   npx tsx scripts/census.ts --limit 100
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../data');
const CENSUS_PATH = path.join(DATA_DIR, 'census.json');

const BASE_URL = 'https://el-salvador.justia.com';
const LAWS_INDEX = `${BASE_URL}/nacionales/leyes/`;

const USER_AGENT = 'salvadoran-law-mcp/1.0 (https://github.com/Ansvar-Systems/salvadoran-law-mcp; hello@ansvar.ai)';
const MIN_DELAY_MS = 500;

/* ---------- Types ---------- */

interface RawLawEntry {
  title: string;
  url: string;
  year: string;
  normType: string;
}

/* ---------- HTTP ---------- */

async function fetchPage(url: string): Promise<string | null> {
  await new Promise(resolve => setTimeout(resolve, MIN_DELAY_MS));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html, */*',
        'Accept-Language': 'es,en;q=0.5',
      },
      redirect: 'follow',
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (response.status !== 200) {
      console.log(`  HTTP ${response.status} for ${url}`);
      return null;
    }
    return response.text();
  } catch (err) {
    clearTimeout(timeout);
    console.log(`  Error: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/* ---------- Parsing ---------- */

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&aacute;/gi, '\u00e1').replace(/&eacute;/gi, '\u00e9')
    .replace(/&iacute;/gi, '\u00ed').replace(/&oacute;/gi, '\u00f3')
    .replace(/&uacute;/gi, '\u00fa').replace(/&ntilde;/gi, '\u00f1')
    .replace(/&Aacute;/gi, '\u00c1').replace(/&Eacute;/gi, '\u00c9')
    .replace(/&Iacute;/gi, '\u00cd').replace(/&Oacute;/gi, '\u00d3')
    .replace(/&Uacute;/gi, '\u00da').replace(/&Ntilde;/gi, '\u00d1')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)));
}

function slugify(text: string): string {
  return text.toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '').substring(0, 60);
}

function classifyNormType(title: string): string {
  const t = title.toLowerCase();
  if (/\bdecreto[\s-]*legislativo\b/.test(t)) return 'decreto-legislativo';
  if (/\bdecreto[\s-]*ley\b/.test(t)) return 'decreto-ley';
  if (/\bconstituci[\u00f3o]n\b/.test(t)) return 'constitucion';
  if (/\bc[\u00f3o]digo\b/.test(t)) return 'codigo';
  if (/\bley\b/.test(t)) return 'ley';
  if (/\bdecreto\b/.test(t)) return 'decreto';
  if (/\bacuerdo\b/.test(t)) return 'acuerdo';
  if (/\bresoluci[\u00f3o]n\b/.test(t)) return 'resolucion';
  return 'other';
}

function extractYear(text: string): string {
  const match = text.match(/\b(19\d{2}|20[0-2]\d)\b/);
  return match ? match[1] : '';
}

function parseLawIndex(html: string): RawLawEntry[] {
  const entries: RawLawEntry[] = [];
  const seen = new Set<string>();

  const linkRe = /<a\s+[^>]*href="([^"]*\/nacionales\/leyes\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = linkRe.exec(html)) !== null) {
    let href = match[1];
    const rawTitle = stripHtml(match[2]).trim();

    if (!rawTitle || rawTitle.length < 3) continue;
    if (/^(ver|m\u00e1s|siguiente|anterior|inicio)$/i.test(rawTitle)) continue;

    if (!href.startsWith('http')) {
      href = `${BASE_URL}${href.startsWith('/') ? '' : '/'}${href}`;
    }

    if (href === LAWS_INDEX || href === `${LAWS_INDEX}/`) continue;
    if (seen.has(href)) continue;
    seen.add(href);

    const title = decodeHtmlEntities(rawTitle);
    entries.push({ title, url: href, year: extractYear(title) || extractYear(href), normType: classifyNormType(title) });
  }

  return entries;
}

function extractSubPages(html: string): string[] {
  const pages: string[] = [];
  const seen = new Set<string>();

  // Year-based sub-pages
  const yearRe = /<a\s+[^>]*href="([^"]*\/nacionales\/leyes\/\d{4}\/[^"]*)"[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = yearRe.exec(html)) !== null) {
    let href = match[1];
    if (!href.startsWith('http')) href = `${BASE_URL}${href.startsWith('/') ? '' : '/'}${href}`;
    if (!seen.has(href)) { seen.add(href); pages.push(href); }
  }

  // Pagination
  const pageRe = /href="([^"]*\?page=\d+[^"]*)"/gi;
  while ((match = pageRe.exec(html)) !== null) {
    let href = match[1];
    if (!href.startsWith('http')) href = `${BASE_URL}${href.startsWith('/') ? '' : '/'}${href}`;
    if (!seen.has(href)) { seen.add(href); pages.push(href); }
  }

  return pages;
}

function parseArgs(): { limit: number | null } {
  const args = process.argv.slice(2);
  let limit: number | null = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) { limit = parseInt(args[i + 1], 10); i++; }
  }
  return { limit };
}

/* ---------- Main ---------- */

async function main(): Promise<void> {
  const { limit } = parseArgs();

  console.log('Salvadoran Law MCP -- Census');
  console.log('============================\n');
  console.log('  Source: el-salvador.justia.com/nacionales/leyes/');
  console.log('  Language: Spanish (civil law)');
  if (limit) console.log(`  --limit ${limit}`);
  console.log('');

  fs.mkdirSync(DATA_DIR, { recursive: true });

  console.log('  Step 1: Fetching main law index...');
  const mainHtml = await fetchPage(LAWS_INDEX);

  if (!mainHtml) {
    console.error('  ERROR: Could not fetch main index page');
    process.exit(1);
  }

  const allEntries: RawLawEntry[] = [];
  const mainEntries = parseLawIndex(mainHtml);
  console.log(`    Found ${mainEntries.length} entries on main page`);
  allEntries.push(...mainEntries);

  const subPages = extractSubPages(mainHtml);
  if (subPages.length > 0) {
    console.log(`\n  Step 2: Following ${subPages.length} sub-pages...`);
    for (const pageUrl of subPages) {
      if (limit && allEntries.length >= limit) break;
      process.stdout.write(`    ${pageUrl.replace(BASE_URL, '')}...`);
      const html = await fetchPage(pageUrl);
      if (html) {
        const entries = parseLawIndex(html);
        const newEntries = entries.filter(e => !allEntries.some(a => a.url === e.url));
        allEntries.push(...newEntries);
        console.log(` ${entries.length} entries (${newEntries.length} new)`);
        const morePages = extractSubPages(html).filter(p => !subPages.includes(p));
        subPages.push(...morePages);
      } else { console.log(' failed'); }
    }
  }

  const seenUrls = new Map<string, RawLawEntry>();
  for (const entry of allEntries) {
    const key = entry.url.toLowerCase();
    if (!seenUrls.has(key)) seenUrls.set(key, entry);
  }

  const unique = Array.from(seenUrls.values());
  const finalEntries = limit ? unique.slice(0, limit) : unique;

  const laws = finalEntries.map((entry) => ({
    id: `sv-${slugify(entry.title)}`,
    title: entry.title,
    identifier: entry.title,
    url: entry.url,
    status: 'in_force' as const,
    category: 'act' as const,
    classification: 'ingestable' as const,
    ingested: false,
    provision_count: 0,
    ingestion_date: null as string | null,
    issued_date: entry.year ? `${entry.year}-01-01` : '',
    norm_type: entry.normType,
  }));

  const normTypeCounts: Record<string, number> = {};
  for (const entry of finalEntries) {
    normTypeCounts[entry.normType] = (normTypeCounts[entry.normType] || 0) + 1;
  }

  const census = {
    schema_version: '2.0', jurisdiction: 'SV', jurisdiction_name: 'El Salvador',
    portal: 'el-salvador.justia.com', portal_url: LAWS_INDEX,
    census_date: new Date().toISOString().split('T')[0],
    agent: 'salvadoran-law-mcp/census.ts',
    summary: { total_laws: laws.length, ingestable: laws.length, ocr_needed: 0, inaccessible: 0, excluded: 0 },
    breakdown: { by_norm_type: normTypeCounts },
    laws,
  };

  fs.writeFileSync(CENSUS_PATH, JSON.stringify(census, null, 2));

  console.log('\n==================================================');
  console.log('CENSUS COMPLETE');
  console.log('==================================================');
  console.log(`  Total laws discovered:  ${laws.length}`);
  console.log(`  All ingestable (HTML):  ${laws.length}`);
  console.log('');
  console.log('  By norm type:');
  for (const [type, count] of Object.entries(normTypeCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${type}: ${count}`);
  }
  console.log(`\n  Output: ${CENSUS_PATH}`);
}

main().catch(error => { console.error('Fatal error:', error); process.exit(1); });
