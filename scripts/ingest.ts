#!/usr/bin/env tsx
/**
 * Salvadoran Law MCP -- Census-Driven Ingestion Pipeline
 *
 * Reads data/census.json and fetches + parses every ingestable law
 * from el-salvador.justia.com (HTML full-text pages).
 *
 * Pipeline per law:
 *   1. Fetch HTML page from el-salvador.justia.com
 *   2. Extract law text from the page body
 *   3. Parse articles, definitions, chapter structure (Spanish civil law)
 *   4. Write seed JSON for build-db.ts
 *
 * Features:
 *   - Resume support: skips laws that already have a seed JSON file
 *   - Census update: writes provision counts + ingestion dates back to census.json
 *   - Checkpoint: saves census every 50 laws
 *   - Rate limiting: 500ms minimum between requests
 *
 * Usage:
 *   npm run ingest                    # Full census-driven ingestion
 *   npm run ingest -- --limit 5       # Test with 5 laws
 *   npm run ingest -- --force         # Re-ingest even if seed exists
 *
 * Data source: el-salvador.justia.com
 * Format: HTML (full-text law pages)
 * Language: Spanish
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { parseSVLawHtml, type ActIndexEntry, type ParsedAct } from './lib/parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_DIR = path.resolve(__dirname, '../data/source');
const SEED_DIR = path.resolve(__dirname, '../data/seed');
const CENSUS_PATH = path.resolve(__dirname, '../data/census.json');

const USER_AGENT = 'salvadoran-law-mcp/1.0 (https://github.com/Ansvar-Systems/salvadoran-law-mcp; hello@ansvar.ai)';
const MIN_DELAY_MS = 500;

/* ---------- Types ---------- */

interface CensusLawEntry {
  id: string;
  title: string;
  identifier: string;
  url: string;
  status: 'in_force' | 'amended' | 'repealed';
  category: 'act';
  classification: 'ingestable' | 'excluded' | 'inaccessible';
  ingested: boolean;
  provision_count: number;
  ingestion_date: string | null;
  issued_date?: string;
  norm_type?: string;
}

interface CensusFile {
  schema_version: string;
  jurisdiction: string;
  jurisdiction_name: string;
  portal: string;
  census_date: string;
  agent: string;
  summary: {
    total_laws: number;
    ingestable: number;
    ocr_needed: number;
    inaccessible: number;
    excluded: number;
  };
  laws: CensusLawEntry[];
}

/* ---------- Helpers ---------- */

function parseArgs(): { limit: number | null; force: boolean } {
  const args = process.argv.slice(2);
  let limit: number | null = null;
  let force = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--force') {
      force = true;
    }
  }

  return { limit, force };
}

function censusToActEntry(law: CensusLawEntry): ActIndexEntry {
  const shortName = law.identifier || (law.title.length > 30 ? law.title.substring(0, 27) + '...' : law.title);

  return {
    id: law.id,
    title: law.title,
    titleEn: law.title,
    shortName,
    status: law.status === 'in_force' ? 'in_force' : law.status === 'amended' ? 'amended' : 'repealed',
    issuedDate: law.issued_date ?? '',
    inForceDate: law.issued_date ?? '',
    url: law.url,
  };
}

/**
 * Fetch the HTML content of a Justia law page.
 * Extracts the main content body (between article/main tags or the main content div).
 */
