from __future__ import annotations

import argparse
import json
import random
import sys
import textwrap
import time as clock
from datetime import datetime
from datetime import time as dt_time
from pathlib import Path

from .content import content_stats, load_entries
from .delivery import deliver, format_notification, print_notification
from .history import History, HistoryError
from .models import (
    ATTRIBUTION_DESCRIPTIONS,
    ATTRIBUTIONS,
    CATEGORIES,
    CATEGORY_DESCRIPTIONS,
    FORMAT_DESCRIPTIONS,
    FORMATS,
    ContentError,
    Entry,
)
from .scheduler import ScheduleConfig
from .selector import Selector


def parse_time(value: str) -> dt_time:
    try:
        hour_text, minute_text = value.split(":", 1)
        hour = int(hour_text)
        minute = int(minute_text)
        return dt_time(hour, minute)
    except (TypeError, ValueError) as exc:
        raise argparse.ArgumentTypeError("time must be written as HH:MM") from exc


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="memento",
        description="MEMENTO MORI: periodic philosophical interruptions about power, mortality, and human nature.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    common = argparse.ArgumentParser(add_help=False)
    common.add_argument(
        "--category",
        action="append",
        choices=CATEGORIES,
        help="restrict to a category; may be repeated",
    )
    common.add_argument(
        "--format",
        dest="formats",
        action="append",
        choices=FORMATS,
        help="restrict to a format; may be repeated",
    )
    common.add_argument(
        "--attribution",
        action="append",
        choices=ATTRIBUTIONS,
        help="restrict to an attribution type; may be repeated",
    )
    common.add_argument(
        "--max-intensity",
        type=int,
        choices=range(1, 6),
        metavar="{1,2,3,4,5}",
        help="exclude entries above this intensity",
    )
    common.add_argument(
        "--history-path", type=Path, help="override the local history file"
    )
    common.add_argument(
        "--seed", type=int, help="seed the random selector for reproducible output"
    )
    common.add_argument(
        "--content", type=Path, help="override the content library path"
    )

    once = subparsers.add_parser(
        "once", parents=[common], help="deliver one notification now"
    )
    once.add_argument(
        "--dry-run",
        action="store_true",
        help="print instead of sending a desktop notification",
    )
    once.add_argument(
        "--no-history",
        action="store_true",
        help="do not read or write delivery history",
    )
    once.add_argument(
        "--json",
        action="store_true",
        help="print the selected entry as JSON without delivering",
    )
    once.add_argument("--channel", choices=("auto", "stdout"), default="auto")

    run = subparsers.add_parser(
        "run", parents=[common], help="deliver notifications periodically"
    )
    run.add_argument("--min-minutes", type=float, default=45.0)
    run.add_argument("--max-minutes", type=float, default=180.0)
    run.add_argument("--quiet-start", type=parse_time, default=dt_time(22, 0))
    run.add_argument("--quiet-end", type=parse_time, default=dt_time(8, 0))
    run.add_argument("--quiet-jitter-minutes", type=float, default=20.0)
    run.add_argument(
        "--count", type=int, default=None, help="stop after this many notifications"
    )
    run.add_argument(
        "--start-now",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="deliver the first notification immediately instead of waiting",
    )
    run.add_argument(
        "--dry-run",
        action="store_true",
        help="print instead of sending desktop notifications",
    )
    run.add_argument(
        "--no-history",
        action="store_true",
        help="do not read or write delivery history",
    )
    run.add_argument("--channel", choices=("auto", "stdout"), default="auto")

    next_parser = subparsers.add_parser(
        "next",
        parents=[common],
        help="show the next selection without delivering or recording it",
    )
    next_parser.add_argument("--json", action="store_true")

    list_parser = subparsers.add_parser(
        "list", parents=[common], help="list the content library"
    )
    list_parser.add_argument("--json", action="store_true")
    list_parser.add_argument("--limit", type=int, default=None)

    validate = subparsers.add_parser("validate", help="validate the content library")
    validate.add_argument("--content", type=Path)

    taxonomy = subparsers.add_parser("taxonomy", help="show the content taxonomy")
    taxonomy.add_argument("--content", type=Path)

    history = subparsers.add_parser("history", help="show recent delivery history")
    history.add_argument("--history-path", type=Path)
    history.add_argument("--limit", type=int, default=20)
    history.add_argument("--json", action="store_true")

    clear = subparsers.add_parser(
        "clear-history", help="delete the local delivery history"
    )
    clear.add_argument("--history-path", type=Path)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    handlers = {
        "once": cmd_once,
        "run": cmd_run,
        "next": cmd_next,
        "list": cmd_list,
        "validate": cmd_validate,
        "taxonomy": cmd_taxonomy,
        "history": cmd_history,
        "clear-history": cmd_clear_history,
    }
    try:
        return handlers[args.command](args)
    except ContentError as exc:
        print(f"Content error:\n{exc}", file=sys.stderr)
        return 2
    except HistoryError as exc:
        print(f"History error: {exc}", file=sys.stderr)
        return 1
    except ValueError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 2


