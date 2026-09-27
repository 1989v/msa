"""Exercise the CI gate with real doctor diagnostics and temporary repositories."""

import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


GATE = Path(__file__).resolve().parents[1] / "docs-health.py"


class DocsHealthTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.write("CLAUDE.md", "# Commands\nBuild and test the project before committing changes.\n")
        self.write("docs/doc-index.json", '{"version": 1, "source_roots": []}')

    def write(self, path, text):
        target = self.root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text, encoding="utf-8")

    def run_gate(self, root=None):
        return subprocess.run(
            [sys.executable, str(GATE), str(root or self.root)],
            capture_output=True, text=True, check=False,
        )

    def test_uncited_spec_is_visible_as_warning_without_blocking_ci(self):
        self.write("docs/specs/feature.md", "# Planned feature\nNo implementation yet.\n")
        result = self.run_gate()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("[WARN L4-01]", result.stdout)
        self.assertIn("**Status**: WARN", result.stdout)

    def test_broken_link_still_blocks_ci_with_uncited_spec(self):
        self.write("docs/specs/feature.md", "# Feature\n[Missing](missing.md)\n")
        result = self.run_gate()
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn("[FAIL L3-01]", result.stdout)

    def test_missing_index_still_blocks_ci(self):
        (self.root / "docs/doc-index.json").unlink()
        result = self.run_gate()
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn("[FAIL L1-01]", result.stdout)

    def test_missing_agent_guide_still_blocks_ci(self):
        (self.root / "CLAUDE.md").unlink()
        result = self.run_gate()
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn("[FAIL L2-01]", result.stdout)

    def test_valid_blog_url_is_not_a_repository_link(self):
        self.write("docs/drafts/post.md", "[Related](https://blog.1989v.com/posts/search-cluster-capacity-sizing)\n")
        result = self.run_gate()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("**Status**: PASS", result.stdout)

    def test_missing_project_is_an_error(self):
        result = self.run_gate(self.root / "nonexistent")
        self.assertNotEqual(result.returncode, 0)


if __name__ == "__main__":
    unittest.main()
