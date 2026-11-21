from __future__ import annotations

import json
import platform
import shutil
import subprocess
import sys
from typing import TextIO

from .models import Entry


def attribution_label(entry: Entry) -> str:
    lines: list[str] = []

    if entry.attribution == "quotation":
        lines.append(f"Quotation — {entry.author}, {entry.work}")
    elif entry.attribution == "paraphrase":
        lines.append(f"Paraphrase — {entry.author}, {entry.work}")
    elif entry.attribution == "observation":
        lines.append("Historical note")
    else:
        lines.append(
            "Original reflection — MEMENTO MORI (AI-generated, not a quotation)"
        )

    if entry.attribution != "original" and entry.source:
        lines.append(f"Source: {entry.source}")
    if entry.note:
        lines.append(f"Note: {entry.note}")

    return "\n".join(lines)


def format_notification(entry: Entry) -> tuple[str, str]:
    title = f"MEMENTO MORI · {entry.category.title()}"
    body = f"{entry.text}\n\n{attribution_label(entry)}"
    return title, body


def deliver(
    entry: Entry,
    *,
    channel: str = "auto",
    dry_run: bool = False,
    stream: TextIO | None = None,
) -> str:
    output = sys.stdout if stream is None else stream
    title, body = format_notification(entry)

    if dry_run or channel == "stdout":
        print_notification(title, body, stream=output)
        return "stdout"

    if channel == "auto":
        sent = _send_desktop(title, body)
        if sent is not None:
            return sent

    print_notification(title, body, stream=output)
    return "stdout"


def print_notification(title: str, body: str, *, stream: TextIO | None = None) -> None:
    output = sys.stdout if stream is None else stream
    rule = "-" * 60
    output.write(f"{rule}\n{title}\n{rule}\n{body}\n{rule}\n")
    output.flush()


def _send_desktop(title: str, body: str) -> str | None:
    system = platform.system()

    if shutil.which("notify-send"):
        try:
            subprocess.run(
                [
                    "notify-send",
                    "--app-name=MEMENTO MORI",
                    "--urgency=normal",
                    "--expire-time=15000",
                    title,
                    body,
                ],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            return "desktop"
        except (OSError, subprocess.CalledProcessError):
            pass

    if system == "Darwin" and shutil.which("osascript"):
        script = (
            f"display notification {json.dumps(body)} with title {json.dumps(title)}"
        )
        try:
            subprocess.run(
                ["osascript", "-e", script],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            return "desktop"
        except (OSError, subprocess.CalledProcessError):
            pass

    return None