def _load_content(args: argparse.Namespace) -> list[Entry]:
    return load_entries(getattr(args, "content", None))


def _filtered_entries(args: argparse.Namespace) -> list[Entry]:
    entries = _load_content(args)

    if args.category:
        categories = set(args.category)
        entries = [entry for entry in entries if entry.category in categories]
    if args.formats:
        formats = set(args.formats)
        entries = [entry for entry in entries if entry.format in formats]
    if args.attribution:
        attributions = set(args.attribution)
        entries = [entry for entry in entries if entry.attribution in attributions]
    if args.max_intensity is not None:
        entries = [entry for entry in entries if entry.intensity <= args.max_intensity]

    if not entries:
        raise ValueError("no content matches the requested filters")
    return entries


def _selector(args: argparse.Namespace, entries: list[Entry]) -> Selector:
    return Selector(entries, rng=random.Random(args.seed))


def _history(args: argparse.Namespace) -> History:
    return History(getattr(args, "history_path", None))


def _recent_ids(
    history: History, selector: Selector, args: argparse.Namespace
) -> list[str]:
    if getattr(args, "no_history", False):
        return []
    try:
        return history.recent_ids(selector.config.recent_window)
    except HistoryError as exc:
        print(f"History warning: {exc}", file=sys.stderr)
        return []


def cmd_once(args: argparse.Namespace) -> int:
    entries = _filtered_entries(args)
    selector = _selector(args, entries)
    history = _history(args)
    entry = selector.choose(_recent_ids(history, selector, args))

    if args.json:
        print(json.dumps(entry.to_dict(), indent=2, ensure_ascii=False))
        return 0

    channel = deliver(entry, channel=args.channel, dry_run=args.dry_run)
    if not args.no_history and not args.dry_run:
        try:
            history.add(entry.id, channel=channel)
        except HistoryError as exc:
            print(f"History warning: {exc}", file=sys.stderr)
    return 0


def cmd_next(args: argparse.Namespace) -> int:
    entries = _filtered_entries(args)
    selector = _selector(args, entries)
    history = _history(args)
    entry = selector.choose(_recent_ids(history, selector, args))

    if args.json:
        print(json.dumps(entry.to_dict(), indent=2, ensure_ascii=False))
    else:
        title, body = format_notification(entry)
        print_notification(title, body)
    return 0


def cmd_run(args: argparse.Namespace) -> int:
    entries = _filtered_entries(args)
    selector = _selector(args, entries)
    history = _history(args)
    config = ScheduleConfig(
        min_minutes=args.min_minutes,
        max_minutes=args.max_minutes,
        quiet_start=args.quiet_start,
        quiet_end=args.quiet_end,
        quiet_jitter_minutes=args.quiet_jitter_minutes,
    )
    rng = selector.rng
    delivered = 0
    first = True
    session_history: list[str] = []

    try:
        while args.count is None or delivered < args.count:
            now = datetime.now().astimezone()

            if config.is_quiet(now):
                target = config.next_active(now, rng)
                print(
                    f"Quiet hours. Next possible delivery: {target:%Y-%m-%d %H:%M}.",
                    flush=True,
                )
                _sleep_until(target)
                first = False
                continue

            if first and args.start_now:
                target = now
            else:
                target = config.next_delivery(now, rng)
                print(f"Next MEMENTO at {target:%Y-%m-%d %H:%M}.", flush=True)
                _sleep_until(target)

            now = datetime.now().astimezone()
            if config.is_quiet(now):
                first = False
                continue

            history_ids = _recent_ids(history, selector, args)
            entry = selector.choose([*history_ids, *session_history])
            channel = deliver(entry, channel=args.channel, dry_run=args.dry_run)
            if not args.no_history and not args.dry_run:
                try:
                    history.add(entry.id, channel=channel)
                except HistoryError as exc:
                    print(f"History warning: {exc}", file=sys.stderr)

            session_history.append(entry.id)
            delivered += 1
            first = False
    except KeyboardInterrupt:
        print("\nStopped.", file=sys.stderr)
        return 0

    return 0


