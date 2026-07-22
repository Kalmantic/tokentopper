import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function markdownFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      if ([".git", "node_modules", "dist"].includes(entry.name)) return [];
      return markdownFiles(path);
    }
    return entry.isFile() && entry.name.endsWith(".md") ? [path] : [];
  });
}

let links = 0;
for (const file of markdownFiles(root)) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(/\]\(([^)]+)\)/g)) {
    let target = match[1].trim();
    if (target.startsWith("<") && target.endsWith(">")) target = target.slice(1, -1);
    if (!target || target.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
    target = decodeURIComponent(target.split("#", 1)[0].split("?", 1)[0]);
    const destination = resolve(dirname(file), target);
    assert(existsSync(destination), `${relative(root, file)} links to missing ${target}`);
    assert(statSync(destination).isFile() || statSync(destination).isDirectory(), `${relative(root, file)} links to an unsupported target ${target}`);
    links += 1;
  }
}

console.log(`verified ${links} relative documentation links`);
