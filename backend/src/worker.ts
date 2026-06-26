import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import { Job, Worker } from "bullmq";
import {
  closeDatabase,
  incrementRetryCount,
  initializeDatabase,
  saveCardData,
  saveCardImage,
  setJobStatus
} from "./services/databaseService";
import { runOcrExtraction } from "./services/ocrService";
import { createRedisConnection, OCR_QUEUE_NAME, OcrQueueJobData } from "./queue";
import storage from "./storage";

const backendRoot = path.resolve(__dirname, "..");
const outputsDir = path.join(backendRoot, "outputs");

function log(level: "info" | "warn" | "error", message: string, meta: Record<string, unknown> = {}): void {
  const payload = {
    ts: new Date().toISOString(),
    level,
    message,
    ...meta
  };

  if (level === "error") {
    console.error(JSON.stringify(payload));
    return;
  }

  console.log(JSON.stringify(payload));
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown OCR error";
}

async function processOcrJob(job: Job<OcrQueueJobData>): Promise<void> {
  const { jobId, userId, filePath } = job.data;

  let localFilePath = filePath;
  let usedTemp = false;
  if (process.env.STORAGE_BACKEND === "gdrive") {
    // download Drive file to a temp path for processing
    localFilePath = await storage.downloadFileToTemp(filePath);
    usedTemp = true;
  }

  try {
    await setJobStatus(jobId, "processing", null);
    await incrementRetryCount(jobId);

    const { cardData, rawOutput } = await runOcrExtraction(localFilePath);

    await Promise.all([
      saveCardData(jobId, userId, cardData),
      saveCardImage(jobId, userId, filePath),
      setJobStatus(jobId, "completed", null)
    ]);

    const outputContent = {
      jobId,
      userId,
      createdAt: new Date().toISOString(),
      cardData,
      rawOutput
    };

    await storage.saveOutputJson(jobId, JSON.stringify(outputContent, null, 2));

    if (usedTemp) {
      await fs.unlink(localFilePath).catch(() => undefined);
    }
  } catch (error) {
    const attempts = job.opts.attempts ?? 1;
    const willRetry = job.attemptsMade + 1 < attempts;
    const message = toErrorMessage(error);

    if (willRetry) {
      await setJobStatus(jobId, "queued", null);
      log("warn", "worker.job_retry_scheduled", {
        bullJobId: job.id,
        jobId,
        attemptsMade: job.attemptsMade + 1,
        attempts,
        message
      });
    } else {
      await setJobStatus(jobId, "failed", message);
      log("error", "worker.job_failed", {
        bullJobId: job.id,
        jobId,
        attemptsMade: job.attemptsMade + 1,
        attempts,
        message
      });
    }

    throw error;
  }
}

async function bootstrapWorker(): Promise<void> {
  await fs.mkdir(outputsDir, { recursive: true });
  await initializeDatabase();

  const workerConnection = createRedisConnection();
  const worker = new Worker<OcrQueueJobData>(OCR_QUEUE_NAME, processOcrJob, {
    connection: workerConnection,
    concurrency: 3
  });

  worker.on("completed", (job) => {
    log("info", "worker.job_completed", {
      bullJobId: job.id,
      jobId: job.data.jobId,
      attemptsMade: job.attemptsMade
    });
  });

  worker.on("active", (job) => {
    log("info", "worker.job_active", {
      bullJobId: job.id,
      jobId: job.data.jobId,
      attemptsMade: job.attemptsMade
    });
  });

  worker.on("failed", (job, error) => {
    log("warn", "worker.job_attempt_failed", {
      bullJobId: job?.id,
      jobId: job?.data.jobId,
      attemptsMade: job?.attemptsMade,
      message: toErrorMessage(error)
    });
  });

  log("info", "worker.started", {
    queue: OCR_QUEUE_NAME,
    concurrency: 3
  });

  const shutdown = async (signal: string) => {
    log("warn", "worker.shutdown", { signal });
    await worker.close();
    await workerConnection.quit();
    await closeDatabase();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

bootstrapWorker().catch(async (error) => {
  log("error", "worker.bootstrap_failed", { message: toErrorMessage(error) });
  await closeDatabase();
  process.exit(1);
});
