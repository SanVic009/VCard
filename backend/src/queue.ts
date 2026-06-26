import { JobsOptions, Queue } from "bullmq";
import IORedis from "ioredis";

export interface OcrQueueJobData {
  jobId: string;
  userId: string;
  filePath: string;
}

export const OCR_QUEUE_NAME = "ocr-extraction";

const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 2000
  },
  removeOnComplete: true,
  removeOnFail: false
};

let queueConnection: IORedis | null = null;
let queueInstance: Queue<OcrQueueJobData> | null = null;

export function createRedisConnection(): IORedis {
  const redisUrl = (process.env.REDIS_URL ?? "").trim();

  if (redisUrl) {
    return new IORedis(redisUrl, { maxRetriesPerRequest: null });
  }

  const redisHost = process.env.REDIS_HOST ?? "127.0.0.1";
  const redisPort = Number(process.env.REDIS_PORT ?? 6379);
  const redisPassword = (process.env.REDIS_PASSWORD ?? "").trim();

  return new IORedis({
    host: redisHost,
    port: redisPort,
    password: redisPassword || undefined,
    maxRetriesPerRequest: null
  });
}

export function getOcrQueue(): Queue<OcrQueueJobData> {
  if (!queueConnection) {
    queueConnection = createRedisConnection();
  }

  if (!queueInstance) {
    queueInstance = new Queue<OcrQueueJobData>(OCR_QUEUE_NAME, {
      connection: queueConnection,
      defaultJobOptions
    });
  }

  return queueInstance;
}

export async function enqueueOcrJob(data: OcrQueueJobData): Promise<void> {
  const queue = getOcrQueue();
  await queue.add("extract-business-card", data);
}

export async function closeOcrQueue(): Promise<void> {
  if (queueInstance) {
    await queueInstance.close();
    queueInstance = null;
  }

  if (queueConnection) {
    await queueConnection.quit();
    queueConnection = null;
  }
}
