from __future__ import annotations

import unittest
from datetime import datetime, time, timedelta

from memento.scheduler import ScheduleConfig


class FixedRng:
    def __init__(self, value):
        self.value = value

    def uniform(self, low, high):
        return low + (high - low) * self.value


class QuietHoursTests(unittest.TestCase):
    def test_overnight_quiet_hours(self):
        config = ScheduleConfig(quiet_start=time(22, 0), quiet_end=time(8, 0))
        self.assertTrue(config.is_quiet(datetime(2026, 1, 1, 23, 0)))
        self.assertTrue(config.is_quiet(datetime(2026, 1, 2, 3, 0)))
        self.assertFalse(config.is_quiet(datetime(2026, 1, 2, 8, 0)))
        self.assertFalse(config.is_quiet(datetime(2026, 1, 1, 21, 59)))

    def test_same_day_quiet_hours(self):
        config = ScheduleConfig(quiet_start=time(13, 0), quiet_end=time(14, 0))
        self.assertTrue(config.is_quiet(datetime(2026, 1, 1, 13, 30)))
        self.assertFalse(config.is_quiet(datetime(2026, 1, 1, 14, 0)))
        self.assertFalse(config.is_quiet(datetime(2026, 1, 1, 12, 59)))

    def test_equal_start_and_end_means_no_quiet_hours(self):
        config = ScheduleConfig(quiet_start=time(0, 0), quiet_end=time(0, 0))
        self.assertFalse(config.is_quiet(datetime(2026, 1, 1, 0, 0)))


class NextActiveTests(unittest.TestCase):
    def test_quiet_hours_after_midnight_move_to_same_morning(self):
        config = ScheduleConfig(
            quiet_start=time(22, 0), quiet_end=time(8, 0), quiet_jitter_minutes=0
        )
        now = datetime(2026, 1, 2, 3, 0)
        self.assertEqual(
            config.next_active(now, FixedRng(0)), datetime(2026, 1, 2, 8, 0)
        )

    def test_quiet_hours_before_midnight_move_to_next_morning(self):
        config = ScheduleConfig(
            quiet_start=time(22, 0), quiet_end=time(8, 0), quiet_jitter_minutes=0
        )
        now = datetime(2026, 1, 1, 23, 0)
        self.assertEqual(
            config.next_active(now, FixedRng(0)), datetime(2026, 1, 2, 8, 0)
        )

    def test_same_day_quiet_hours_move_to_quiet_end(self):
        config = ScheduleConfig(
            quiet_start=time(13, 0), quiet_end=time(14, 0), quiet_jitter_minutes=0
        )
        now = datetime(2026, 1, 1, 13, 30)
        self.assertEqual(
            config.next_active(now, FixedRng(0)), datetime(2026, 1, 1, 14, 0)
        )

    def test_active_time_is_returned_unchanged(self):
        config = ScheduleConfig(quiet_start=time(22, 0), quiet_end=time(8, 0))
        now = datetime(2026, 1, 1, 12, 0)
        self.assertEqual(config.next_active(now, FixedRng(0.5)), now)

    def test_jitter_is_applied_after_quiet_hours(self):
        config = ScheduleConfig(
            quiet_start=time(22, 0), quiet_end=time(8, 0), quiet_jitter_minutes=20
        )
        now = datetime(2026, 1, 1, 23, 0)
        target = config.next_active(now, FixedRng(0.5))
        self.assertEqual(target, datetime(2026, 1, 2, 8, 10))


class NextDeliveryTests(unittest.TestCase):
    def test_delay_stays_within_configured_range(self):
        config = ScheduleConfig(
            min_minutes=45,
            max_minutes=180,
            quiet_start=time(22, 0),
            quiet_end=time(8, 0),
        )
        now = datetime(2026, 1, 1, 10, 0)
        earliest = config.next_delivery(now, FixedRng(0))
        latest = config.next_delivery(now, FixedRng(1))
        self.assertEqual(earliest, now + timedelta(minutes=45))
        self.assertEqual(latest, now + timedelta(minutes=180))

    def test_candidate_inside_quiet_hours_is_moved(self):
        config = ScheduleConfig(
            min_minutes=45,
            max_minutes=180,
            quiet_start=time(22, 0),
            quiet_end=time(8, 0),
            quiet_jitter_minutes=0,
        )
        now = datetime(2026, 1, 1, 21, 30)
        target = config.next_delivery(now, FixedRng(1))
        self.assertEqual(target, datetime(2026, 1, 2, 8, 0))

    def test_starting_inside_quiet_hours_moves_to_next_active_time(self):
        config = ScheduleConfig(
            quiet_start=time(22, 0), quiet_end=time(8, 0), quiet_jitter_minutes=0
        )
        now = datetime(2026, 1, 1, 23, 0)
        self.assertEqual(
            config.next_delivery(now, FixedRng(0.5)), datetime(2026, 1, 2, 8, 0)
        )

    def test_invalid_ranges_are_rejected(self):
        with self.assertRaises(ValueError):
            ScheduleConfig(min_minutes=0)
        with self.assertRaises(ValueError):
            ScheduleConfig(min_minutes=120, max_minutes=60)


if __name__ == "__main__":
    unittest.main()
