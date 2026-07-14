import {
  generateKeyPairSync,
  sign as edSign,
  verify as edVerify,
  createPublicKey,
  createPrivateKey,
  createHash,
} from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { homedir, hostname, platform } from "node:os";
import { join } from "node:path";

const DIR = join(homedir(), ".tokentopper");
const KEY_PATH = join(DIR, "key.json");

interface KeyPair {
  privatePem: string;
  publicPem: string;
}

// A per-install Ed25519 key. The server binds the public key to your account on
// the first upload; later uploads must be signed by the same key. This makes an
// export tamper-evident after it leaves your machine. The private key never leaves
// ~/.tokentopper/key.json (0600).
export function loadOrCreateKey(): KeyPair {
  if (existsSync(KEY_PATH)) {
    return JSON.parse(readFileSync(KEY_PATH, "utf8")) as KeyPair;
  }
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const kp: KeyPair = {
    privatePem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    publicPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
  };
  mkdirSync(DIR, { recursive: true });
  writeFileSync(KEY_PATH, JSON.stringify(kp, null, 2), { mode: 0o600 });
  return kp;
}

// Pseudonymous, stable per machine. A one-way hash so we can spot one person
// double-counting across machines without learning the machine.
export function machineId(): string {
  return createHash("sha256").update(`${hostname()}|${platform()}|${homedir()}`).digest("hex").slice(0, 16);
}

// Deterministic JSON so the same payload always signs and verifies identically.
export function canonical(obj: unknown): string {
  return JSON.stringify(sortKeys(obj));
}

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") {
    const src = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(src).sort()) out[k] = sortKeys(src[k]);
    return out;
  }
  return v;
}

export interface Signed<T> {
  schema: "tokentopper-signed/1";
  alg: "ed25519";
  machineId: string;
  publicKey: string; // base64 of SPKI PEM
  signature: string; // base64 of Ed25519 signature over canonical(payload)
  payload: T;
}

export function signAggregate<T>(payload: T): Signed<T> {
  const { privatePem, publicPem } = loadOrCreateKey();
  const data = Buffer.from(canonical(payload), "utf8");
  const signature = edSign(null, data, createPrivateKey(privatePem)).toString("base64");
  return {
    schema: "tokentopper-signed/1",
    alg: "ed25519",
    machineId: machineId(),
    publicKey: Buffer.from(publicPem, "utf8").toString("base64"),
    signature,
    payload,
  };
}

// Exposed so the same code can verify (used by tests and by the server port).
export function verifySigned<T>(env: Signed<T>): boolean {
  try {
    const pubPem = Buffer.from(env.publicKey, "base64").toString("utf8");
    const data = Buffer.from(canonical(env.payload), "utf8");
    return edVerify(null, data, createPublicKey(pubPem), Buffer.from(env.signature, "base64"));
  } catch {
    return false;
  }
}
