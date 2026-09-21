import { env } from "../env.ts";
import { getClients } from "./clients.ts";

/** Optional session write. No-op unless SAVE_SESSION=true — child audio stays out of GCS by default. */
export async function maybeSaveSessionObject(path: string, body: Buffer, contentType: string): Promise<string | null> {
  if (!env.saveSession) return null;
  const clients = getClients();
  if (!clients.storage || !env.gcsBucket) return null;
  try {
    const file = clients.storage.bucket(env.gcsBucket).file(path);
    await file.save(body, { contentType, resumable: false });
    return `gs://${env.gcsBucket}/${path}`;
  } catch (error) {
    console.warn("GCS session write skipped.", error);
    return null;
  }
}
