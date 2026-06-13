from __future__ import annotations

import json
import os
from pathlib import Path

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/postgres",
)
os.environ.setdefault("MODELVERSE_API_KEY", "docs-export-placeholder")
os.environ.setdefault("RUNTIME_INTERNAL_TOKEN", "docs-export-placeholder")


def main() -> None:
    from runtime.main import app

    spec = app.openapi()
    spec.setdefault("info", {})["license"] = {
        "name": "Proprietary",
        "identifier": "LicenseRef-Proprietary",
    }
    public_url = os.environ.get(
        "RUNTIME_PUBLIC_URL",
        "https://agents.plumzz.com/runtime",
    ).rstrip("/")
    spec["servers"] = [
        {
            "url": public_url,
            "description": "Public runtime gateway. Internal endpoints require X-Runtime-Token.",
        }
    ]

    healthz = spec.get("paths", {}).get("/healthz", {}).get("get")
    if isinstance(healthz, dict):
        healthz["security"] = []
        healthz.setdefault("responses", {})["503"] = {
            "description": "Runtime process is unavailable.",
        }

    output_path = (
        Path(__file__).resolve().parents[1]
        / "api-reference"
        / "runtime-openapi.json"
    )
    output_path.write_text(
        json.dumps(spec, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"wrote {output_path}")


if __name__ == "__main__":
    main()
