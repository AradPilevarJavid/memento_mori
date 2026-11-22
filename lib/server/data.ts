import { promises as fs } from "node:fs";
import path from "node:path";

export function dataDir(): string {
  const configured = process.env.MEMENTO_DATA_DIR;
  return configured && configured.length > 0
    ? configured
    : path.join(process.cwd(), ".data");
}

export function dataFile(name: string): string {
  return path.join(/*turbopackIgnore: true*/ dataDir(), name);
}

export async function readJsonFile<T>(name: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(
      /*turbopackIgnore: true*/ dataFile(name),
      "utf8",
    );
    return JSON.parse(raw) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return fallback;
    }
    return fallback;
  }
}

export async function writeJsonFile(name: string, value: unknown): Promise<void> {
  const file = dataFile(name);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await fs.rename(temporary, file);
}
