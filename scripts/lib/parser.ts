/**
 * Salvadoran Law HTML/PDF/Text Parser
 *
 * Parses law text from Justia El Salvador (elsalvador.justia.com) or from
 * PDFs. Applies regex-based article parsing for Salvadoran civil law.
 *
 * El Salvador follows Spanish civil law (Roman-Germanic tradition).
 * Laws are published in the Diario Oficial.
 *
 * Legislative body: Asamblea Legislativa de la Republica de El Salvador
 *
 * SECURITY: Uses child_process with array arguments (safe from injection).
 */

import { execFileSync } from 'child_process';

/* ---------- Shared Types ---------- */

export interface ActIndexEntry {
  id: string;
  title: string;
  titleEn: string;
  shortName: string;
  status: 'in_force' | 'amended' | 'repealed' | 'not_yet_in_force';
  issuedDate: string;
  inForceDate: string;
  url: string;
  description?: string;
}

export interface ParsedProvision {
  provision_ref: string;
  chapter?: string;
  section: string;
  title: string;
  content: string;
}

export interface ParsedDefinition {
  term: string;
  definition: string;
  source_provision?: string;
}

export interface ParsedAct {
  id: string;
  type: 'statute';
  title: string;
  title_en: string;
  short_name: string;
  status: string;
  issued_date: string;
  in_force_date: string;
  url: string;
  description?: string;
  provisions: ParsedProvision[];
  definitions: ParsedDefinition[];
}

/* ---------- PDF Text Extraction ---------- */

// SECURITY: execFileSync prevents command injection -- arguments passed as array, not shell string
export function extractTextFromPdf(pdfPath: string): string {
  try {
    return execFileSync('pdftotext', ['-layout', pdfPath, '-'], {
      maxBuffer: 50 * 1024 * 1024, encoding: 'utf-8', timeout: 30000,
    });
  } catch {
    try {
      return execFileSync('pdftotext', [pdfPath, '-'], {
        maxBuffer: 50 * 1024 * 1024, encoding: 'utf-8', timeout: 30000,
      });
    } catch { return ''; }
  }
}

/* ---------- Text Cleaning ---------- */

function decodeEntities(text: string): string {
  return text
    .replace(/&aacute;/g, '\u00e1').replace(/&eacute;/g, '\u00e9')
    .replace(/&iacute;/g, '\u00ed').replace(/&oacute;/g, '\u00f3')
    .replace(/&uacute;/g, '\u00fa').replace(/&ntilde;/g, '\u00f1')
    .replace(/&Aacute;/g, '\u00c1').replace(/&Eacute;/g, '\u00c9')
    .replace(/&Iacute;/g, '\u00cd').replace(/&Oacute;/g, '\u00d3')
    .replace(/&Uacute;/g, '\u00da').replace(/&Ntilde;/g, '\u00d1')
    .replace(/&uuml;/g, '\u00fc').replace(/&Uuml;/g, '\u00dc')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)));
}

function cleanText(text: string): string {
  return decodeEntities(text)
    .replace(/<[^>]*>/g, '').replace(/\r\n/g, '\n')
    .replace(/\f/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/* ---------- Article/Section Parsing ---------- */

const ARTICLE_PATTERNS = [
  /(?:^|\n)\s*(?:Art[\u00ed]culo|ART[\u00cdI]CULO|Art\.?)\s+((?:\d+[\s.]*(?:bis|ter|quater)?|\d+[A-Z]?(?:\.\d+)?|[\u00daU]NICO|PRIMERO|SEGUNDO))\s*[.\u00b0\u00ba]*[-.:;\u2013]?\s*([^\n]*)/gimu,
  /(?:^|\n)\s*ART[\u00cdI]CULO\s+(\d+)\s*[oO\u00ba\u00b0]\s*[.]*[-.:;\u2013]?\s*([^\n]*)/gimu,
];

const CHAPTER_RE = /(?:^|\n)\s*((?:T[\u00cdI]TULO|CAP[\u00cdI]TULO|SECCI[\u00d3O]N|LIBRO|DISPOSICIONES?\s+(?:TRANSITORIAS?|FINALES?|GENERALES?|COMPLEMENTARIAS?|DEROGATORIAS?))\s*[IVXLC0-9]*[^\n]*)/gimu;

const DEFINITION_PATTERNS = [
  /se\s+(?:entiende|entender[\u00e1a])\s+por\s+"?([^".:,]{3,80})"?\s*[,:]\s*([^.;]+[.;])/gi,
  /(?:(?:a|para)\s+los\s+efectos?\s+de\s+(?:esta|la\s+presente)\s+(?:ley|decreto|c[\u00f3o]digo)[^:]*:\s*)\n?\s*(?:\d+[.)]\s*)?([^:;\u2013-]+)\s*[:;\u2013-]\s*([^.;]+[.;])/gim,
  /se\s+(?:define|denomina)\s+(?:como\s+)?"?([^".:]{3,80})"?\s*(?:a|al|la|el)?\s*([^.;]+[.;])/gi,
  /["\u201C]([^"\u201D]{2,60})["\u201D]\s*[:;\u2013-]\s*([^.;]+[.;])/gi,
];

