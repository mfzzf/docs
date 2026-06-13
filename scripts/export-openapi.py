from __future__ import annotations

import json
from pathlib import Path

from runtime.main import app


def main() -> None:
    output_path = Path(__file__).resolve().parents[1] / "api-reference" / "openapi.json"
    output_path.write_text(
        json.dumps(app.openapi(), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"wrote {output_path}")


if __name__ == "__main__":
    main()
