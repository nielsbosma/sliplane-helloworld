import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const dir = process.env.DATA_DIR;

export const diskConfigured = Boolean(dir);

const read = (name) => readFile(join(dir, name), "utf8").catch(() => undefined);

/** Counts starts in a file on the volume, so the number survives redeploys. */
export async function recordStart() {
  if (!dir) return;
  try {
    await mkdir(dir, { recursive: true });
    const starts = Number((await read("starts.txt")) ?? 0) + 1;
    await writeFile(join(dir, "starts.txt"), String(starts));
  } catch (error) {
    console.error(`Can't write to ${dir}: ${error.message}`);
  }
}

export async function diskState() {
  return { starts: Number((await read("starts.txt")) ?? 0), note: (await read("note.txt")) ?? "" };
}

export const saveNote = (text) => writeFile(join(dir, "note.txt"), text);
