import { WorkflowResponse, TaskRequest } from "@shared/schema";
import { createHash } from "crypto";

/* ────────────────────────────────────────────────────────────────
   TYPES & INTERFACES
   ──────────────────────────────────────────────────────────────── */
interface CacheEntry<T> {
  value: T;
  timestamp: number;
  lastAccessed: number;
}

interface CacheConfig {
  maxSize?: number;
  ttlMs?: number;
}

/* ────────────────────────────────────────────────────────────────
   LRU CACHE IMPLEMENTATION
   ──────────────────────────────────────────────────────────────── */
export class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>>;
  private readonly maxSize: number;
  private readonly ttlMs: number;

  constructor(config: CacheConfig = {}) {
    this.cache = new Map();
    this.maxSize = config.maxSize || 100;
    this.ttlMs = config.ttlMs || 60 * 60 * 1000; // Default 1 hour
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      console.log(`[Cache] Expired: ${key}`);
      return null;
    }

    entry.lastAccessed = now;
    this.cache.set(key, entry);

    console.log(`[Cache] HIT: ${key}`);
    return entry.value;
  }

  set(key: string, value: T): void {
    const now = Date.now();

    this.cleanupExpired();

    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, {
      value,
      timestamp: now,
      lastAccessed: now,
    });

    console.log(
      `[Cache] SET: ${key} (size: ${this.cache.size}/${this.maxSize})`,
    );
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    const now = Date.now();
    if (now - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) console.log(`[Cache] DELETED: ${key}`);
    return deleted;
  }

  clear(): void {
    this.cache.clear();
    console.log(`[Cache] CLEARED all`);
  }

  getStats() {
    this.cleanupExpired();
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttlMs: this.ttlMs,
      keys: Array.from(this.cache.keys()),
    };
  }

  private evictLRU(): void {
    let lruKey: string | null = null;
    let lruTime = Infinity;

    for (const [key, entry] of Array.from(this.cache.entries())) {
      if (entry.lastAccessed < lruTime) {
        lruTime = entry.lastAccessed;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
      console.log(`[Cache] EVICTED LRU: ${lruKey}`);
    }
  }

  private cleanupExpired(): void {
    const now = Date.now();
    const expiredKeys = [];

    for (const [key, entry] of Array.from(this.cache.entries())) {
      if (now - entry.timestamp > this.ttlMs) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach((key) => this.cache.delete(key));

    if (expiredKeys.length > 0) {
      console.log(`[Cache] Removed ${expiredKeys.length} expired entries`);
    }
  }
}

/* ────────────────────────────────────────────────────────────────
   GLOBAL WORKFLOW CACHE INSTANCE
   ──────────────────────────────────────────────────────────────── */
export const workflowCache = new LRUCache<WorkflowResponse>({
  maxSize: 50,
  ttlMs: 30 * 60 * 1000, // 30 minutes
});

/* ────────────────────────────────────────────────────────────────
   KEY GENERATION USING QUESTION + URL + AUTH + COOKIE HASH + CREDENTIALS HASH
   ──────────────────────────────────────────────────────────────── */
export function generateCacheKey(request: TaskRequest): string {
  const normalizedQuestion = request.question.trim().toLowerCase();
  const normalizedUrl = request.targetUrl?.trim().toLowerCase() || "";
  const normalizedAuth =
    request.authPreference?.trim().toLowerCase() || "auto-detect";

  let cookieHash = "no-cookies";

  if (request.cookies?.length) {
    const cookieData = JSON.stringify(
      request.cookies
        .map((c) => ({
          name: c.name,
          value: c.value,
          domain: c.domain,
          path: c.path,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    );

    cookieHash = createHash("sha256")
      .update(cookieData)
      .digest("hex")
      .substring(0, 16);
  }

  let credentialsHash = "no-credentials";

  if (request.credentials && (request.credentials.username || request.credentials.password || request.credentials.displayName)) {
    const credentialData = JSON.stringify({
      username: request.credentials.username || "",
      password: request.credentials.password || "", // Include password in hash for cache isolation
      displayName: request.credentials.displayName || "",
    });

    credentialsHash = createHash("sha256")
      .update(credentialData)
      .digest("hex")
      .substring(0, 16);
  }

  return `${normalizedQuestion}|${normalizedUrl}|${normalizedAuth}|${cookieHash}|${credentialsHash}`;
}

/* ────────────────────────────────────────────────────────────────
   DEFAULT EXPORT — CLEANER IMPORT
   ──────────────────────────────────────────────────────────────── */
export default {
  workflowCache,
  generateCacheKey,
  LRUCache,
};
