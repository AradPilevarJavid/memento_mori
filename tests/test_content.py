from __future__ import annotations

import unittest

from memento.content import content_stats, load_entries, validate_entries
from memento.models import ATTRIBUTIONS, CATEGORIES, FORMATS, ContentError, Entry


def make_entry(**overrides):
    data = {
        "id": "test-entry",
        "category": "mortality",
        "format": "statement",
        "text": "A test entry long enough to pass validation.",
        "attribution": "original",
        "themes": ["death"],
        "intensity": 2,
    }
    data.update(overrides)
    return Entry.from_dict(data)


class ContentLibraryTests(unittest.TestCase):
    def setUp(self):
        self.entries = load_entries()

    def test_library_is_substantial(self):
        self.assertGreaterEqual(len(self.entries), 50)

    def test_all_taxonomy_values_are_represented(self):
        self.assertEqual({entry.category for entry in self.entries}, set(CATEGORIES))
        self.assertEqual({entry.format for entry in self.entries}, set(FORMATS))
        self.assertEqual(
            {entry.attribution for entry in self.entries}, set(ATTRIBUTIONS)
        )

    def test_sources_are_present_for_attributed_material(self):
        for entry in self.entries:
            if entry.attribution in {"quotation", "paraphrase"}:
                self.assertTrue(entry.author, entry.id)
                self.assertTrue(entry.work, entry.id)
                self.assertTrue(entry.source, entry.id)
            if entry.attribution == "observation":
                self.assertTrue(entry.source, entry.id)
                self.assertIsNone(entry.author, entry.id)

    def test_original_writing_does_not_claim_an_author(self):
        for entry in self.entries:
            if entry.attribution == "original":
                self.assertIsNone(entry.author, entry.id)
                self.assertIsNone(entry.work, entry.id)
                self.assertIsNone(entry.source, entry.id)

    def test_central_evidence_caveats_are_present(self):
        by_id = {entry.id: entry for entry in self.entries}
        self.assertIn("not attested in ancient sources", by_id["triumph-whisper"].text)
        self.assertIn("not classical Roman", by_id["memento-mori-phrase"].text)
        self.assertIn("Shakespeare's invention", by_id["et-tu-brute"].text)

    def test_stats_match_library(self):
        stats = content_stats(self.entries)
        self.assertEqual(sum(stats["categories"].values()), len(self.entries))
        self.assertEqual(sum(stats["attributions"].values()), len(self.entries))


class ValidationTests(unittest.TestCase):
    def test_valid_entry_has_no_errors(self):
        self.assertEqual(validate_entries([make_entry()]), [])

    def test_duplicate_ids_are_rejected(self):
        errors = validate_entries(
            [make_entry(), make_entry(text="A different test entry for validation.")]
        )
        self.assertTrue(any("duplicate id" in error for error in errors))

    def test_duplicate_text_is_rejected(self):
        errors = validate_entries(
            [make_entry(id="first-entry"), make_entry(id="second-entry")]
        )
        self.assertTrue(any("duplicates the text" in error for error in errors))

    def test_quotation_requires_source(self):
        entry = make_entry(
            attribution="quotation",
            author="Seneca",
            work="Letters",
            source=None,
        )
        errors = validate_entries([entry])
        self.assertTrue(any("require a source" in error for error in errors))

    def test_original_cannot_claim_source(self):
        entry = make_entry(attribution="original", author="Seneca", source="Letters")
        errors = validate_entries([entry])
        self.assertTrue(any("must not claim an author" in error for error in errors))

    def test_invalid_category_and_intensity(self):
        entry = make_entry(category="nonsense", intensity=9)
        errors = validate_entries([entry])
        self.assertTrue(any("unknown category" in error for error in errors))
        self.assertTrue(any("intensity" in error for error in errors))

    def test_short_text_is_rejected(self):
        errors = validate_entries([make_entry(text="Too short")])
        self.assertTrue(any("text must be between" in error for error in errors))

    def test_from_dict_reports_missing_fields(self):
        with self.assertRaises(ContentError):
            Entry.from_dict({"id": "incomplete"})


if __name__ == "__main__":
    unittest.main()
