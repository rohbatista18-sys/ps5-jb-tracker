// Talks to the Azure OpenAI v1 Responses API.
import "server-only";
import { env } from "./env";

export type AzureOpenAIErrorCode = "config" | "timeout" | "network" | "http" | "empty" | "incomplete";

export class AzureOpenAIError extends Error {
  readonly status: number | null;
  readonly code: AzureOpenAIErrorCode;
  constructor(message: string, status: number | null, code: AzureOpenAIErrorCode) {
    super(message);
    this.name = "AzureOpenAIError";
    this.status = status;
    this.code = code;
  }
}

export interface GenerateTextOptions {
  instructions: string;
  input: string;
  maxOutputTokens: number;
}

const TIMEOUT_MS = 25_000;

interface ResponsesPayload {
  status?: string;
  output_text?: string;
  output?: { type?: string; content?: { type?: string; text?: string }[] }[];
  incomplete_details?: { reason?: string } | null;
  error?: { message?: string; code?: string | null; param?: string | null } | null;
}

export function extractText(data: ResponsesPayload): string {
  if (typeof data.output_text === "string" && data.output_text.trim()) return data.output_text;
  return (data.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((c) => c.type === "output_text" && typeof c.text === "string")
    .map((c) => c.text)
    .join("");
}

// The current deployment (chat-tuned) rejects `reasoning.effort: "low"`, so it is off by default;
// the detection below still turns it off again if it is ever re-enabled for a model that refuses it.
let sendReasoning = false;

function isReasoningRejection(status: number, err: ResponsesPayload["error"]): boolean {
  if (status !== 400 || !err) return false;
  return /reasoning|effort/i.test(err.param ?? "") || /reasoning|effort|'low'/i.test(err.message ?? "");
}

export async function generateText({ instructions, input, maxOutputTokens }: GenerateTextOptions): Promise<string> {
  const endpoint = env.azureOpenAIEndpoint;
  const model = env.azureOpenAIDeployment;
  const key = env.azureOpenAIKey;
  if (!endpoint || !model || !key) throw new AzureOpenAIError("Azure OpenAI is not configured", null, "config");
  if (!endpoint.startsWith("https://")) throw new AzureOpenAIError("Azure OpenAI endpoint must use https", null, "config");

  const signal = AbortSignal.timeout(TIMEOUT_MS);
  const post = async (withReasoning: boolean) => {
    try {
      return await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", "api-key": key },
        body: JSON.stringify({
          model,
          instructions,
          input,
          max_output_tokens: maxOutputTokens,
          ...(withReasoning && { reasoning: { effort: "low" } }),
        }),
        signal,
        cache: "no-store",
        // The custom "api-key" header would be forwarded on a cross-origin redirect; never follow one.
        redirect: "error",
      });
    } catch (err) {
      const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
      throw new AzureOpenAIError(
        timedOut ? `Azure OpenAI timed out after ${TIMEOUT_MS}ms` : "Azure OpenAI network error",
        null,
        timedOut ? "timeout" : "network",
      );
    }
  };

  // Local copy: concurrent calls may flip the module flag while this one is in flight.
  const withReasoning = sendReasoning;
  let res = await post(withReasoning);
  let data = (await res.json().catch(() => ({}))) as ResponsesPayload;
  if (withReasoning && isReasoningRejection(res.status, data.error)) {
    sendReasoning = false;
    res = await post(false);
    data = (await res.json().catch(() => ({}))) as ResponsesPayload;
  }

  if (!res.ok) {
    // Log only Azure's error code, not its message: messages can echo prompt content.
    const code = typeof data.error?.code === "string" ? data.error.code.replace(/[^\w.-]/g, "").slice(0, 60) : "";
    throw new AzureOpenAIError(`Azure OpenAI HTTP ${res.status}${code ? ` (${code})` : ""}`, res.status, "http");
  }

  const text = extractText(data).trim();
  if (!text) {
    const reason = data.incomplete_details?.reason;
    throw new AzureOpenAIError(
      reason ? `Azure OpenAI response incomplete: ${reason}` : "Azure OpenAI returned no text",
      res.status,
      reason ? "incomplete" : "empty",
    );
  }
  return text;
}
