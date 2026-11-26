# MEMENTO MORI

MEMENTO MORI is a philosophical notification companion inspired by the Roman tradition of being reminded of mortality, human limitations, and the impermanence of power and achievement.

It is not a task manager, habit tracker, or conventional productivity reminder. Its purpose is to interrupt ordinary life with ideas worth remembering.

## The idea

> To periodically interrupt ordinary life with reminders of mortality, impermanence, humility, human nature, and the realities people tend to forget.

The central historical and philosophical lens is ancient Rome: Roman emperors and generals, conquest, political power, triumph, ambition, glory, philosophy, decline, and the limits of human control. The project uses these subjects to examine what power can do to people—and what even the most powerful people cannot escape.

MEMENTO should feel like the attendant behind a victorious Roman ruler: not a servant telling them what to do next, but a voice reminding them of truths that success and power can make them forget.

## What MEMENTO is — and is not

- **It is** a notification-first philosophical companion.
- **It is** interested in mortality, impermanence, humility, ego, ambition, power, conquest, human nature, and meaning.
- **It is** informed by Roman history and philosophy, while being free to explore wider philosophical ideas.
- **It is not** a calendar, task manager, habit tracker, or system for reminding users of goals they explicitly entered.
- **It should not** rely on generic motivational quotes or send notifications just to increase engagement.

## Roadmap

The roadmap is ordered around proving the notification experience first, then making it reliable and available across platforms.

### Step 1 — Implement the core philosophical notification experience

**Build the experience MEMENTO exists to deliver:**

> To periodically interrupt ordinary life with reminders of mortality, impermanence, humility, human nature, and the realities people tend to forget.

The first content and notification system must focus especially on:

- **Roman emperors and rulers:** their lives, decisions, victories, excesses, failures, deaths, and legacies.
- **Power and conquest:** ambition, domination, military victory, political authority, glory, tyranny, succession, and the fragility of control.
- **Philosophy:** especially Stoicism and Roman thinkers, alongside other schools that illuminate power, mortality, virtue, ego, and human nature.
- **Mortality and impermanence:** the fact that status, wealth, reputation, empires, and life itself are temporary.
- **Humility and human nature:** the limits, contradictions, weaknesses, and self-deceptions shared by human beings.

Initial implementation work:

- Establish a clear content taxonomy and a distinctive MEMENTO voice.
- Create a curated foundation of short statements, questions, reflections, paradoxes, and historical observations.
- Support both carefully sourced historical material and original philosophical writing.
- Clearly distinguish authentic quotations, attributed paraphrases, and AI-generated text. Never invent a quotation or attribute it to a historical figure without evidence.
- Build a notification selector that varies topics and formats and avoids unnecessary repetition.
- Deliver notifications periodically and naturally, rather than turning them into fixed task reminders.
- Keep the content thoughtful, direct, and sometimes confrontational without becoming abusive or artificially dramatic.

**Milestone:** A working prototype that can deliver varied, meaningful philosophical notifications. It should demonstrate the identity of MEMENTO before the project expands into a full application.

### Step 2 — Build the web application and installable PWA

- Build a responsive web application with an installable Progressive Web App (PWA) experience.
- Establish the application shell, navigation, settings, notification history, and content presentation.
- Implement the web app manifest and service worker.
- Add notification permission onboarding that is explicit and user-initiated.
- Implement Web Push so notifications can arrive when the web app is not open.
- Test installation and notification delivery on Android and Windows from the beginning.

**Milestone:** An installable web-first MEMENTO that can deliver real system notifications on supported Android and Windows browsers.

### Step 3 — Build the notification delivery system

- Implement a backend delivery queue and background scheduler.
- Support configurable frequency, active hours, quiet hours, and maximum delivery limits.
- Use varied delivery times within the user's chosen boundaries instead of a rigid daily reminder schedule.
- Track device subscriptions and delivery outcomes.
- Handle expired subscriptions, retries, and duplicate prevention.
- Add controls to pause, resume, and disable notifications.

**Milestone:** Reliable, controlled notification delivery without requiring the application to remain open.

### Step 4 — Add personalization and interaction

- Let users select philosophical themes and preferred intensity.
- Learn from explicit feedback such as useful, not useful, save, or hide.
- Prevent repetitive ideas, not merely repeated wording.
- Provide a notification archive and saved collection.
- Allow users to open a notification for a longer reflection or discussion.
- Keep personal context and reflections local by default; make any synchronization or cloud transmission explicit and user-controlled.

