# El Salvador Law MCP

## Quick Reference

- **Jurisdiction**: El Salvador (SV)
- **Source**: asamblea.gob.sv
- **Language**: Spanish
- **Tools**: 8 core (non-EU jurisdiction)
- **Template**: Dominican-law-mcp

## Development

```bash
npm run census     # Enumerate laws from asamblea.gob.sv
npm run ingest     # Download full text
npm run build:db   # Build SQLite DB
npm run build      # Compile TS
npm test           # Run tests
```

## Status

- [ ] Census script customized for asamblea.gob.sv
- [ ] Ingestion script customized
- [ ] Database built
- [ ] Tests passing
- [ ] Deployed to Vercel
- [ ] Published to npm
