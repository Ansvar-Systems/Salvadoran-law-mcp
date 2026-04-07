/**
 * Response metadata utilities for Salvadoran Law MCP.
 */

import type Database from '@ansvar/mcp-sqlite';

export interface ResponseMetadata {
  data_source: string;
  jurisdiction: string;
  disclaimer: string;
  freshness?: string;
  note?: string;
  query_strategy?: string;
}

export interface ToolResponse<T> {
  results: T;
  _metadata: ResponseMetadata;
  _citation?: import('./citation.js').CitationMetadata;
}

export function generateResponseMetadata(
  db: InstanceType<typeof Database>,
): ResponseMetadata {
  let freshness: string | undefined;
  try {
    const row = db.prepare(
      "SELECT value FROM db_metadata WHERE key = 'built_at'"
    ).get() as { value: string } | undefined;
    if (row) freshness = row.value;
  } catch {
    // Ignore
  }

  return {
    data_source: 'Diario Oficial de El Salvador / Asamblea Legislativa (asamblea.gob.sv) — Legislative Assembly of El Salvador',
    jurisdiction: 'SV',
    disclaimer:
      'This data is sourced from official Salvadoran government publications. ' +
      'Legislation is published in Spanish. ' +
      'Always verify with the official Diario Oficial or the Asamblea Legislativa portal (asamblea.gob.sv).',
    freshness,
  };
}
