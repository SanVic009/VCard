import "dotenv/config";
import MongoStore from "connect-mongo";
import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import session from "express-session";
import { randomBytes, randomUUID } from "crypto";
import fs from "fs/promises";
import multer from "multer";
import path from "path";
import { getUserByUserId, loginUser, signupUser } from "./services/authService";
import {
  closeDatabase,
  createJob,
  getCompletedJobIdsForUser,
  getCardDataByJobId,
  getCardImageByJobId,
  getJobById,
  getJobsForUser,
  initializeDatabase,
  isUploadedFileOwnedByUser,
  isJobOwnedByUser,
  markStaleJobsFailed,
  pingDatabase,
  resetJobForRetry,
  saveCardData,
  setJobStatus
} from "./services/databaseService";
import { closeOcrQueue, enqueueOcrJob } from "./queue";
import storage from "./storage";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    userEmail?: string;
    csrfToken?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

const app = express();

const port = Number(process.env.PORT ?? 3001);
const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
const sessionSecret = process.env.SESSION_SECRET;
const isProduction = process.env.NODE_ENV === "production";
const trustProxy = process.env.TRUST_PROXY === "true";
const staleJobTimeoutMinutes = Number(process.env.JOB_STALE_TIMEOUT_MINUTES ?? 30);
const retentionDays = Number(process.env.FILE_RETENTION_DAYS ?? 30);
const mongoUri = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017";
const sessionTtlHours = Number(process.env.SESSION_TTL_HOURS ?? 24);

if (!sessionSecret || sessionSecret.length < 32 || sessionSecret.includes("change-this")) {
  throw new Error("SESSION_SECRET must be set to a strong value (min 32 chars, non-default)");
}

const backendRoot = path.resolve(__dirname, "..");
const uploadsDir = path.join(backendRoot, "uploads");
const outputsDir = path.join(backendRoot, "outputs");

const metrics = {
  totalRequests: 0,
  totalErrors: 0,
  uploadRequests: 0,
  retryRequests: 0
};

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

function getRequestCsrfToken(req: Request): string {
  if (!req.session.csrfToken) {
    req.session.csrfToken = randomBytes(24).toString("hex");
  }
  return req.session.csrfToken;
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}

const multerStorage = process.env.STORAGE_BACKEND === "gdrive" ? multer.memoryStorage() : multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const safe = sanitizeFilename(file.originalname);
    cb(null, `${Date.now()}-${safe}`);
  }
});

const uploadMulter = multer({
  storage: multerStorage,
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    const extOk = /\.(jpeg|jpg|png|gif|webp)$/i.test(file.originalname);
    const mimeOk = /image\/(jpeg|jpg|png|gif|webp)/i.test(file.mimetype);

    if (extOk && mimeOk) {
      cb(null, true);
      return;
    }

    cb(new Error("Only jpeg, jpg, png, gif, and webp files are allowed"));
  }
});

app.use(
  cors({
    origin: frontendUrl,
    credentials: true
  })
);
if (trustProxy) {
  app.set("trust proxy", 1);
}

app.use((req, res, next) => {
  req.requestId = randomUUID();
  metrics.totalRequests += 1;
  const start = Date.now();

  res.on("finish", () => {
    const durationMs = Date.now() - start;
    log("info", "request.completed", {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs
    });
  });

  next();
});

app.use(express.json());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many auth attempts. Please try again later." }
});

const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many upload attempts. Please try again later." }
});

const retryLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many retry attempts. Please try again later." }
});

app.use(
  session({
    secret: sessionSecret,
    store: MongoStore.create({
      mongoUrl: mongoUri,
      collectionName: "sessions",
      ttl: Math.max(1, sessionTtlHours) * 60 * 60,
      autoRemove: "interval",
      autoRemoveInterval: 10
    }),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: Math.max(1, sessionTtlHours) * 60 * 60 * 1000
    }
  })
);

