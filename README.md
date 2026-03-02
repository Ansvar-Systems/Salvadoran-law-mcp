# Salvadoran Law MCP Server

**The Asamblea Legislativa alternative for the AI age.**

[![npm version](https://badge.fury.io/js/@ansvar%2Fsalvadoran-law-mcp.svg)](https://www.npmjs.com/package/@ansvar/salvadoran-law-mcp)
[![MCP Registry](https://img.shields.io/badge/MCP-Registry-blue)](https://registry.modelcontextprotocol.io)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![GitHub stars](https://img.shields.io/github/stars/Ansvar-Systems/Salvadoran-law-mcp?style=social)](https://github.com/Ansvar-Systems/Salvadoran-law-mcp)
[![CI](https://github.com/Ansvar-Systems/Salvadoran-law-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Ansvar-Systems/Salvadoran-law-mcp/actions/workflows/ci.yml)
[![Daily Data Check](https://github.com/Ansvar-Systems/Salvadoran-law-mcp/actions/workflows/check-updates.yml/badge.svg)](https://github.com/Ansvar-Systems/Salvadoran-law-mcp/actions/workflows/check-updates.yml)
[![Database](https://img.shields.io/badge/database-pre--built-green)](docs/INTERNATIONAL_INTEGRATION_GUIDE.md)
[![Provisions](https://img.shields.io/badge/provisions-16%2C576-blue)](docs/INTERNATIONAL_INTEGRATION_GUIDE.md)

Query **359 Salvadoran laws** -- from the Ley de Protección de Datos Personales and Código Penal to the Código Civil, Ley de Comercio Electrónico, and more -- directly from Claude, Cursor, or any MCP-compatible client.

If you're building legal tech, compliance tools, or doing Salvadoran legal research, this is your verified reference database.

Built by [Ansvar Systems](https://ansvar.eu) -- Stockholm, Sweden

---

## Why This Exists

Salvadoran legal research means navigating the Asamblea Legislativa portal, hunting for PDFs across government sites, and manually cross-referencing between codes and reglamentos. Whether you're:
- A **lawyer** validating citations in a brief or contract
- A **compliance officer** checking obligations under Salvadoran data protection or CAFTA-DR requirements
- A **legal tech developer** building tools on Central American law
- A **researcher** tracing legislative provisions across Salvadoran legislation

...you shouldn't need dozens of browser tabs and manual PDF cross-referencing. Ask Claude. Get the exact provision. With context.

This MCP server makes Salvadoran law **searchable, cross-referenceable, and AI-readable**.

---

## Quick Start

### Use Remotely (No Install Needed)

> Connect directly to the hosted version -- zero dependencies, nothing to install.

**Endpoint:** `https://salvadoran-law-mcp.vercel.app/mcp`

| Client | How to Connect |
|--------|---------------|
| **Claude.ai** | Settings > Connectors > Add Integration > paste URL |
| **Claude Code** | `claude mcp add salvadoran-law --transport http https://salvadoran-law-mcp.vercel.app/mcp` |
| **Claude Desktop** | Add to config (see below) |
| **GitHub Copilot** | Add to VS Code settings (see below) |

**Claude Desktop** -- add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "salvadoran-law": {
      "type": "url",
      "url": "https://salvadoran-law-mcp.vercel.app/mcp"
    }
  }
}
```

**GitHub Copilot** -- add to VS Code `settings.json`:

```json
{
  "github.copilot.chat.mcp.servers": {
    "salvadoran-law": {
      "type": "http",
      "url": "https://salvadoran-law-mcp.vercel.app/mcp"
    }
  }
}
```

### Use Locally (npm)

```bash
npx @ansvar/salvadoran-law-mcp
```

**Claude Desktop** -- add to `claude_desktop_config.json`:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "salvadoran-law": {
      "command": "npx",
      "args": ["-y", "@ansvar/salvadoran-law-mcp"]
    }
  }
}
```

**Cursor / VS Code:**

```json
{
  "mcp.servers": {
    "salvadoran-law": {
      "command": "npx",
      "args": ["-y", "@ansvar/salvadoran-law-mcp"]
    }
  }
}
```

## Example Queries

Once connected, just ask naturally (in Spanish or English):

- *"¿Qué dice el artículo 10 de la Ley de Protección de Datos Personales sobre el consentimiento?"*
- *"¿Está vigente el Código de Comercio?"*
- *"Buscar disposiciones sobre protección de datos personales en la legislación salvadoreña"*
- *"¿Cuáles son los requisitos de notificación de violaciones de datos bajo la ley salvadoreña?"*
- *"¿Qué dice el Código Penal sobre delitos informáticos?"*
- *"Buscar disposiciones sobre contratos electrónicos en el Código Civil"*
- *"Validar la cita 'Art. 15 Ley de Protección de Datos Personales'"*
- *"Construir una posición jurídica sobre responsabilidad contractual en El Salvador"*

---

## What's Included

| Category | Count | Details |
|----------|-------|---------|
| **Laws** | 359 laws | Salvadoran legislation from asamblea.gob.sv |
| **Provisions** | 16,576 sections | Full-text searchable with FTS5 |
| **Database Size** | ~31 MB | Optimized SQLite, portable |
| **Freshness Checks** | Automated | Drift detection against official sources |

**Verified data only** -- every citation is validated against official sources (Asamblea Legislativa de El Salvador). Zero LLM-generated content.

---

## See It In Action

### Why This Works

**Verbatim Source Text (No LLM Processing):**
- All statute text is ingested from the Asamblea Legislativa portal (asamblea.gob.sv)
- Provisions are returned **unchanged** from SQLite FTS5 database rows
- Zero LLM summarization or paraphrasing -- the database contains statute text, not AI interpretations

**Smart Context Management:**
- Search returns ranked provisions with BM25 scoring (safe for context)
- Provision retrieval gives exact text by law identifier + article number
- Cross-references help navigate without loading everything at once

**Technical Architecture:**
```
Asamblea Legislativa Portal --> Parse --> SQLite --> FTS5 snippet() --> MCP response
                                  ^                        ^
                           Provision parser         Verbatim database query
```

### Traditional Research vs. This MCP

| Traditional Approach | This MCP Server |
|---------------------|-----------------|
| Search Asamblea portal by law name | Search by plain Spanish: *"protección de datos consentimiento"* |
| Navigate multi-chapter codes manually | Get the exact provision with context |
| Manual cross-referencing between laws | `build_legal_stance` aggregates across sources |
| "¿Está vigente esta ley?" -> check manually | `check_currency` tool -> answer in seconds |
| Find OAS framework alignment -> dig through OAS docs | `get_eu_basis` -> linked frameworks instantly |
| No API, no integration | MCP protocol -> AI-native |

**Traditional:** Search Asamblea portal -> Download PDF -> Ctrl+F -> Cross-reference between codes -> Repeat

**This MCP:** *"¿Qué dispone la Ley de Protección de Datos Personales sobre el tratamiento de datos sensibles?"* -> Done.

---

## Available Tools (13)

### Core Legal Research Tools (8)

| Tool | Description |
|------|-------------|
| `search_legislation` | FTS5 full-text search across 16,576 provisions with BM25 ranking |
| `get_provision` | Retrieve specific provision by law identifier + article number |
| `check_currency` | Check if a law is in force, amended, or repealed |
| `validate_citation` | Validate citation against database -- zero-hallucination check |
| `build_legal_stance` | Aggregate citations from multiple laws for a legal topic |
| `format_citation` | Format citations per Salvadoran legal conventions |
| `list_sources` | List all available laws with metadata, coverage scope, and data provenance |
| `about` | Server info, capabilities, dataset statistics, and coverage summary |

### International Law Integration Tools (5)

| Tool | Description |
|------|-------------|
| `get_eu_basis` | Get international frameworks (OAS, CAFTA-DR) that a Salvadoran law aligns with |
| `get_salvadoran_implementations` | Find Salvadoran laws aligning with a specific international framework |
| `search_eu_implementations` | Search international documents with Salvadoran alignment counts |
| `get_provision_eu_basis` | Get international law references for a specific provision |
| `validate_eu_compliance` | Check alignment status of Salvadoran laws against international frameworks |

---

## International Law Alignment

El Salvador is not an EU member state. International alignment for Salvadoran law is anchored in:

- **OAS frameworks** -- El Salvador participates in Organization of American States conventions, including the Inter-American Convention against Corruption and the Inter-American Convention on Mutual Assistance in Criminal Matters
- **CAFTA-DR** -- The Dominican Republic-Central America Free Trade Agreement with the United States establishes IP, labor, and trade obligations that shape domestic legislation
- **UN conventions** -- El Salvador has ratified key UN conventions including UNCAC (anti-corruption), UNTOC (transnational organized crime), and CRC (children's rights)
- **Data protection trajectory** -- The Ley de Protección de Datos Personales (2022) draws on GDPR principles, positioning Salvadoran data protection within the global adequacy framework

The international bridge tools allow you to explore these alignment relationships -- identifying where Salvadoran provisions correspond to international frameworks, and vice versa.

> **Note:** International cross-references reflect alignment and treaty relationships, not direct transposition. El Salvador adopts its own legislative approach.

---

## Data Sources & Freshness

All content is sourced from authoritative Salvadoran legal databases:

- **[Asamblea Legislativa](https://www.asamblea.gob.sv/)** -- Official legislative database of El Salvador

### Data Provenance

| Field | Value |
|-------|-------|
| **Authority** | Asamblea Legislativa de El Salvador |
| **Retrieval method** | Official legislative portal ingestion |
| **Language** | Spanish |
| **Coverage** | 359 laws across all legal domains |
| **Last ingested** | 2026-02-25 |

### Automated Freshness Checks

A GitHub Actions workflow monitors official sources for changes:

| Check | Method |
|-------|--------|
| **Law amendments** | Drift detection against known provision anchors |
| **New laws** | Comparison against official index |
| **Repealed laws** | Status change detection |

**Verified data only** -- every citation is validated against official sources. Zero LLM-generated content.

---

## Security

This project uses multiple layers of automated security scanning:

| Scanner | What It Does | Schedule |
|---------|-------------|----------|
| **CodeQL** | Static analysis for security vulnerabilities | Weekly + PRs |
| **Semgrep** | SAST scanning (OWASP top 10, secrets, TypeScript) | Every push |
| **Gitleaks** | Secret detection across git history | Every push |
| **Trivy** | CVE scanning on filesystem and npm dependencies | Daily |
| **Socket.dev** | Supply chain attack detection | PRs |
| **Dependabot** | Automated dependency updates | Weekly |

See [SECURITY.md](SECURITY.md) for the full policy and vulnerability reporting.

---

## Important Disclaimers

### Legal Advice

> **THIS TOOL IS NOT LEGAL ADVICE**
>
> Statute text is sourced from the Asamblea Legislativa de El Salvador. However:
> - This is a **research tool**, not a substitute for professional legal counsel
> - **Court case coverage is not included** -- do not rely solely on this for case law research
> - **Verify critical citations** against primary sources for court filings
> - **International cross-references** reflect alignment relationships, not direct transposition
> - **Municipal and regulatory law** is not fully covered -- this focuses on primary legislation

**Before using professionally, read:** [DISCLAIMER.md](DISCLAIMER.md) | [SECURITY.md](SECURITY.md)

### Client Confidentiality

Queries go through the Claude API. For privileged or confidential matters, use on-premise deployment. See [PRIVACY.md](PRIVACY.md) for guidance on professional use in accordance with Asociación de Abogados de El Salvador standards.

---

## Development

### Setup

```bash
git clone https://github.com/Ansvar-Systems/Salvadoran-law-mcp
cd Salvadoran-law-mcp
npm install
npm run build
npm test
```

### Running Locally

```bash
npm run dev                                       # Start MCP server
npx @anthropic/mcp-inspector node dist/index.js   # Test with MCP Inspector
```

### Data Management

```bash
npm run ingest                    # Ingest laws from Asamblea Legislativa
npm run build:db                  # Rebuild SQLite database
npm run check-updates             # Check for amendments and new laws
```

### Performance

- **Search Speed:** <100ms for most FTS5 queries
- **Database Size:** ~31 MB (efficient, portable)
- **Reliability:** 100% ingestion success rate

---

## Related Projects: Complete Compliance Suite

This server is part of **Ansvar's Compliance Suite** -- MCP servers that work together for end-to-end compliance coverage:

### [@ansvar/eu-regulations-mcp](https://github.com/Ansvar-Systems/EU_compliance_MCP)
**Query 49 EU regulations directly from Claude** -- GDPR, AI Act, DORA, NIS2, MiFID II, eIDAS, and more. Full regulatory text with article-level search. `npx @ansvar/eu-regulations-mcp`

### [@ansvar/us-regulations-mcp](https://github.com/Ansvar-Systems/US_Compliance_MCP)
**Query US federal and state compliance laws** -- HIPAA, CCPA, SOX, GLBA, FERPA, and more. `npx @ansvar/us-regulations-mcp`

### [@ansvar/security-controls-mcp](https://github.com/Ansvar-Systems/security-controls-mcp)
**Query 261 security frameworks** -- ISO 27001, NIST CSF, SOC 2, CIS Controls, SCF, and more. `npx @ansvar/security-controls-mcp`

### [@ansvar/panamanian-law-mcp](https://github.com/Ansvar-Systems/Panamanian-law-mcp)
**Query 5,290 Panamanian laws** -- covering civil, commercial, criminal, and data protection law. `npx @ansvar/panamanian-law-mcp`

**70+ national law MCPs** covering Australia, Brazil, Canada, Colombia, Denmark, Finland, France, Germany, Guatemala, Ireland, Italy, Japan, Netherlands, Norway, Serbia, Slovenia, South Korea, Sweden, Taiwan, UK, and more.

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Priority areas:
- Court case law expansion (Sala de lo Constitucional, Sala de lo Civil)
- Regulatory and reglamento coverage
- Historical statute versions and amendment tracking
- English translations for key statutes

---

## Roadmap

- [x] Core statute database with FTS5 search
- [x] Full corpus ingestion (359 laws, 16,576 provisions)
- [x] International law alignment tools
- [x] Vercel Streamable HTTP deployment
- [x] npm package publication
- [ ] Court case law expansion (Corte Suprema de Justicia)
- [ ] Regulatory instruments and reglamentos
- [ ] Historical statute versions (amendment tracking)
- [ ] English translations for key statutes

---

## Citation

If you use this MCP server in academic research:

```bibtex
@software{salvadoran_law_mcp_2026,
  author = {Ansvar Systems AB},
  title = {Salvadoran Law MCP Server: AI-Powered Legal Research Tool},
  year = {2026},
  url = {https://github.com/Ansvar-Systems/Salvadoran-law-mcp},
  note = {359 Salvadoran laws with 16,576 provisions}
}
```

---

## License

Apache License 2.0. See [LICENSE](./LICENSE) for details.

### Data Licenses

- **Statutes & Legislation:** Asamblea Legislativa de El Salvador (public domain)
- **International Framework Metadata:** OAS, UN (public domain)

---

## About Ansvar Systems

We build AI-accelerated compliance and legal research tools for the global market. This MCP server started as our internal reference tool -- turns out everyone building compliance tools has the same research frustrations.

So we're open-sourcing it. Navigating 359 Salvadoran laws shouldn't require a law degree.

**[ansvar.eu](https://ansvar.eu)** -- Stockholm, Sweden

---

<p align="center">
  <sub>Built with care in Stockholm, Sweden</sub>
</p>