def cmd_list(args: argparse.Namespace) -> int:
    entries = _filtered_entries(args)

    if args.json:
        print(
            json.dumps(
                [entry.to_dict() for entry in entries], indent=2, ensure_ascii=False
            )
        )
        return 0

    limit = len(entries) if args.limit is None else max(0, args.limit)
    for entry in entries[:limit]:
        author = f" — {entry.author}" if entry.author else ""
        text = textwrap.shorten(entry.text, width=110, placeholder="...")
        print(
            f"{entry.id}  [{entry.category}/{entry.format}/{entry.attribution}]{author}"
        )
        print(f"  {text}")
    if limit < len(entries):
        print(f"({len(entries) - limit} more entries)")
    return 0


def cmd_validate(args: argparse.Namespace) -> int:
    entries = load_entries(args.content)
    stats = content_stats(entries)
    print(f"Content is valid: {len(entries)} entries.")
    print(
        "Categories: "
        + ", ".join(f"{key}={stats['categories'][key]}" for key in CATEGORIES)
    )
    print("Formats: " + ", ".join(f"{key}={stats['formats'][key]}" for key in FORMATS))
    print(
        "Attributions: "
        + ", ".join(f"{key}={stats['attributions'][key]}" for key in ATTRIBUTIONS)
    )
    return 0


def cmd_taxonomy(args: argparse.Namespace) -> int:
    entries = _load_content(args)
    stats = content_stats(entries)
    print(f"MEMENTO content taxonomy ({len(entries)} entries)")
    print("\nCategories:")
    for category in CATEGORIES:
        print(
            f"  {category} ({stats['categories'][category]}): {CATEGORY_DESCRIPTIONS[category]}"
        )
    print("\nFormats:")
    for entry_format in FORMATS:
        print(
            f"  {entry_format} ({stats['formats'][entry_format]}): {FORMAT_DESCRIPTIONS[entry_format]}"
        )
    print("\nAttribution types:")
    for attribution in ATTRIBUTIONS:
        print(
            f"  {attribution} ({stats['attributions'][attribution]}): "
            f"{ATTRIBUTION_DESCRIPTIONS[attribution]}"
        )
    print("\nThemes:")
    for theme, count in sorted(stats["themes"].items()):
        print(f"  {theme} ({count})")
    return 0


def cmd_history(args: argparse.Namespace) -> int:
    history = _history(args)
    records = history.load()
    limit = max(0, args.limit)
    shown = records[-limit:] if limit else []

    if args.json:
        print(
            json.dumps(
                [record.to_dict() for record in shown], indent=2, ensure_ascii=False
            )
        )
        return 0

    if not records:
        print("No delivery history yet.")
        return 0
    if not shown:
        print("No history entries to show.")
        return 0

    for record in shown:
        print(f"{record.at}  {record.id}  [{record.channel}]")
    return 0


def cmd_clear_history(args: argparse.Namespace) -> int:
    history = _history(args)
    history.clear()
    print(f"Cleared history at {history.path}.")
    return 0


def _sleep_until(target: datetime) -> None:
    while True:
        remaining = (target - datetime.now(target.tzinfo)).total_seconds()
        if remaining <= 0:
            return
        clock.sleep(min(remaining, 60.0))


if __name__ == "__main__":
    raise SystemExit(main())
