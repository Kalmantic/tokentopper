import { Buffer } from "node:buffer";
import { validateAggregateV2, type AggregateV2 } from "./report.ts";
import { verifySigned, type Signed } from "./sign.ts";

export interface AggregateValidationLimits {
  maxEnvelopeBytes: number;
  maxDays: number;
  maxToolsPerDay: number;
  maxModelsPerDay: number;
  maxModelsPerTool: number;
  maxNameLength: number;
  maxFutureSkewMs: number;
  oldestAcceptedDay: string;
  maxCostPerMillionTokens: number;
}

export const DEFAULT_AGGREGATE_VALIDATION_LIMITS: AggregateValidationLimits = {
  maxEnvelopeBytes: 2 * 1024 * 1024,
  maxDays: 800,
  maxToolsPerDay: 16,
  maxModelsPerDay: 128,
  maxModelsPerTool: 128,
  maxNameLength: 160,
  maxFutureSkewMs: 5 * 60 * 1000,
  oldestAcceptedDay: "2020-01-01",
  maxCostPerMillionTokens: 1000,
};

export interface AggregateValidationResult {
  ok: boolean;
  errors: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function serialisedBytes(value: unknown): number | null {
  try {
    const json = JSON.stringify(value);
    return typeof json === "string" ? Buffer.byteLength(json, "utf8") : null;
  } catch {
    return null;
  }
}

function validDate(value: string): number | null {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function validateObjectShape(value: Record<string, unknown>, errors: string[]): AggregateV2 | null {
  if (value.schema !== "tokentopper-signed/1") errors.push("envelope.schema must be tokentopper-signed/1");
  if (value.alg !== "ed25519") errors.push("envelope.alg must be ed25519");
  if (typeof value.machineId !== "string" || !/^[a-f0-9]{16}$/.test(value.machineId)) {
    errors.push("envelope.machineId must be a 16-character lowercase hexadecimal installation ID");
  }
  if (typeof value.publicKey !== "string" || value.publicKey.length < 100 || value.publicKey.length > 512) {
    errors.push("envelope.publicKey has an invalid encoded length");
  }
  if (typeof value.signature !== "string" || value.signature.length < 80 || value.signature.length > 256) {
    errors.push("envelope.signature has an invalid encoded length");
  }
  if (!isRecord(value.payload)) {
    errors.push("envelope.payload must be an object");
    return null;
  }

  const payload = value.payload;
  if (payload.schema !== "tokentopper/2") errors.push("payload.schema must be tokentopper/2");
  if (!isRecord(payload.window)) errors.push("payload.window must be an object");
  if (!isRecord(payload.totals)) errors.push("payload.totals must be an object");
  if (!isRecord(payload.machine)) errors.push("payload.machine must be an object");
  if (!isRecord(payload.tool)) errors.push("payload.tool must be an object");
  if (!isRecord(payload.byDay)) {
    errors.push("payload.byDay must be an object");
    return null;
  }

  for (const [day, rawDay] of Object.entries(payload.byDay)) {
    if (!isRecord(rawDay)) {
      errors.push(`payload.byDay.${day} must be an object`);
      continue;
    }
    if (!isRecord(rawDay.byModel)) errors.push(`payload.byDay.${day}.byModel must be an object`);
    if (!isRecord(rawDay.byTool)) {
      errors.push(`payload.byDay.${day}.byTool must be an object`);
      continue;
    }
    for (const [tool, rawTool] of Object.entries(rawDay.byTool)) {
      if (!isRecord(rawTool)) {
        errors.push(`payload.byDay.${day}.byTool.${tool} must be an object`);
      } else if (!isRecord(rawTool.byModel)) {
        errors.push(`payload.byDay.${day}.byTool.${tool}.byModel must be an object`);
      }
    }
  }

  return errors.length === 0 ? payload as unknown as AggregateV2 : null;
}

export function validateSignedAggregateV2(
  value: unknown,
  options: { now?: number; limits?: Partial<AggregateValidationLimits> } = {},
): AggregateValidationResult {
  const errors: string[] = [];
  const limits = { ...DEFAULT_AGGREGATE_VALIDATION_LIMITS, ...options.limits };
  const now = options.now ?? Date.now();
  const bytes = serialisedBytes(value);
  if (bytes === null) return { ok: false, errors: ["envelope must be JSON-serialisable"] };
  if (bytes > limits.maxEnvelopeBytes) {
    return { ok: false, errors: [`envelope exceeds ${limits.maxEnvelopeBytes} bytes`] };
  }
  if (!isRecord(value)) return { ok: false, errors: ["envelope must be an object"] };

  const payload = validateObjectShape(value, errors);
  if (!payload) return { ok: false, errors };

  if (!verifySigned(value as unknown as Signed<AggregateV2>)) {
    return { ok: false, errors: ["envelope signature is invalid"] };
  }
  if (payload.machine.id !== value.machineId) errors.push("payload.machine.id must match envelope.machineId");

  const generatedAt = typeof payload.generatedAt === "string" ? validDate(payload.generatedAt) : null;
  if (generatedAt === null) errors.push("payload.generatedAt must be a valid timestamp");
  else if (generatedAt > now + limits.maxFutureSkewMs) errors.push("payload.generatedAt is too far in the future");

  const from = payload.window.from === "" ? null : validDate(payload.window.from);
  const to = payload.window.to === "" ? null : validDate(payload.window.to);
  if (payload.window.from !== "" && from === null) errors.push("payload.window.from must be a valid timestamp");
  if (payload.window.to !== "" && to === null) errors.push("payload.window.to must be a valid timestamp");
  if (from !== null && to !== null && from > to) errors.push("payload.window.from must not be after payload.window.to");
  if (to !== null && to > now + limits.maxFutureSkewMs) errors.push("payload.window.to is too far in the future");

  const days = Object.entries(payload.byDay);
  if (days.length > limits.maxDays) errors.push(`payload.byDay exceeds ${limits.maxDays} days`);
  const oldest = Date.parse(`${limits.oldestAcceptedDay}T00:00:00.000Z`);
  for (const [day, daily] of days) {
    const dayTime = Date.parse(`${day}T00:00:00.000Z`);
    if (Number.isFinite(dayTime) && dayTime < oldest) errors.push(`payload.byDay.${day} predates the accepted window`);
    if (Number.isFinite(dayTime) && dayTime > now + limits.maxFutureSkewMs) errors.push(`payload.byDay.${day} is in the future`);

    const models = Object.keys(daily.byModel);
    const tools = Object.entries(daily.byTool);
    if (models.length > limits.maxModelsPerDay) errors.push(`payload.byDay.${day}.byModel exceeds ${limits.maxModelsPerDay} keys`);
    if (tools.length > limits.maxToolsPerDay) errors.push(`payload.byDay.${day}.byTool exceeds ${limits.maxToolsPerDay} keys`);
    for (const model of models) {
      if (model.length === 0 || model.length > limits.maxNameLength) errors.push(`payload.byDay.${day} contains an invalid model name length`);
    }
    for (const [tool, toolValue] of tools) {
      if (tool.length === 0 || tool.length > limits.maxNameLength) errors.push(`payload.byDay.${day} contains an invalid tool name length`);
      const toolModels = Object.keys(toolValue.byModel);
      if (toolModels.length > limits.maxModelsPerTool) errors.push(`payload.byDay.${day}.byTool.${tool}.byModel exceeds ${limits.maxModelsPerTool} keys`);
      for (const model of toolModels) {
        if (model.length === 0 || model.length > limits.maxNameLength) errors.push(`payload.byDay.${day}.byTool.${tool} contains an invalid model name length`);
      }
    }
  }

  try {
    errors.push(...validateAggregateV2(payload));
  } catch {
    errors.push("payload failed structural validation");
  }

  if (Number.isFinite(payload.totals.tokens) && Number.isFinite(payload.totals.costUSD)) {
    const allowed = (payload.totals.tokens / 1_000_000) * limits.maxCostPerMillionTokens + 1;
    if (payload.totals.costUSD > allowed) errors.push("payload cost/token ratio exceeds the accepted maximum");
  }

  return { ok: errors.length === 0, errors };
}
