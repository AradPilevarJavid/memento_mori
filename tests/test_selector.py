from __future__ import annotations

import random
import unittest

from memento.models import Entry
from memento.selector import Selector, SelectorConfig


def entry(entry_id, category="power", entry_format="statement", themes=("power",)):
    return Entry.from_dict(
        {
            "id": entry_id,
            "category": category,
            "format": entry_format,
            "text": f"A sufficiently long test text for {entry_id}.",
            "attribution": "original",
            "themes": list(themes),
            "intensity": 2,
        }
    )


class SelectorTests(unittest.TestCase):
    def test_avoids_recently_used_entries(self):
        entries = [entry(f"entry-{index}") for index in range(10)]
        selector = Selector(entries, rng=random.Random(1))
        history = ["entry-0", "entry-1", "entry-2"]
        chosen = selector.choose(history)
        self.assertNotIn(chosen.id, history)

    def test_prefers_a_different_category(self):
        entries = [
            entry("power-one", category="power"),
            entry("power-two", category="power"),
            entry("mortality-one", category="mortality"),
            entry("humility-one", category="humility"),
        ]
        selector = Selector(entries, rng=random.Random(2))
        chosen = selector.choose(["power-one"])
        self.assertNotEqual(chosen.category, "power")

    def test_prefers_a_different_format_when_categories_are_equal(self):
        entries = [
            entry("statement-one", entry_format="statement"),
            entry("statement-two", entry_format="statement"),
            entry("question-one", entry_format="question"),
            entry("reflection-one", entry_format="reflection"),
        ]
        selector = Selector(entries, rng=random.Random(3))
        chosen = selector.choose(["statement-one"])
        self.assertNotEqual(chosen.format, "statement")

    def test_relaxes_when_everything_has_been_seen(self):
        entries = [entry("first"), entry("second")]
        selector = Selector(entries, rng=random.Random(4))
        chosen = selector.choose(["first", "second"])
        self.assertEqual(chosen.id, "first")

    def test_single_entry_library_still_works(self):
        entries = [entry("only")]
        selector = Selector(entries, rng=random.Random(5))
        self.assertEqual(selector.choose(["only"]).id, "only")

    def test_seed_makes_selection_reproducible(self):
        entries = [entry(f"entry-{index}") for index in range(8)]
        first = Selector(entries, rng=random.Random(9)).choose(["entry-0"])
        second = Selector(entries, rng=random.Random(9)).choose(["entry-0"])
        self.assertEqual(first.id, second.id)

    def test_unknown_history_ids_are_ignored(self):
        entries = [entry("known-one"), entry("known-two")]
        selector = Selector(entries, rng=random.Random(6))
        chosen = selector.choose(["missing", "known-one"])
        self.assertIn(chosen.id, {"known-one", "known-two"})

    def test_empty_library_is_rejected(self):
        with self.assertRaises(ValueError):
            Selector([])

    def test_configuration_is_respected(self):
        entries = [entry(f"entry-{index}") for index in range(6)]
        selector = Selector(
            entries,
            rng=random.Random(7),
            config=SelectorConfig(recent_window=2, category_window=1, format_window=1),
        )
        chosen = selector.choose(["entry-0", "entry-1", "entry-2"])
        self.assertNotIn(chosen.id, {"entry-1", "entry-2"})


if __name__ == "__main__":
    unittest.main()