app.use((req, res, next) => {
  if (!isProduction) {
    next();
    return;
  }

  const isStateChanging = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
  if (!isStateChanging) {
    next();
    return;
  }

  if (req.path === "/api/csrf-token") {
    next();
    return;
  }

  const sessionToken = getRequestCsrfToken(req);
  const headerToken = req.header("x-csrf-token");

  if (!headerToken || headerToken !== sessionToken) {
    res.status(403).json({ error: "Invalid CSRF token" });
    return;
  }

  next();
});

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeField(value: unknown, maxLen: number): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().slice(0, maxLen);
}

async function runMaintenanceTasks(): Promise<void> {
  const staleBefore = new Date(Date.now() - staleJobTimeoutMinutes * 60 * 1000);
  const staleUpdated = await markStaleJobsFailed(staleBefore);
  if (staleUpdated > 0) {
    log("warn", "jobs.stale_marked_failed", { staleUpdated });
  }

  const retentionCutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const [uploadEntries, outputEntries] = await Promise.all([
    fs.readdir(uploadsDir, { withFileTypes: true }),
    fs.readdir(outputsDir, { withFileTypes: true })
  ]);

  for (const entry of uploadEntries) {
    if (!entry.isFile()) {
      continue;
    }

    const filePath = path.join(uploadsDir, entry.name);
    const stats = await fs.stat(filePath);
    if (stats.mtimeMs < retentionCutoff) {
      await fs.unlink(filePath).catch(() => undefined);
    }
  }

  for (const entry of outputEntries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }

    const filePath = path.join(outputsDir, entry.name);
    const stats = await fs.stat(filePath);
    if (stats.mtimeMs < retentionCutoff) {
      await fs.unlink(filePath).catch(() => undefined);
    }
  }
}

app.get("/health", async (_req, res) => {
  try {
    await pingDatabase();
    const checks = {
      database: "ok",
      hfTokenConfigured: Boolean((process.env.HF_TOKEN ?? "").trim())
    };
    res.json({ status: "ok", checks });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Health check failed";
    res.status(503).json({ status: "degraded", error: message });
  }
});

app.get("/metrics", (_req, res) => {
  res.json(metrics);
});

app.get("/api/csrf-token", (req, res) => {
  const csrfToken = getRequestCsrfToken(req);
  res.json({ csrfToken });
});

app.post("/api/auth/signup", authLimiter, async (req, res) => {
  try {
    const { email, username, password } = req.body as {
      email?: string;
      username?: string;
      password?: string;
    };

    if (!email || !username || !password) {
      res.status(400).json({ error: "email, username, and password are required" });
      return;
    }

    const cleanEmail = normalizeField(email, 255).toLowerCase();
    const cleanUsername = normalizeField(username, 80);
    const cleanPassword = normalizeField(password, 256);

    if (!isValidEmail(cleanEmail)) {
      res.status(400).json({ error: "Invalid email format" });
      return;
    }

    if (cleanUsername.length < 2 || cleanPassword.length < 8) {
      res.status(400).json({ error: "Username or password does not meet minimum requirements" });
      return;
    }

    const user = await signupUser(cleanEmail, cleanUsername, cleanPassword);
    req.session.userId = user.user_id;
    req.session.userEmail = user.email;

    res.status(201).json({
      user: {
        user_id: user.user_id,
        email: user.email,
        username: user.username,
        created_at: user.created_at
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Signup failed";
    const status = message === "Email already registered" ? 409 : 500;
    res.status(status).json({ error: message });
  }
});

app.post("/api/auth/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      res.status(400).json({ error: "email and password are required" });
      return;
    }

    const cleanEmail = normalizeField(email, 255).toLowerCase();
    const cleanPassword = normalizeField(password, 256);

    if (!isValidEmail(cleanEmail)) {
      res.status(400).json({ error: "Invalid email format" });
      return;
    }

    const user = await loginUser(cleanEmail, cleanPassword);
    req.session.userId = user.user_id;
    req.session.userEmail = user.email;

    res.json({
      user: {
        user_id: user.user_id,
        email: user.email,
        username: user.username,
        created_at: user.created_at
      }
    });
  } catch (_error) {
    res.status(401).json({ error: "Invalid credentials" });
  }
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: "Failed to logout" });
      return;
    }
    res.clearCookie("connect.sid");
    res.status(204).send();
  });
});

