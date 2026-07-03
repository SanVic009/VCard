import fs from "fs/promises";
import path from "path";
import OpenAI from "openai";
import { CardData } from "../types";

const hfBaseUrl = process.env.HF_BASE_URL ?? "https://router.huggingface.co/v1";
const hfModel = process.env.HF_MODEL ?? "google/gemma-4-26B-A4B-it:novita";

const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 2000;

const EMPTY_CARD_DATA: CardData = {
  name: "",
  title: "",
  company: "",
  address: "",
  emailid: "",
  website: "",
  phone: ""
};

function buildPrompt(): string {
  return [
    "Extract business card information from this image.",
    "Return ONLY valid JSON with this exact shape and key order:",
    '{"name":"","title":"","company":"","address":"","emailid":"","website":"","phone":""}',
    "If a value is missing, return an empty string for that key.",
    "Do not include markdown, code fences, comments, or extra text."
  ].join("\n");
}

function inferMimeType(imagePath: string): string {
  const ext = path.extname(imagePath).toLowerCase();

  if (ext === ".jpg" || ext === ".jpeg") {
    return "image/jpeg";
  }
  if (ext === ".png") {
    return "image/png";
  }
  if (ext === ".gif") {
    return "image/gif";
  }
  if (ext === ".webp") {
    return "image/webp";
  }

  return "application/octet-stream";
}

export function extractJsonFromText(text: string): CardData {
  const normalized = text.replace(/```json|```/gi, "").trim();

  let start = -1;
  let depth = 0;
  let end = -1;

  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    if (char === "{") {
      if (start === -1) {
        start = i;
      }
      depth += 1;
    } else if (char === "}") {
      if (start !== -1) {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
  }

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No valid JSON object found in model output");
  }

  const candidate = normalized.slice(start, end + 1);
  const parsed = JSON.parse(candidate) as Partial<CardData>;

  return {
    name: String(parsed.name ?? ""),
    title: String(parsed.title ?? ""),
    company: String(parsed.company ?? ""),
    address: String(parsed.address ?? ""),
    emailid: String(parsed.emailid ?? ""),
    website: String(parsed.website ?? ""),
    phone: String(parsed.phone ?? "")
  };
}

function classifyError(error: unknown): { type: "transient" | "permanent"; message: string } {
  const message = error instanceof Error ? error.message : "Unknown OCR error";

  if (message.includes("ENOENT") || message.includes("No JSON object found")) {
    return { type: "permanent", message };
  }

  const status =
    typeof error === "object" && error !== null && "status" in error && typeof (error as { status?: unknown }).status === "number"
      ? ((error as { status: number }).status as number)
      : undefined;

  if (status === 502 || status === 503 || status === 504 || status === 429) {
    return { type: "transient", message };
  }

  if (status === 401) {
    return {
      type: "permanent",
      message: "Hugging Face authentication failed (401). Check HF_TOKEN validity and token scope."
    };
  }

  if (status === 403) {
    return {
      type: "permanent",
      message: "Hugging Face access denied (403). Verify token permissions and model access rights."
    };
  }

  if (status === 404) {
    return {
      type: "permanent",
      message: `Model not found or unavailable: ${hfModel}`
    };
  }

  if (status !== undefined && status >= 400 && status < 500) {
    return { type: "permanent", message };
  }

  if (status !== undefined && status >= 500) {
    return { type: "transient", message };
  }

  return { type: "transient", message };
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runOcrExtraction(imagePath: string): Promise<{ cardData: CardData; rawOutput: unknown }> {
  const hfToken = (process.env.HF_TOKEN ?? "").trim();
  const hfBackupToken = (process.env.HF_BACKUP_TOKEN ?? "").trim();

  if (!hfToken && !hfBackupToken) {
    throw new Error("[permanent] Missing HF_TOKEN and HF_BACKUP_TOKEN environment variables");
  }

  const absolutePath = path.resolve(imagePath);
  const imageBuffer = await fs.readFile(absolutePath);
  const imageBase64 = imageBuffer.toString("base64");
  const mimeType = inferMimeType(absolutePath);
  const imageDataUrl = `data:${mimeType};base64,${imageBase64}`;

  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    let activeToken = hfToken;
    const lastErrorStatus =
      typeof lastError === "object" && lastError !== null && "status" in lastError
        ? ((lastError as { status: number }).status as number)
        : undefined;

    if ((!activeToken || lastErrorStatus === 401 || lastErrorStatus === 403) && hfBackupToken) {
      activeToken = hfBackupToken;
    }

    if (!activeToken) {
      throw new Error("[permanent] Missing Hugging Face API token");
    }

    const client = new OpenAI({
      baseURL: hfBaseUrl,
      apiKey: activeToken
    });

    try {
      const completion = await client.chat.completions.create({
        model: hfModel,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: buildPrompt()
              },
              {
                type: "image_url",
                image_url: {
                  url: imageDataUrl
                }
              }
            ]
          }
        ]
      });

      const responseText = String(completion.choices?.[0]?.message?.content ?? "");
      const cardData = extractJsonFromText(responseText);
      return { cardData: { ...EMPTY_CARD_DATA, ...cardData }, rawOutput: completion };
    } catch (error) {
      lastError = error;
      const classified = classifyError(error);

      const isAuthError = classified.message.includes("401") || classified.message.includes("403");
      const isBackupTokenInUse = activeToken === hfBackupToken;
      const canFallback = isAuthError && !isBackupTokenInUse && !!hfBackupToken;

      if ((classified.type === "permanent" && !canFallback) || attempt === MAX_RETRIES) {
        break;
      }

      const backoffMs = BASE_BACKOFF_MS * 2 ** (attempt - 1);
      await delay(backoffMs);
    }
  }

  const classified = classifyError(lastError);
  throw new Error(`[${classified.type}] ${classified.message}`);
}
