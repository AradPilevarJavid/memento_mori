from __future__ import annotations

import io
import unittest

from memento.delivery import attribution_label, deliver, format_notification
from memento.models import Entry


def make_entry(attribution, **overrides):
    data = {
        "id": "test-entry",
        "category": "mortality",
        "format": "statement",
        "text": "A sufficiently long test text for delivery.",
        "attribution": attribution,
        "themes": ["death"],
        "intensity": 2,
    }
    if attribution in {"quotation", "paraphrase"}:
        data.update(author="Seneca", work="Letters 1.2", source="Seneca, Moral Letters")
    if attribution == "observation":
        data.update(source="A historical source")
    data.update(overrides)
    return Entry.from_dict(data)


class AttributionTests(unittest.TestCase):
    def test_quotation_label_includes_author_work_and_source(self):
        label = attribution_label(make_entry("quotation"))
        self.assertIn("Quotation — Seneca, Letters 1.2", label)
        self.assertIn("Source: Seneca, Moral Letters", label)

    def test_paraphrase_is_distinguished_from_quotation(self):
        label = attribution_label(make_entry("paraphrase"))
        self.assertIn("Paraphrase — Seneca, Letters 1.2", label)

    def test_observation_label_is_historical_note(self):
        label = attribution_label(make_entry("observation"))
        self.assertIn("Historical note", label)
        self.assertIn("Source: A historical source", label)

    def test_original_label_makes_provenance_clear(self):
        label = attribution_label(make_entry("original"))
        self.assertIn("Original reflection", label)
        self.assertIn("AI-generated", label)
        self.assertIn("not a quotation", label)
        self.assertNotIn("Source:", label)

    def test_note_is_included(self):
        label = attribution_label(make_entry("quotation", note="Translation adapted."))
        self.assertIn("Note: Translation adapted.", label)


class DeliveryTests(unittest.TestCase):
    def test_format_notification_uses_category_in_title(self):
        title, body = format_notification(make_entry("original"))
        self.assertIn("MEMENTO MORI", title)
        self.assertIn("Mortality", title)
        self.assertIn("A sufficiently long test text", body)

    def test_dry_run_prints_and_returns_stdout(self):
        output = io.StringIO()
        channel = deliver(make_entry("original"), dry_run=True, stream=output)
        self.assertEqual(channel, "stdout")
        self.assertIn("MEMENTO MORI", output.getvalue())

    def test_stdout_channel_prints(self):
        output = io.StringIO()
        channel = deliver(make_entry("original"), channel="stdout", stream=output)
        self.assertEqual(channel, "stdout")
        self.assertIn("Original reflection", output.getvalue())


if __name__ == "__main__":
    unittest.main()
