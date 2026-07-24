import { Storage, File } from "@google-cloud/storage";
import { Response } from "express";
import { randomUUID } from "crypto";
import {
  ObjectAclPolicy,
  ObjectPermission,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";

/**
 * Object storage client. Replit-specific sidecar credentials have been removed.
 *
 * Configuration is now driven entirely by standard Google Cloud Storage env
 * vars:
 *   - GOOGLE_APPLICATION_CREDENTIALS (path to service-account JSON), OR
 *   - GCP_SERVICE_ACCOUNT_KEY (raw JSON string), OR
 *   - GCS_PROJECT_ID + Application Default Credentials (gcloud auth, GCE
 *     workload identity, etc.)
 *
 * If none of these are set, the client is created in unauthenticated mode
 * and any GCS-backed method will fail loudly when called. The intent is to
 * let the rest of the server boot even when object storage isn't configured.
 */
const gcsProjectId = process.env.GCS_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || "";
let storageOptions: ConstructorParameters<typeof Storage>[0] = {
  projectId: gcsProjectId,
};

if (process.env.GCP_SERVICE_ACCOUNT_KEY) {
  try {
    storageOptions = {
      projectId: gcsProjectId,
      credentials: JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY),
    };
  } catch (err) {
    console.warn(
      "[objectStorage] GCP_SERVICE_ACCOUNT_KEY is set but is not valid JSON; falling back to ADC.",
    );
  }
}
// If GOOGLE_APPLICATION_CREDENTIALS is set, the Storage client picks it up
// automatically — no extra wiring needed here.

export const objectStorageClient = new Storage(storageOptions);

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

// The object storage service is used to interact with the object storage service.
export class ObjectStorageService {
  constructor() {}

  // Gets the public object search paths.
  getPublicObjectSearchPaths(): Array<string> {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
    const paths = Array.from(
      new Set(
        pathsStr
          .split(",")
          .map((path) => path.trim())
          .filter((path) => path.length > 0)
      )
    );
    if (paths.length === 0) {
      throw new Error(
        "PUBLIC_OBJECT_SEARCH_PATHS not set. Create a bucket in 'Object Storage' " +
          "tool and set PUBLIC_OBJECT_SEARCH_PATHS env var (comma-separated paths)."
      );
    }
    return paths;
  }

  // Gets the private object directory.
  getPrivateObjectDir(): string {
    const dir = process.env.PRIVATE_OBJECT_DIR || "";
    if (!dir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
          "tool and set PRIVATE_OBJECT_DIR env var."
      );
    }
    return dir;
  }

  // Search for a public object from the search paths.
  async searchPublicObject(filePath: string): Promise<File | null> {
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const fullPath = `${searchPath}/${filePath}`;

      // Full path format: /<bucket_name>/<object_name>
      const { bucketName, objectName } = parseObjectPath(fullPath);
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);

      // Check if file exists
      const [exists] = await file.exists();
      if (exists) {
        return file;
      }
    }

    return null;
  }

  // Downloads an object to the response.
  async downloadObject(file: File, res: Response, cacheTtlSec: number = 3600) {
    try {
      // Get file metadata
      const [metadata] = await file.getMetadata();
      // Get the ACL policy for the object.
      const aclPolicy = await getObjectAclPolicy(file);
      const isPublic = aclPolicy?.visibility === "public";
      // Set appropriate headers
      res.set({
        "Content-Type": metadata.contentType || "application/octet-stream",
        "Content-Length": metadata.size,
        "Cache-Control": `${
          isPublic ? "public" : "private"
        }, max-age=${cacheTtlSec}`,
      });

      // Stream the file to the response
      const stream = file.createReadStream();

      stream.on("error", (err) => {
        console.error("Stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Error streaming file" });
        }
      });

      stream.pipe(res);
    } catch (error) {
      console.error("Error downloading file:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }

  // Gets the upload URL for media files.
  async getMediaUploadURL(): Promise<string> {
    const privateObjectDir = this.getPrivateObjectDir();
    if (!privateObjectDir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
          "tool and set PRIVATE_OBJECT_DIR env var."
      );
    }

    const mediaId = randomUUID();
    const fullPath = `${privateObjectDir}/media/${mediaId}`;

    const { bucketName, objectName } = parseObjectPath(fullPath);

    // Sign URL for PUT method with TTL
    return signObjectURL({
      bucketName,
      objectName,
      method: "PUT",
      ttlSec: 900,
    });
  }

  // Gets the media file from the object path.
  async getMediaFile(objectPath: string): Promise<File> {
    if (!objectPath.startsWith("/media/")) {
      throw new ObjectNotFoundError();
    }

    const parts = objectPath.slice(1).split("/");
    if (parts.length < 2) {
      throw new ObjectNotFoundError();
    }

    const mediaId = parts.slice(1).join("/");
    let mediaDir = this.getPrivateObjectDir();
    if (!mediaDir.endsWith("/")) {
      mediaDir = `${mediaDir}/`;
    }
    const mediaPath = `${mediaDir}media/${mediaId}`;
    const { bucketName, objectName } = parseObjectPath(mediaPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const mediaFile = bucket.file(objectName);
    const [exists] = await mediaFile.exists();
    if (!exists) {
      throw new ObjectNotFoundError();
    }
    return mediaFile;
  }

  normalizeMediaPath(rawPath: string): string {
    if (!rawPath.startsWith("https://storage.googleapis.com/")) {
      return rawPath;
    }
  
    // Extract the path from the URL by removing query parameters and domain
    const url = new URL(rawPath);
    const rawObjectPath = url.pathname;
  
    let mediaDir = this.getPrivateObjectDir();
    if (!mediaDir.endsWith("/")) {
      mediaDir = `${mediaDir}/`;
    }
  
    if (!rawObjectPath.startsWith(mediaDir + "media/")) {
      return rawObjectPath;
    }
  
    // Extract the media ID from the path
    const mediaId = rawObjectPath.slice((mediaDir + "media/").length);
    return `/media/${mediaId}`;
  }
}

function parseObjectPath(path: string): {
  bucketName: string;
  objectName: string;
} {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }

  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join("/");

  return {
    bucketName,
    objectName,
  };
}

async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec,
}: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
}): Promise<string> {
  // Use the standard GCS V4 signed URL flow — works with any
  // service-account credentials (env-driven, see top of this file).
  // Replaces the previous Replit-sidecar HTTP call.
  const action: "read" | "write" | "delete" | "resumable" =
    method === "GET" || method === "HEAD"
      ? "read"
      : method === "PUT"
        ? "write"
        : "delete";

  const [signedURL] = await objectStorageClient
    .bucket(bucketName)
    .file(objectName)
    .getSignedUrl({
      version: "v4",
      action,
      expires: Date.now() + ttlSec * 1000,
    });
  return signedURL;
}