from __future__ import annotations

import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path

from memento.cli import main


class CliTests(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary_directory.cleanup)
        self.history_path = Path(self.temporary_directory.name) / "history.json"

    def run_cli(self, *arguments):
        stdout = io.StringIO()
        stderr = io.StringIO()
        with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
            code = main(list(arguments))
        return code, stdout.getvalue(), stderr.getvalue()

    def test_validate(self):
        code, output, _ = self.run_cli("validate")
        self.assertEqual(code, 0)
        self.assertIn("Content is valid", output)

    def test_taxonomy(self):
        code, output, _ = self.run_cli("taxonomy")
        self.assertEqual(code, 0)
        self.assertIn("Categories:", output)
        self.assertIn("Attribution types:", output)

    def test_once_dry_run(self):
        code, output, _ = self.run_cli(
            "once",
            "--dry-run",
            "--no-history",
            "--seed",
            "1",
            "--channel",
            "stdout",
        )
        self.assertEqual(code, 0)
        self.assertIn("MEMENTO MORI", output)

    def test_once_json(self):
        code, output, _ = self.run_cli("once", "--json", "--no-history", "--seed", "1")
        self.assertEqual(code, 0)
        payload = json.loads(output)
        self.assertIn("id", payload)
        self.assertIn("attribution", payload)

    def test_next_json(self):
        code, output, _ = self.run_cli(
            "next",
            "--json",
            "--seed",
            "1",
            "--history-path",
            str(self.history_path),
        )
        self.assertEqual(code, 0)
        payload = json.loads(output)
        self.assertIn("category", payload)

    def test_list(self):
        code, output, _ = self.run_cli(
            "list", "--category", "mortality", "--limit", "2"
        )
        self.assertEqual(code, 0)
        self.assertIn("mortality", output)

    def test_run_count_one(self):
        code, output, _ = self.run_cli(
            "run",
            "--count",
            "1",
            "--dry-run",
            "--no-history",
            "--start-now",
            "--quiet-start",
            "00:00",
            "--quiet-end",
            "00:00",
            "--seed",
            "1",
        )
        self.assertEqual(code, 0)
        self.assertIn("MEMENTO MORI", output)

    def test_history_and_clear(self):
        code, output, _ = self.run_cli(
            "history", "--history-path", str(self.history_path)
        )
        self.assertEqual(code, 0)
        self.assertIn("No delivery history", output)

        code, output, _ = self.run_cli(
            "clear-history", "--history-path", str(self.history_path)
        )
        self.assertEqual(code, 0)
        self.assertIn("Cleared history", output)

    def test_empty_filter_is_an_error(self):
        code, _, error = self.run_cli(
            "once",
            "--category",
            "emperors",
            "--format",
            "question",
            "--dry-run",
            "--no-history",
        )
        self.assertEqual(code, 2)
        self.assertIn("no content matches", error)

    def test_missing_content_file_is_an_error(self):
        code, _, error = self.run_cli("validate", "--content", "/does/not/exist.json")
        self.assertEqual(code, 2)
        self.assertIn("Content error", error)


if __name__ == "__main__":
    unittest.main()