async function fetchLawHtml(url: string): Promise<string | null> {
  await new Promise(resolve => setTimeout(resolve, MIN_DELAY_MS));

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

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
      console.log(` HTTP ${response.status}`);
      return null;
    }

    const html = await response.text();

    // Extract main content area (Justia uses <article> or specific content divs)
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    if (articleMatch) return articleMatch[1];

    const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    if (mainMatch) return mainMatch[1];

    // Fallback: extract content between known markers
    const contentMatch = html.match(/class="(?:entry-content|post-content|content-area|field-item)"[^>]*>([\s\S]*?)<\/(?:div|article|section)>/i);
    if (contentMatch) return contentMatch[1];

    // Last resort: return the body
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    return bodyMatch ? bodyMatch[1] : html;
  } catch (err) {
    console.log(` Error: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/* ---------- Census I/O ---------- */

function writeCensus(census: CensusFile, censusMap: Map<string, CensusLawEntry>): void {
  census.laws = Array.from(censusMap.values()).sort((a, b) =>
    a.title.localeCompare(b.title),
  );

  census.summary.total_laws = census.laws.length;
  census.summary.ingestable = census.laws.filter(l => l.classification === 'ingestable').length;
  census.summary.inaccessible = census.laws.filter(l => l.classification === 'inaccessible').length;
  census.summary.excluded = census.laws.filter(l => l.classification === 'excluded').length;

  fs.writeFileSync(CENSUS_PATH, JSON.stringify(census, null, 2));
}

/* ---------- Main ---------- */

async function main(): Promise<void> {
  const { limit, force } = parseArgs();

  console.log('Salvadoran Law MCP -- Ingestion Pipeline (Census-Driven)');
  console.log('========================================================\n');
  console.log('  Source: el-salvador.justia.com');
  console.log('  Format: HTML (full-text law pages)');
  console.log('  Language: Spanish');

  if (limit) console.log(`  --limit ${limit}`);
  if (force) console.log(`  --force (re-ingest all)`);

  if (!fs.existsSync(CENSUS_PATH)) {
    console.error(`\nERROR: Census file not found at ${CENSUS_PATH}`);
    console.error('Run "npx tsx scripts/census.ts" first.');
    process.exit(1);
  }

  const census: CensusFile = JSON.parse(fs.readFileSync(CENSUS_PATH, 'utf-8'));
  const ingestable = census.laws.filter(l => l.classification === 'ingestable');
  const acts = limit ? ingestable.slice(0, limit) : ingestable;

  console.log(`\n  Census: ${census.summary.total_laws} total, ${ingestable.length} ingestable`);
  console.log(`  Processing: ${acts.length} laws\n`);

  fs.mkdirSync(SOURCE_DIR, { recursive: true });
  fs.mkdirSync(SEED_DIR, { recursive: true });

  let processed = 0;
  let ingested = 0;
  let skipped = 0;
  let failed = 0;
  let totalProvisions = 0;
  let totalDefinitions = 0;

  const censusMap = new Map<string, CensusLawEntry>();
  for (const law of census.laws) {
    censusMap.set(law.id, law);
  }

  const today = new Date().toISOString().split('T')[0];

  for (const law of acts) {
    const act = censusToActEntry(law);
    const sourceFile = path.join(SOURCE_DIR, `${act.id}.html`);
    const seedFile = path.join(SEED_DIR, `${act.id}.json`);

    // Resume support
    if (!force && fs.existsSync(seedFile)) {
      try {
        const existing = JSON.parse(fs.readFileSync(seedFile, 'utf-8')) as ParsedAct;
        const provCount = existing.provisions?.length ?? 0;
        const defCount = existing.definitions?.length ?? 0;
        totalProvisions += provCount;
        totalDefinitions += defCount;

        const entry = censusMap.get(law.id);
        if (entry) {
          entry.ingested = true;
          entry.provision_count = provCount;
          entry.ingestion_date = entry.ingestion_date ?? today;
        }

        skipped++;
        processed++;
        continue;
      } catch {
        // Corrupt seed file, re-ingest
      }
    }

    try {
      // Fetch HTML
      let htmlContent: string | null = null;

      if (fs.existsSync(sourceFile) && !force) {
        htmlContent = fs.readFileSync(sourceFile, 'utf-8');
        console.log(`  [${processed + 1}/${acts.length}] Using cached ${act.id}`);
      } else {
        process.stdout.write(`  [${processed + 1}/${acts.length}] Fetching ${act.id}...`);
        htmlContent = await fetchLawHtml(act.url);

        if (!htmlContent || htmlContent.trim().length < 100) {
          const entry = censusMap.get(law.id);
          if (entry) entry.classification = 'inaccessible';
          failed++;
          processed++;
          continue;
        }

        // Cache the HTML
        fs.writeFileSync(sourceFile, htmlContent);
        console.log(` OK (${(htmlContent.length / 1024).toFixed(0)} KB)`);
      }

      // Parse HTML
      const parsed = parseSVLawHtml(htmlContent, act);
      fs.writeFileSync(seedFile, JSON.stringify(parsed, null, 2));
      totalProvisions += parsed.provisions.length;
      totalDefinitions += parsed.definitions.length;
      console.log(`    -> ${parsed.provisions.length} provisions, ${parsed.definitions.length} definitions`);

      const entry = censusMap.get(law.id);
      if (entry) {
        entry.ingested = true;
        entry.provision_count = parsed.provisions.length;
        entry.ingestion_date = today;
      }

      ingested++;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`  ERROR parsing ${act.id}: ${msg}`);
      failed++;
    }

    processed++;

    if (processed % 50 === 0) {
      writeCensus(census, censusMap);
      console.log(`  [checkpoint] Census updated at ${processed}/${acts.length}`);
    }
  }

  writeCensus(census, censusMap);

  console.log(`\n${'='.repeat(70)}`);
  console.log('Ingestion Report');
  console.log('='.repeat(70));
  console.log(`\n  Source:      el-salvador.justia.com (HTML)`);
  console.log(`  Processed:   ${processed}`);
  console.log(`  New:         ${ingested}`);
  console.log(`  Resumed:     ${skipped}`);
  console.log(`  Failed:      ${failed}`);
  console.log(`  Total provisions:  ${totalProvisions}`);
  console.log(`  Total definitions: ${totalDefinitions}`);
  console.log('');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
