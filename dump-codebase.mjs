// dump-codebase.mjs
import { promises as fs } from "fs";
import path from "path";
import os from "os";

const ROOT = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const OUT_PATH = path.join(ROOT, "code_dump.txt");

// folders to always skip
const SKIP_DIRS = new Set([
  "node_modules", ".git", ".svn", ".hg", ".DS_Store",
  "dist", "build", ".next", ".vercel", ".cache", "coverage", "tmp", "out"
]);

// files to skip by name (case-insensitive)
const SKIP_FILES = [/^readme(?:\..*)?$/i, /^license(?:\..*)?$/i];

// include only these extensions (add more if you need)
const KEEP_EXT = new Set([
  ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx",
  ".json", ".html", ".css", ".scss", ".sass",
  ".glsl", ".vert", ".frag", ".md",
  ".yaml", ".yml"
]);

// max size per file to avoid giant blobs (in bytes)
const MAX_FILE_BYTES = 1_000_000; // 1 MB per file

async function isDir(p) {
  try { return (await fs.lstat(p)).isDirectory(); } catch { return false; }
}

function shouldSkipDir(name) {
  return SKIP_DIRS.has(name);
}

function shouldSkipFile(name) {
  return SKIP_FILES.some((re) => re.test(name));
}

function keepByExt(filename) {
  const ext = path.extname(filename).toLowerCase();
  return KEEP_EXT.has(ext);
}

async function* walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!shouldSkipDir(e.name)) yield* walk(full);
    } else if (e.isFile()) {
      if (shouldSkipFile(e.name)) continue;
      if (!keepByExt(e.name)) continue;
      yield full;
    }
  }
}

function withLineNumbers(text) {
  return text
    .split(/\r?\n/)
    .map((line, i) => String(i + 1).padStart(5, " ") + " | " + line)
    .join(os.EOL);
}

async function main() {
  const collected = [];
  for await (const file of walk(ROOT)) {
    try {
      const stat = await fs.stat(file);
      if (stat.size > MAX_FILE_BYTES) {
        collected.push(
          `\n===== ${path.relative(ROOT, file)} (SKIPPED: ${stat.size} bytes > ${MAX_FILE_BYTES}) =====\n`
        );
        continue;
      }
      const content = await fs.readFile(file, "utf8");
      collected.push(
        `\n===== FILE: ${path.relative(ROOT, file)} =====\n` +
        withLineNumbers(content) +
        `\n===== END FILE: ${path.relative(ROOT, file)} =====\n`
      );
    } catch (err) {
      collected.push(
        `\n===== ${path.relative(ROOT, file)} (ERROR READING: ${err.message}) =====\n`
      );
    }
  }

  await fs.writeFile(OUT_PATH, collected.join(""), "utf8");
  console.log(`Wrote ${OUT_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
