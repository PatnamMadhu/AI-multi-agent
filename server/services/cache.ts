import { WorkflowResponse, TaskRequest } from "@shared/schema";
import { createHash } from "crypto";

interface CacheEntry<T> {
  value: T;
  timestamp: number; // When the entry was added
  lastAccessed: number; // When the entry was last accessed
}

interface CacheConfig {
  maxSize?: number; // Maximum number of entries (default: 100)
  ttlMs?: number; // Time to live in milliseconds (default: 1 hour)
}

/**
 * In-memory LRU (Least Recently Used) cache with TTL support
 */
export class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>>;
  private readonly maxSize: number;
  private readonly ttlMs: number;

  constructor(config: CacheConfig = {}) {
    this.cache = new Map();
    this.maxSize = config.maxSize || 100;
    this.ttlMs = config.ttlMs || 60 * 60 * 1000; // Default: 1 hour
  }

  /**
   * Get a value from the cache
   * Returns null if not found or expired
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if entry has expired
    const now = Date.now();
    if (now - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      console.log(`[Cache] Expired entry removed: ${key}`);
      return null;
    }

    // Update last accessed time (for LRU tracking)
    entry.lastAccessed = now;
    this.cache.set(key, entry);

    console.log(`[Cache] HIT: ${key}`);
    return entry.value;
  }

  /**
   * Set a value in the cache
   * Evicts least recently used entry if cache is full
   */
  set(key: string, value: T): void {
    const now = Date.now();

    // Clean up expired entries before checking size
    // This prevents the cache from being full of stale entries
    this.cleanupExpired();

    // If cache is still full after cleanup, evict least recently used entry
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    // Add or update entry
    this.cache.set(key, {
      value,
      timestamp: now,
      lastAccessed: now,
    });

    console.log(`[Cache] SET: ${key} (size: ${this.cache.size}/${this.maxSize})`);
  }

  /**
   * Check if a key exists in the cache (without updating access time)
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }

    // Check if expired
    const now = Date.now();
    if (now - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete a specific key from the cache
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      console.log(`[Cache] DELETED: ${key}`);
    }
    return deleted;
  }

  /**
   * Clear all entries from the cache
   */
  clear(): void {
    this.cache.clear();
    console.log(`[Cache] CLEARED all entries`);
  }

  /**
   * Get cache statistics
   */
  getStats() {
    // Remove expired entries first
    this.cleanupExpired();

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttlMs: this.ttlMs,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Evict the least recently used entry
   */
  private evictLRU(): void {
    let lruKey: string | null = null;
    let lruTime = Infinity;

    // Find entry with oldest lastAccessed time
    for (const [key, entry] of Array.from(this.cache.entries())) {
      if (entry.lastAccessed < lruTime) {
        lruTime = entry.lastAccessed;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
      console.log(`[Cache] EVICTED (LRU): ${lruKey}`);
    }
  }

  /**
   * Remove all expired entries
   */
  private cleanupExpired(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of Array.from(this.cache.entries())) {
      if (now - entry.timestamp > this.ttlMs) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.cache.delete(key);
    }

    if (expiredKeys.length > 0) {
      console.log(`[Cache] Cleaned up ${expiredKeys.length} expired entries`);
    }
  }
}

/**
 * Global workflow cache instance
 * Cache workflow responses keyed by normalized question + target URL
 */
export const workflowCache = new LRUCache<WorkflowResponse>({
  maxSize: 50, // Cache up to 50 workflow results
  ttlMs: 30 * 60 * 1000, // 30 minutes TTL
});

/**
 * Generate a normalized cache key from request parameters
 * Includes question, targetUrl, authPreference, and cookies to ensure proper cache isolation
 */
export function generateCacheKey(request: TaskRequest): string {
  const normalizedQuestion = request.question.trim().toLowerCase();
  const normalizedUrl = request.targetUrl?.trim().toLowerCase() || "";
  const normalizedAuth = request.authPreference?.trim().toLowerCase() || "auto-detect";
  
  // Hash cookies to create a stable fingerprint for unique session state
  let cookieHash = "no-cookies";
  if (request.cookies && request.cookies.length > 0) {
    // Include all cookie properties including values to ensure unique sessions don't share cache
    const cookieData = JSON.stringify(
      request.cookies.map(c => ({
        name: c.name,
        value: c.value, // Include value to differentiate sessions
        domain: c.domain,
        path: c.path,
      })).sort((a, b) => a.name.localeCompare(b.name))
    );
    // Use SHA-256 hash to create a stable, privacy-preserving fingerprint
    cookieHash = createHash("sha256").update(cookieData).digest("hex").substring(0, 16);
  }
  
  return `${normalizedQuestion}|${normalizedUrl}|${normalizedAuth}|${cookieHash}`;
}