function findLawTextStart(text: string): number {
  const startPatterns = [
    /\bLA\s+ASAMBLEA\s+LEGISLATIVA\s+DE\s+LA\s+REP[\u00daU]BLICA\s+DE\s+EL\s+SALVADOR\b/i,
    /\bASAMBLEA\s+LEGISLATIVA\b/i,
    /\bDECRETA\s*:/i, /\bRESUELVE\s*:/i, /\bCONSIDERANDO\b/i, /\bPOR\s+TANTO\b/i,
    /(?:^|\n)\s*(?:ART[\u00cdI]CULO|Art[\u00ed]culo)\s+(?:1|PRIMERO|[\u00daU]NICO)\s*[.\u00b0\u00ba]*[-.:;\u2013]/im,
    /(?:^|\n)\s*T[\u00cdI]TULO\s+(?:I|1|PRIMERO)\b/im,
    /\bDISPOSICIONES\s+GENERALES\b/i,
  ];
  let earliestPos = text.length;
  for (const pattern of startPatterns) {
    const match = pattern.exec(text);
    if (match && match.index < earliestPos) earliestPos = match.index;
  }
  return earliestPos === text.length ? 0 : earliestPos;
}

/* ---------- Main Parse Functions ---------- */

export function parseSVLawText(text: string, act: ActIndexEntry): ParsedAct {
  const cleaned = cleanText(text);
  const startIdx = findLawTextStart(cleaned);
  const lawText = cleaned.substring(startIdx);

  const provisions: ParsedProvision[] = [];
  const definitions: ParsedDefinition[] = [];

  interface Heading { ref: string; title: string; position: number; }
  const headings: Heading[] = [];

  for (const pattern of ARTICLE_PATTERNS) {
    const re = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = re.exec(lawText)) !== null) {
      const num = match[1].replace(/\s+/g, '').replace(/\.$/, '');
      const title = (match[2] ?? '').trim();
      const ref = `art${num.toLowerCase()}`;
      if (!headings.some(h => h.ref === ref && Math.abs(h.position - match!.index) < 20)) {
        headings.push({ ref, title: title || `Art\u00edculo ${num}`, position: match.index });
      }
    }
  }

  headings.sort((a, b) => a.position - b.position);

  const chapterRe = new RegExp(CHAPTER_RE.source, CHAPTER_RE.flags);
  const chapterPositions: { chapter: string; position: number }[] = [];
  let match: RegExpExecArray | null;
  while ((match = chapterRe.exec(lawText)) !== null) {
    chapterPositions.push({ chapter: match[1].trim(), position: match.index });
  }

  let currentChapter = '';
  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i];
    const nextHeading = headings[i + 1];
    const endPos = nextHeading ? nextHeading.position : lawText.length;
    const content = lawText.substring(heading.position, endPos).trim();
    for (const cp of chapterPositions) {
      if (cp.position <= heading.position) currentChapter = cp.chapter;
    }
    const cleanedContent = content.split('\n').map(l => l.trim()).filter(l => l.length > 0).join('\n');
    if (cleanedContent.length > 10) {
      provisions.push({ provision_ref: heading.ref, chapter: currentChapter || undefined,
        section: currentChapter || act.title, title: heading.title, content: cleanedContent });
    }
  }

  for (const pattern of DEFINITION_PATTERNS) {
    const defRe = new RegExp(pattern.source, pattern.flags);
    while ((match = defRe.exec(lawText)) !== null) {
      const term = (match[1] ?? '').trim();
      const definition = (match[2] ?? '').trim();
      if (term.length > 2 && term.length < 100 && definition.length > 10) {
        let sourceProvision: string | undefined;
        for (let i = headings.length - 1; i >= 0; i--) {
          if (headings[i].position <= match.index) { sourceProvision = headings[i].ref; break; }
        }
        definitions.push({ term, definition, source_provision: sourceProvision });
      }
    }
  }

  if (provisions.length === 0 && lawText.length > 50) {
    provisions.push({ provision_ref: 'full-text', section: act.title, title: act.title, content: lawText.substring(0, 50000) });
  }

  return { id: act.id, type: 'statute', title: act.title, title_en: act.titleEn,
    short_name: act.shortName, status: act.status,
    issued_date: act.issuedDate, in_force_date: act.inForceDate, url: act.url,
    provisions, definitions };
}

export function parseSVLawPdf(pdfPath: string, act: ActIndexEntry): ParsedAct {
  const text = extractTextFromPdf(pdfPath);
  if (!text || text.trim().length < 50) {
    return { id: act.id, type: 'statute', title: act.title, title_en: act.titleEn,
      short_name: act.shortName, status: act.status,
      issued_date: act.issuedDate, in_force_date: act.inForceDate, url: act.url,
      provisions: [], definitions: [] };
  }
  return parseSVLawText(text, act);
}

export function parseSVLawHtml(html: string, act: ActIndexEntry): ParsedAct {
  return parseSVLawText(html, act);
}

export function parseHtml(html: string, act: ActIndexEntry): ParsedAct {
  return parseSVLawText(html, act);
}
