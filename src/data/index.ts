import { Hono } from "hono";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { cwd } from "node:process";

const DATA_DIR = join(cwd(), "data");
const MOVIES_FILE = join(DATA_DIR, "douban-movies.json");
const TV_FILE = join(DATA_DIR, "douban-tv.json");

const app = new Hono();

// Serve douban-movies.json
app.get("/douban-movies.json", async (c) => {
  try {
    if (!existsSync(MOVIES_FILE)) {
      return c.json({ error: "File not found" }, 404);
    }
    const content = await readFile(MOVIES_FILE, "utf-8");
    const json = JSON.parse(content);
    return c.json(json);
  } catch (error) {
    console.error("Error reading movies file:", error);
    return c.json({ error: "Failed to read file" }, 500);
  }
});

// Serve douban-tv.json
app.get("/douban-tv.json", async (c) => {
  try {
    if (!existsSync(TV_FILE)) {
      return c.json({ error: "File not found" }, 404);
    }
    const content = await readFile(TV_FILE, "utf-8");
    const json = JSON.parse(content);
    return c.json(json);
  } catch (error) {
    console.error("Error reading TV file:", error);
    return c.json({ error: "Failed to read file" }, 500);
  }
});

export default app;
