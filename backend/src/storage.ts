import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import stream from "stream";
import { promisify } from "util";
import { google } from "googleapis";

const pipeline = promisify(stream.pipeline);

const backendRoot = path.resolve(__dirname, "..");
const uploadsDir = path.join(backendRoot, "uploads");
const outputsDir = path.join(backendRoot, "outputs");

const storageBackend = (process.env.STORAGE_BACKEND ?? "local").toLowerCase();

function ensureLocalDirs(): void {
  void fsPromises.mkdir(uploadsDir, { recursive: true });
  void fsPromises.mkdir(outputsDir, { recursive: true });
}

// --------- Google Drive helpers ---------
function createDriveClient() {
  // Prefer service account file (recommended for server-side apps).
  const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
  if (keyFile) {
    const auth = new google.auth.GoogleAuth({
      keyFile,
      scopes: ["https://www.googleapis.com/auth/drive"]
    });
    return google.drive({ version: "v3", auth });
  }

  // Or accept service account JSON via env var
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (keyJson) {
    const creds = JSON.parse(keyJson);
    const auth = new google.auth.JWT({
      email: creds.client_email,
      key: creds.private_key,
      scopes: ["https://www.googleapis.com/auth/drive"]
    });
    return google.drive({ version: "v3", auth });
  }

  // Fallback to OAuth2 with refresh token (less convenient for server automation)
  const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN ?? "";

  if (clientId && clientSecret && refreshToken) {
    const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oAuth2Client.setCredentials({ refresh_token: refreshToken });
    return google.drive({ version: "v3", auth: oAuth2Client });
  }

  throw new Error(
    "Google Drive credentials are not configured. Set GOOGLE_SERVICE_ACCOUNT_FILE or GOOGLE_SERVICE_ACCOUNT_JSON, or GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN"
  );
}

async function uploadBufferToDrive(name: string, buffer: Buffer, parentFolderId?: string) {
  const drive = createDriveClient();
  const mimeType = "application/octet-stream";

  const res = await drive.files.create({
    requestBody: {
      name,
      parents: parentFolderId ? [parentFolderId] : undefined
    },
    media: {
      mimeType,
      body: stream.Readable.from(buffer)
    },
    fields: "id,name"
  });

  return res.data.id as string;
}

async function downloadDriveFileToPath(fileId: string, destPath: string) {
  const drive = createDriveClient();
  const res = await drive.files.get({ fileId, alt: "media" }, { responseType: "stream" });
  await pipeline(res.data as NodeJS.ReadableStream, fs.createWriteStream(destPath));
}

async function getDriveFileContent(fileId: string): Promise<string> {
  const tmp = path.join(backendRoot, `tmp-${fileId}.tmp`);
  await downloadDriveFileToPath(fileId, tmp);
  const content = await fsPromises.readFile(tmp, "utf-8");
  await fsPromises.unlink(tmp).catch(() => undefined);
  return content;
}

async function listDriveFilesInFolder(folderId: string) {
  const drive = createDriveClient();
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id,name)",
    pageSize: 1000
  });
  return res.data.files ?? [];
}

// --------- Public API ---------
export async function saveUploadFromBuffer(filename: string, buffer: Buffer): Promise<string> {
  if (storageBackend === "gdrive") {
    const parent = process.env.GDRIVE_FOLDER_ID_UPLOADS ?? process.env.GDRIVE_FOLDER_ID;
    const id = await uploadBufferToDrive(filename, buffer, parent);
    return id;
  }

  ensureLocalDirs();
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const outPath = path.join(uploadsDir, `${Date.now()}-${safe}`);
  await fsPromises.writeFile(outPath, buffer);
  return outPath;
}

export async function downloadFileToTemp(fileIdentifier: string): Promise<string> {
  if (storageBackend === "gdrive") {
    const tmpPath = path.join(backendRoot, `tmp-${fileIdentifier}`);
    await downloadDriveFileToPath(fileIdentifier, tmpPath);
    return tmpPath;
  }

  return fileIdentifier;
}

export async function saveOutputJson(jobId: string, content: string): Promise<string> {
  if (storageBackend === "gdrive") {
    const parent = process.env.GDRIVE_FOLDER_ID_OUTPUTS ?? process.env.GDRIVE_FOLDER_ID;
    const name = `${jobId}.json`;
    const id = await uploadBufferToDrive(name, Buffer.from(content, "utf-8"), parent);
    return id;
  }

  ensureLocalDirs();
  const outPath = path.join(outputsDir, `${jobId}.json`);
  await fsPromises.writeFile(outPath, content, "utf-8");
  return outPath;
}

export async function listOutputsForJobIds(jobIds: string[]): Promise<string[]> {
  if (storageBackend === "gdrive") {
    const parent = process.env.GDRIVE_FOLDER_ID_OUTPUTS ?? process.env.GDRIVE_FOLDER_ID;
    if (!parent) return [];
    const files = await listDriveFilesInFolder(parent);
    const names = files.map((f) => f.name ?? "");
    // Filter by jobIds present as filenames like <jobId>.json
    return names.filter((n) => {
      if (!n.endsWith(".json")) return false;
      const jid = n.replace(/\.json$/, "");
      return jobIds.includes(jid);
    });
  }

  ensureLocalDirs();
  const entries = await fsPromises.readdir(outputsDir, { withFileTypes: true });
  return entries.filter((e) => e.isFile() && e.name.endsWith(".json")).map((e) => e.name);
}

export async function readOutputContent(filename: string): Promise<string | null> {
  if (storageBackend === "gdrive") {
    const parent = process.env.GDRIVE_FOLDER_ID_OUTPUTS ?? process.env.GDRIVE_FOLDER_ID;
    if (!parent) return null;
    const files = await listDriveFilesInFolder(parent);
    const matched = files.find((f) => f.name === filename);
    if (!matched || !matched.id) return null;
    return await getDriveFileContent(matched.id);
  }

  ensureLocalDirs();
  const p = path.join(outputsDir, filename);
  try {
    return await fsPromises.readFile(p, "utf-8");
  } catch (_e) {
    return null;
  }
}

export async function streamUploadToResponse(fileIdentifier: string, res: any): Promise<void> {
  if (storageBackend === "gdrive") {
    // fileIdentifier is a Drive file id
    const drive = createDriveClient();
    const r = await drive.files.get({ fileId: fileIdentifier, alt: "media" }, { responseType: "stream" });
    (r.data as NodeJS.ReadableStream).pipe(res);
    return;
  }

  // local path
  res.sendFile(fileIdentifier);
}

export default {
  saveUploadFromBuffer,
  downloadFileToTemp,
  saveOutputJson,
  listOutputsForJobIds,
  readOutputContent,
  streamUploadToResponse
};