**Milestone:** Notifications become increasingly relevant to the user's interests without turning MEMENTO into a productivity tracker or surveillance tool.

### Step 5 — Introduce the AI Attendant

- Add a provider-independent AI layer.
- Support cloud inference and optional local inference where a device can run it.
- Use AI to compose original reflections, adapt tone, explore philosophical connections, and personalize content.
- Ground historical claims and quotations in reliable sources.
- Keep curated content available as a dependable alternative to generated content.
- Make cloud use transparent and obtain consent before sending personal context to an external provider.

**Milestone:** MEMENTO can act as an intellectually engaging philosophical companion, rather than only selecting from a static content library.

### Step 6 — Deliver a first-class Android experience

- Validate the PWA experience on real Android devices.
- Evaluate a native Android implementation or wrapper if it materially improves notification reliability, background behavior, onboarding, or platform integration.
- Preserve the same content, preferences, and identity across the web and Android experiences.
- Test notification channels, permission flows, battery restrictions, and delivery behavior across Android versions and device manufacturers.

**Milestone:** Android becomes a fully supported primary platform, not merely a narrow-screen version of the website.

### Step 7 — Deliver a first-class Windows experience

- Validate installation and notifications through supported Windows browsers.
- Evaluate a packaged desktop application if it provides meaningful improvements over the PWA.
- Support Windows startup behavior, notification interaction, and application updates where appropriate.
- Preserve the same user experience and settings as the web and Android versions.

**Milestone:** MEMENTO feels native and dependable on Windows while sharing its core product and content systems.

### Step 8 — Refine, evaluate, and release

- Evaluate content quality, historical accuracy, diversity, and repetition.
- Test notification delivery, scheduling, privacy, and failure recovery.
- Improve accessibility, performance, onboarding, and documentation.
- Add export and deletion controls for user data.
- Prepare production deployment and platform-specific release processes.

**Milestone:** A stable cross-platform release built around the quality of its philosophical interruptions.

## Product principles

1. **The notification is the product.** The value is in what arrives, not in how long someone spends inside the application.
2. **Interrupt, don't manage.** MEMENTO offers perspective; it does not assign tasks or police the user's schedule.
3. **History matters.** Roman rulers, emperors, conquest, political power, and the rise and fall of empires are central lenses—not decorative themes.
4. **Philosophy over motivation.** Prefer honest questions and intellectually serious reflections over shallow encouragement.
5. **Accuracy over drama.** Historical facts and quotations must be verifiable and clearly attributed.
6. **Restraint matters.** Frequency controls, quiet hours, and repetition prevention protect the experience from becoming noise.
7. **Privacy by default.** Personal reflections and context should remain local unless the user explicitly chooses otherwise.
8. **Cross-platform from the start.** Web/PWA is the first implementation, with Android and Windows treated as primary platforms.

## Initial technical direction

The implementation should validate a web-first, cross-platform architecture before committing to separate native applications.

- **Web/PWA:** Next.js and TypeScript.
- **Backend:** Next.js server routes and a standalone Node scheduler for the current web/PWA delivery system. A Python/FastAPI service can replace the scheduler if operational needs require it.
- **Push notifications:** Service workers and Web Push for the initial cross-platform implementation.
- **Local data:** Browser-local storage for preferences and private context by default.
- **AI:** A provider abstraction that can support cloud models and optional local inference.
- **Native platforms:** Evaluate Android and Windows wrappers only when platform testing demonstrates a concrete need.

These are implementation directions, not reasons to over-engineer the first milestone. Step 1 should establish the content, voice, and notification experience that make MEMENTO worth building.

## GitHub Pages

The static project overview is published from `docs/` at [aradpilevarjavid.github.io/memento_mori](https://aradpilevarjavid.github.io/memento_mori/). It is a project landing page, not a hosted instance of the Next.js application; the app's server routes and push-delivery features require a runtime that GitHub Pages does not provide.

The `Deploy GitHub Pages` workflow publishes the site on pushes to `master` and can also be started manually. In the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**.

## Running locally

```bash
npm install
npm run setup:vapid
npm run dev
```

In a second terminal, start the delivery scheduler:

```bash
npm run scheduler
```

Use `npm run scheduler:once` for a single pass, and add `-- --dry-run` to inspect due work without sending. Scheduler state lives in `.data/` by default; set `MEMENTO_DATA_DIR` to move it. Run `npm test` for the web and Python test suites.
