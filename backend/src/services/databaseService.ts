import { Collection, Db, MongoClient } from "mongodb";
import { CardData, CardDataRecord, CardImageRecord, Job, JobStatus, User } from "../types";

const mongoUri = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017";
const dbName = process.env.MONGODB_DB_NAME ?? "vcard";

let client: MongoClient | null = null;
let db: Db | null = null;

function getDb(): Db {
  if (!db) {
    throw new Error("Database is not initialized");
  }
  return db;
}

function usersCollection(): Collection<User> {
  return getDb().collection<User>("users");
}

function jobsCollection(): Collection<Job> {
  return getDb().collection<Job>("jobs");
}

function cardDataCollection(): Collection<CardDataRecord> {
  return getDb().collection<CardDataRecord>("card_data");
}

function cardImagesCollection(): Collection<CardImageRecord> {
  return getDb().collection<CardImageRecord>("card_images");
}

export async function initializeDatabase(): Promise<void> {
  if (db) {
    return;
  }

  client = new MongoClient(mongoUri);
  await client.connect();
  db = client.db(dbName);

  await Promise.all([
    usersCollection().createIndex({ email: 1 }, { unique: true }),
    jobsCollection().createIndex({ job_id: 1 }, { unique: true }),
    jobsCollection().createIndex({ user_id: 1, created_at: -1 }),
    cardDataCollection().createIndex({ job_id: 1 }, { unique: true }),
    cardImagesCollection().createIndex({ job_id: 1 }, { unique: true })
  ]);
}

export async function closeDatabase(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

export async function pingDatabase(): Promise<void> {
  await getDb().command({ ping: 1 });
}

export async function insertUser(user: User): Promise<void> {
  await usersCollection().insertOne(user);
}

export async function getUserByEmail(email: string): Promise<User | null> {
  return usersCollection().findOne({ email });
}

export async function getUserById(userId: string): Promise<User | null> {
  return usersCollection().findOne({ user_id: userId });
}

export async function createJob(input: {
  job_id: string;
  user_id: string;
  filename: string;
  file_path: string;
}): Promise<Job> {
  const now = new Date();
  const job: Job = {
    ...input,
    status: "queued",
    error_message: null,
    retry_count: 0,
    created_at: now,
    updated_at: now
  };

  await jobsCollection().insertOne(job);
  return job;
}

export async function setJobStatus(jobId: string, status: JobStatus, errorMessage?: string | null): Promise<void> {
  const update: Partial<Job> = {
    status,
    updated_at: new Date()
  };

  if (errorMessage !== undefined) {
    update.error_message = errorMessage;
  }

  await jobsCollection().updateOne({ job_id: jobId }, { $set: update });
}

export async function incrementRetryCount(jobId: string): Promise<void> {
  await jobsCollection().updateOne(
    { job_id: jobId },
    {
      $inc: { retry_count: 1 },
      $set: { updated_at: new Date() }
    }
  );
}

export async function resetJobForRetry(jobId: string): Promise<void> {
  await jobsCollection().updateOne(
    { job_id: jobId },
    {
      $set: {
        status: "queued",
        retry_count: 0,
        error_message: null,
        updated_at: new Date()
      }
    }
  );
}

export async function getJobById(jobId: string): Promise<Job | null> {
  return jobsCollection().findOne({ job_id: jobId });
}

export async function isJobOwnedByUser(jobId: string, userId: string): Promise<boolean> {
  const job = await jobsCollection().findOne({ job_id: jobId, user_id: userId });
  return Boolean(job);
}

export async function getJobsForUser(userId: string): Promise<Job[]> {
  return jobsCollection().find({ user_id: userId }).sort({ created_at: -1 }).toArray();
}

export async function saveCardData(jobId: string, userId: string, cardData: CardData): Promise<void> {
  const now = new Date();

  await cardDataCollection().updateOne(
    { job_id: jobId },
    {
      $set: {
        ...cardData,
        job_id: jobId,
        user_id: userId,
        updated_at: now
      },
      $setOnInsert: {
        created_at: now
      }
    },
    { upsert: true }
  );
}

export async function saveCardImage(jobId: string, userId: string, imagePath: string): Promise<void> {
  const now = new Date();

  // Keep both keys for compatibility with historical reads.
  await cardImagesCollection().updateOne(
    { job_id: jobId },
    {
      $set: {
        job_id: jobId,
        user_id: userId,
        image_path: imagePath,
        image_address: imagePath,
        updated_at: now
      },
      $setOnInsert: {
        created_at: now
      }
    },
    { upsert: true }
  );
}

export async function getCardDataByJobId(jobId: string): Promise<CardDataRecord | null> {
  return cardDataCollection().findOne({ job_id: jobId });
}

export async function getCardImageByJobId(jobId: string): Promise<CardImageRecord | null> {
  return cardImagesCollection().findOne({ job_id: jobId });
}

export async function isUploadedFileOwnedByUser(filename: string, userId: string): Promise<boolean> {
  const job = await jobsCollection().findOne({ filename, user_id: userId });
  return Boolean(job);
}

export async function getCompletedJobIdsForUser(userId: string): Promise<string[]> {
  const jobs = await jobsCollection()
    .find({ user_id: userId, status: "completed" }, { projection: { job_id: 1 } })
    .toArray();
  return jobs.map((job) => job.job_id);
}

export async function markStaleJobsFailed(staleBefore: Date): Promise<number> {
  const result = await jobsCollection().updateMany(
    {
      status: { $in: ["queued", "processing"] },
      updated_at: { $lt: staleBefore }
    },
    {
      $set: {
        status: "failed",
        error_message: "[transient] Job timed out and was auto-marked as failed",
        updated_at: new Date()
      }
    }
  );

  return result.modifiedCount;
}
