from __future__ import annotations

import random
from dataclasses import dataclass
from datetime import datetime, time, timedelta


@dataclass(frozen=True)
class ScheduleConfig:
    min_minutes: float = 45.0
    max_minutes: float = 180.0
    quiet_start: time = time(22, 0)
    quiet_end: time = time(8, 0)
    quiet_jitter_minutes: float = 20.0

    def __post_init__(self) -> None:
        if self.min_minutes <= 0:
            raise ValueError("min_minutes must be positive")
        if self.max_minutes < self.min_minutes:
            raise ValueError("max_minutes must be greater than or equal to min_minutes")
        if self.quiet_jitter_minutes < 0:
            raise ValueError("quiet_jitter_minutes must not be negative")

    def is_quiet(self, moment: datetime) -> bool:
        return _is_quiet(moment.time(), self.quiet_start, self.quiet_end)

    def next_active(self, moment: datetime, rng: random.Random) -> datetime:
        """Return the first active time after a quiet period, with natural jitter."""
        if not self.is_quiet(moment):
            return moment

        end = datetime.combine(moment.date(), self.quiet_end, tzinfo=moment.tzinfo)
        if end <= moment:
            end += timedelta(days=1)

        jitter = rng.uniform(0.0, self.quiet_jitter_minutes * 60.0)
        return end + timedelta(seconds=jitter)

    def next_delivery(self, moment: datetime, rng: random.Random) -> datetime:
        """Pick a varied delivery time, never inside quiet hours."""
        if self.is_quiet(moment):
            return self.next_active(moment, rng)

        delay = rng.uniform(self.min_minutes * 60.0, self.max_minutes * 60.0)
        candidate = moment + timedelta(seconds=delay)
        if self.is_quiet(candidate):
            return self.next_active(candidate, rng)
        return candidate


def _is_quiet(current: time, start: time, end: time) -> bool:
    if start == end:
        return False
    if start < end:
        return start <= current < end
    return current >= start or current < end
