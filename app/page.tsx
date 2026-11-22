import Link from "next/link";

import { MementoExperience } from "@/components/MementoExperience";
import { NotificationOnboarding } from "@/components/NotificationOnboarding";
import { ENTRIES, selectEntry } from "@/lib/content";

const initialEntry = selectEntry([], ENTRIES, () => 0.42);

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <p className="eyebrow">A notification-first philosophical companion</p>
        <h1>
          MEMENTO
          <br />
          MORI
        </h1>
        <p className="hero-copy">
          To periodically interrupt ordinary life with reminders of mortality, impermanence,
          humility, human nature, and the realities people tend to forget.
        </p>
        <div className="hero-links">
          <Link href="/library" className="button">
            Explore the library
          </Link>
          <Link href="/settings" className="button button-ghost">
            Notification settings
          </Link>
        </div>
      </section>

      <section className="home-grid">
        <MementoExperience initialEntry={initialEntry} />

        <aside className="home-aside">
          <NotificationOnboarding />

          <section className="panel">
            <p className="eyebrow">The attendant</p>
            <h2>Not a task manager</h2>
            <p className="panel-copy">
              MEMENTO is not a calendar, habit tracker, or system for reminding you of goals you
              entered. It is a voice reminding you of what success and power can make you forget.
            </p>
            <Link href="/library" className="text-link">
              Browse the content archive
            </Link>
          </section>
        </aside>
      </section>
    </>
  );
}
