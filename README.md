# Astraflow Mintlify docs

This directory contains the Mintlify documentation source for Astraflow.

## Local preview

Run the Mintlify preview command from this directory:

```bash
npm i -g mint
mint dev
```

## OpenAPI

The API reference reads two OpenAPI specs:

- `api-reference/platform-openapi.json` is the public platform contract.
- `api-reference/runtime-openapi.json` is generated from the FastAPI runtime.

Regenerate the platform contract after product API changes:

```bash
node scripts/build-platform-openapi.mjs
```

Regenerate the runtime spec when runtime endpoints or metadata change:

```bash
uv run --project ../../apps/runtime python scripts/export-openapi.py
```

The Web app sidebar shows an API Docs link only when `NEXT_PUBLIC_API_DOCS_URL`
is set to the published Mintlify URL.
