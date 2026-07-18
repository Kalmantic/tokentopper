import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const DIR = join(homedir(), ".tokentopper");
const PATH = join(DIR, "config.json");

export interface Config {
  endpoint?: string;
  token?: string;
}

const DEFAULT_ENDPOINT = "https://tokentopper-api-398148474652.us-central1.run.app/v1/usage";

export function readConfig(): Config {
  if (!existsSync(PATH)) return {};
  try {
    return JSON.parse(readFileSync(PATH, "utf8")) as Config;
  } catch {
    return {};
  }
}

export function writeConfig(patch: Config): Config {
  const merged = { ...readConfig(), ...patch };
  mkdirSync(DIR, { recursive: true });
  writeFileSync(PATH, JSON.stringify(merged, null, 2), { mode: 0o600 });
  return merged;
}

export function resolveEndpoint(flag?: string): string {
  return flag || process.env.TOKENTOPPER_ENDPOINT || readConfig().endpoint || DEFAULT_ENDPOINT;
}

export function resolveToken(flag?: string): string | undefined {
  return flag || process.env.TOKENTOPPER_TOKEN || readConfig().token;
}