app.get("/api/auth/me", requireAuth, async (req, res) => {
  const userId = req.session.userId as string;
  const user = await getUserByUserId(userId);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({
    user: {
      user_id: user.user_id,
      email: user.email,
      username: user.username,
      created_at: user.created_at
    }
  });
});

app.post("/api/upload", requireAuth, uploadLimiter, uploadMulter.single("card"), async (req, res) => {
  const userId = req.session.userId as string;
  metrics.uploadRequests += 1;

  if (!req.file) {
    res.status(400).json({ error: "card file is required" });
    return;
  }

  const jobId = randomUUID();
  let filePathOrId: string;

  try {
    if (process.env.STORAGE_BACKEND === "gdrive" && (req.file as any).buffer) {
      const original = (req.file as any).originalname as string;
      filePathOrId = await storage.saveUploadFromBuffer(original, (req.file as any).buffer as Buffer);
    } else {
      filePathOrId = (req.file as any).path as string;
    }

    await createJob({
      job_id: jobId,
      user_id: userId,
      filename: (req.file as any).originalname as string,
      file_path: filePathOrId
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to save uploaded file" });
    return;
  }

  try {
    await enqueueOcrJob({ jobId, userId, filePath: filePathOrId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to enqueue OCR job";
    await setJobStatus(jobId, "failed", `[permanent] ${message}`);
    res.status(503).json({ error: "Unable to queue OCR job. Please try again." });
    return;
  }

  res.status(202).json({
    jobId,
    redirectUrl: `/result/${jobId}`,
    status: "queued"
  });
});

app.get("/api/jobs", requireAuth, async (req, res) => {
  const userId = req.session.userId as string;
  const jobs = await getJobsForUser(userId);
  res.json({ jobs });
});

app.get("/api/job/:jobId", requireAuth, async (req, res) => {
  const userId = req.session.userId as string;
  const { jobId } = req.params;

  const owned = await isJobOwnedByUser(jobId, userId);
  if (!owned) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const [job, cardData, cardImage] = await Promise.all([
    getJobById(jobId),
    getCardDataByJobId(jobId),
    getCardImageByJobId(jobId)
  ]);

  res.json({
    job,
    cardData,
    cardImage
  });
});

app.post("/api/save/:jobId", requireAuth, async (req, res) => {
  const userId = req.session.userId as string;
  const { jobId } = req.params;

  const owned = await isJobOwnedByUser(jobId, userId);
  if (!owned) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const job = await getJobById(jobId);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  if (job.status !== "completed") {
    res.status(409).json({ error: "Only completed jobs can be saved" });
    return;
  }

  const existingCardData = await getCardDataByJobId(jobId);
  const payload = (req.body ?? {}) as Partial<{
    name: string;
    title: string;
    company: string;
    address: string;
    emailid: string;
    website: string;
    phone: string;
  }>;

  const cardData = {
    name: normalizeField(payload.name ?? existingCardData?.name ?? "", 120),
    title: normalizeField(payload.title ?? existingCardData?.title ?? "", 120),
    company: normalizeField(payload.company ?? existingCardData?.company ?? "", 120),
    address: normalizeField(payload.address ?? existingCardData?.address ?? "", 400),
    emailid: normalizeField(payload.emailid ?? existingCardData?.emailid ?? "", 255),
    website: normalizeField(payload.website ?? existingCardData?.website ?? "", 255),
    phone: normalizeField(payload.phone ?? existingCardData?.phone ?? "", 60)
  };

  if (cardData.emailid && !isValidEmail(cardData.emailid)) {
    res.status(400).json({ error: "Invalid email format in card data" });
    return;
  }

  await saveCardData(jobId, userId, cardData);

  res.status(200).json({ message: "Job data saved", jobId, cardData });
});

app.post("/api/job/:jobId/retry", requireAuth, retryLimiter, async (req, res) => {
  const userId = req.session.userId as string;
  metrics.retryRequests += 1;
  const { jobId } = req.params;

  const owned = await isJobOwnedByUser(jobId, userId);
  if (!owned) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const job = await getJobById(jobId);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  if (job.status !== "failed") {
    res.status(409).json({ error: "Only failed jobs can be retried" });
    return;
  }

  await resetJobForRetry(jobId);

  try {
    await enqueueOcrJob({
      jobId,
      userId,
      filePath: job.file_path
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to enqueue OCR retry";
    await setJobStatus(jobId, "failed", `[permanent] ${message}`);
    res.status(503).json({ error: "Unable to queue OCR retry. Please try again." });
    return;
  }

  res.status(202).json({
    jobId,
    status: "queued"
  });
});

app.get("/uploads/:filename", requireAuth, async (req, res) => {
  const userId = req.session.userId as string;
  const filename = req.params.filename;

  if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
    res.status(400).json({ error: "Invalid filename" });
    return;
  }

  const owned = await isUploadedFileOwnedByUser(filename, userId);
  if (!owned) {
    res.status(404).json({ error: "Image not found" });
    return;
  }

  // find job record for filename to get stored file path or id
  const jobs = await getJobsForUser(userId);
  const job = jobs.find((j) => j.filename === filename);
  if (!job) {
    res.status(404).json({ error: "Image not found" });
    return;
  }

  const filePathOrId = job.file_path;
  if (process.env.STORAGE_BACKEND === "gdrive") {
    await storage.streamUploadToResponse(filePathOrId, res);
    return;
  }

  res.sendFile(filePathOrId);
});

app.get("/api/outputs", requireAuth, async (req, res) => {
  const userId = req.session.userId as string;
  try {
    const allowedJobIds = await getCompletedJobIdsForUser(userId);
    const files = await storage.listOutputsForJobIds(allowedJobIds);
    res.json({ files: files.sort((a, b) => a.localeCompare(b)) });
  } catch (_error) {
    res.json({ files: [] });
  }
});

app.get("/api/outputs/:filename", requireAuth, async (req, res) => {
  const userId = req.session.userId as string;
  const filename = req.params.filename;

  if (!/^[a-zA-Z0-9._-]+\.json$/.test(filename)) {
    res.status(400).json({ error: "Invalid filename" });
    return;
  }

  const jobId = filename.replace(/\.json$/, "");
  const owned = await isJobOwnedByUser(jobId, userId);
  if (!owned) {
    res.status(404).json({ error: "Output not found" });
    return;
  }

  try {
    const content = await storage.readOutputContent(filename);
    if (!content) {
      res.status(404).json({ error: "Output not found" });
      return;
    }
    res.type("application/json").send(content);
  } catch (_error) {
    res.status(404).json({ error: "Output not found" });
  }
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  metrics.totalErrors += 1;
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({ error: "File too large. Max size is 10MB" });
      return;
    }
    res.status(400).json({ error: err.message });
    return;
  }

  const message = err instanceof Error ? err.message : "Internal server error";
  log("error", "request.error", {
    message,
    requestId: _req.requestId
  });
  res.status(500).json({ error: message });
});

async function bootstrap(): Promise<void> {
  await fs.mkdir(uploadsDir, { recursive: true });
  await fs.mkdir(outputsDir, { recursive: true });
  await initializeDatabase();
  await runMaintenanceTasks();
  setInterval(() => {
    void runMaintenanceTasks().catch((error) => {
      const message = error instanceof Error ? error.message : "Unknown maintenance error";
      log("error", "maintenance.failed", { message });
    });
  }, 10 * 60 * 1000);

  app.listen(port, () => {
    log("info", "server.started", { port });
  });
}

bootstrap().catch(async (error) => {
  console.error("Failed to start backend", error);
  await closeOcrQueue();
  await closeDatabase();
  process.exit(1);
});

process.on("SIGINT", async () => {
  await closeOcrQueue();
  await closeDatabase();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await closeOcrQueue();
  await closeDatabase();
  process.exit(0);
});
