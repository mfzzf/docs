# Astraflow Mintlify docs

This directory contains the Mintlify documentation source for Astraflow.

## Local preview

Run the Mintlify preview command from this directory:

```bash
npm i -g mint
mint dev
```

## OpenAPI

The API reference reads `api-reference/openapi.json`. Regenerate it from the
runtime source when endpoints or metadata change:

```bash
uv run --project ../../apps/runtime python scripts/export-openapi.py
```

The Web app sidebar shows an API Docs link only when `NEXT_PUBLIC_API_DOCS_URL`
is set to the published Mintlify URL.
