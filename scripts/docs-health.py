#!/usr/bin/env python3
"""Run Docs Health with the repository's optional-citation policy.

docs/standards/doc-index-tracking.md defines source citations as optional,
introduced incrementally. Keep L4-01 visible as WARN; all other findings retain
their upstream severity. CI exits 0 for PASS/WARN and 1 for FAIL.
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "ai/plugins/hns/scripts"))
import doctor


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("project_root", nargs="?", default=".")
    args = parser.parse_args()
    root = Path(args.project_root).resolve()
    if not root.is_dir():
        parser.error(f"project root is not a directory: {root}")

    results = doctor.run_layers(root)
    for layer in results:
        for finding in layer.findings:
            if (layer.id == "L4" and finding.code == "L4-01"
                    and finding.severity == doctor.SEV_FAIL):
                finding.severity = doctor.SEV_WARN
        layer.status = max(
            (finding.severity for finding in layer.findings),
            key=doctor.SEV_ORDER.__getitem__, default=doctor.SEV_PASS,
        )

    status = doctor.overall_status(results, strict=False)
    print(doctor.format_text(results, doctor.compute_score(results), status))
    print("Policy: L4-01 citations are optional (docs/standards/doc-index-tracking.md).")
    return 1 if status == doctor.SEV_FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
