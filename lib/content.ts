import contentData from "@/memento/content.json";

export type Category = "emperors" | "power" | "philosophy" | "mortality" | "humility";
export type EntryFormat = "statement" | "question" | "reflection" | "paradox" | "observation";
export type Attribution = "quotation" | "paraphrase" | "observation" | "original";

export interface Entry {
  id: string;
  category: Category;
  format: EntryFormat;
  text: string;
  attribution: Attribution;
  themes: string[];
  intensity: number;
  author?: string | null;
  work?: string | null;
  source?: string | null;
  note?: string | null;
}

export const CONTENT_VOICE = contentData.voice as string;
export const ENTRIES = contentData.entries as Entry[];

export const CATEGORIES: Category[] = [
  "emperors",
  "power",
  "philosophy",
  "mortality",
  "humility",
];

export const FORMATS: EntryFormat[] = [
  "statement",
  "question",
  "reflection",
  "paradox",
  "observation",
];

export const ATTRIBUTIONS: Attribution[] = [
  "quotation",
  "paraphrase",
  "observation",
  "original",
];

export const CATEGORY_META: Record<Category, { label: string; description: string }> = {
  emperors: {
    label: "Emperors",
    description: "Roman rulers: their lives, decisions, victories, excesses, failures, deaths, and legacies.",
  },
  power: {
    label: "Power",
    description: "Ambition, conquest, authority, glory, tyranny, succession, and the fragility of control.",
  },
  philosophy: {
    label: "Philosophy",
    description: "Stoicism and other schools that illuminate power, mortality, virtue, ego, and human nature.",
  },
  mortality: {
    label: "Mortality",
    description: "The impermanence of status, wealth, reputation, empires, and life itself.",
  },
  humility: {
    label: "Humility",
    description: "The limits, contradictions, weaknesses, and self-deceptions shared by human beings.",
  },
};

export const FORMAT_META: Record<EntryFormat, { label: string; description: string }> = {
  statement: { label: "Statement", description: "A direct claim or observation." },
  question: { label: "Question", description: "A question that turns the reader inward." },
  reflection: { label: "Reflection", description: "A longer thought meant to be sat with." },
  paradox: { label: "Paradox", description: "A tension that does not resolve neatly." },
  observation: { label: "Observation", description: "A grounded historical or human observation." },
};

export const ATTRIBUTION_META: Record<Attribution, { label: string; description: string }> = {
  quotation: {
    label: "Quotation",
    description: "A translated or verbatim quotation from a named source.",
  },
  paraphrase: {
    label: "Paraphrase",
    description: "An attributed paraphrase, not presented as a direct quotation.",
  },
  observation: {
    label: "Historical note",
    description: "A historical observation grounded in the cited source.",
  },
  original: {
    label: "Original",
    description: "AI-generated original writing for MEMENTO. Not a historical quotation.",
  },
};

const entriesById = new Map(ENTRIES.map((entry) => [entry.id, entry]));

export function getEntry(id: string): Entry | undefined {
  return entriesById.get(id);
}

export function attributionLines(entry: Entry): string[] {
  const lines: string[] = [];

  if (entry.attribution === "quotation") {
    lines.push(`Quotation — ${entry.author}, ${entry.work}`);
  } else if (entry.attribution === "paraphrase") {
    lines.push(`Paraphrase — ${entry.author}, ${entry.work}`);
  } else if (entry.attribution === "observation") {
    lines.push("Historical note");
  } else {
    lines.push("Original reflection — MEMENTO MORI (AI-generated, not a quotation)");
  }

  if (entry.attribution !== "original" && entry.source) {
    lines.push(`Source: ${entry.source}`);
  }
  if (entry.note) {
    lines.push(`Note: ${entry.note}`);
  }

  return lines;
}

export function attributionSummary(entry: Entry): string {
  if (entry.attribution === "quotation" || entry.attribution === "paraphrase") {
    return `${entry.author} · ${entry.work}`;
  }
  if (entry.attribution === "observation") {
    return entry.source ?? "Historical note";
  }
  return "Original reflection";
}

export function entrySearchText(entry: Entry): string {
  return [
    entry.text,
    entry.author,
    entry.work,
    entry.source,
    entry.note,
    entry.category,
    entry.format,
    entry.attribution,
    ...entry.themes,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function selectEntry(
  historyIds: string[] = [],
  entries: Entry[] = ENTRIES,
  random: () => number = Math.random,
): Entry {
  if (entries.length === 0) {
    throw new Error("cannot select from an empty content library");
  }

  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const recent = historyIds
    .slice(-20)
    .map((id) => byId.get(id))
    .filter((entry): entry is Entry => entry !== undefined);

  const recentIds = new Set(recent.map((entry) => entry.id));
  let pool = entries.filter((entry) => !recentIds.has(entry.id));

  if (pool.length === 0) {
    const lastId = recent.at(-1)?.id;
    pool = entries.filter((entry) => entry.id !== lastId);
  }
  if (pool.length === 0) {
    pool = [...entries];
  }

  const last = recent.at(-1);

  const seenCategories = new Set(recent.slice(-8).map((entry) => entry.category));
  const freshCategories = pool.filter((entry) => !seenCategories.has(entry.category));
  if (freshCategories.length > 0) {
    pool = freshCategories;
  } else if (last) {
    const differentCategory = pool.filter((entry) => entry.category !== last.category);
    if (differentCategory.length > 0) {
      pool = differentCategory;
    }
  }

  const seenFormats = new Set(recent.slice(-4).map((entry) => entry.format));
  const freshFormats = pool.filter((entry) => !seenFormats.has(entry.format));
  if (freshFormats.length > 0) {
    pool = freshFormats;
  } else if (last) {
    const differentFormat = pool.filter((entry) => entry.format !== last.format);
    if (differentFormat.length > 0) {
      pool = differentFormat;
    }
  }

  const categoryCounts = countBy(recent.map((entry) => entry.category));
  const formatCounts = countBy(recent.map((entry) => entry.format));
  const themeCounts = countBy(recent.flatMap((entry) => entry.themes));

  const weights = pool.map((entry) => {
    let weight = 1;
    weight /= 1 + (categoryCounts.get(entry.category) ?? 0);
    weight /= 1 + (formatCounts.get(entry.format) ?? 0);
    for (const theme of entry.themes) {
      weight /= 1 + (themeCounts.get(theme) ?? 0);
    }
    return weight;
  });

  return weightedChoice(pool, weights, random);
}

function countBy(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

function weightedChoice<T>(items: T[], weights: number[], random: () => number): T {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) {
    return items[Math.floor(random() * items.length)];
  }

  let threshold = random() * total;
  for (let index = 0; index < items.length; index += 1) {
    threshold -= weights[index];
    if (threshold <= 0) {
      return items[index];
    }
  }
  return items[items.length - 1];
}
