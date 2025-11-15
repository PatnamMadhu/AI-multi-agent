import { bmvbhash } from "blockhash-core";
import { PNG } from "pngjs";

export interface PerceptualHash {
  hash: string;
  bits: number;
}

export interface DuplicateInfo {
  stepNumber: number;
  originalStepNumber: number;
  similarity: number;
  reason: string;
}

export interface VisualDiffOptions {
  similarityThreshold?: number; // 0.0 to 1.0
  hashBits?: number; // Size of perceptual hash (8, 16, or 32)
  enabled?: boolean;
}

export class VisualDiffDetector {
  private screenshotHashes: Map<number, PerceptualHash> = new Map();
  private duplicates: DuplicateInfo[] = [];
  private readonly HASH_BITS: number;
  private readonly SIMILARITY_THRESHOLD: number;
  private readonly enabled: boolean;

  constructor(options: VisualDiffOptions = {}) {
    this.HASH_BITS = options.hashBits || 16;
    this.SIMILARITY_THRESHOLD = options.similarityThreshold || 0.92;
    this.enabled = options.enabled !== false; // Enabled by default
  }

  async computeHash(imageBuffer: Buffer): Promise<PerceptualHash> {
    return new Promise((resolve, reject) => {
      try {
        const png = PNG.sync.read(imageBuffer);
        const { width, height, data } = png;

        const imgData = {
          width,
          height,
          data: new Uint8Array(data),
        };

        const hash = bmvbhash(imgData, this.HASH_BITS);

        resolve({
          hash,
          bits: this.HASH_BITS * this.HASH_BITS,
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  private hammingDistance(hash1: string, hash2: string): number {
    if (hash1.length !== hash2.length) {
      throw new Error("Hashes must be the same length");
    }

    let distance = 0;
    for (let i = 0; i < hash1.length; i++) {
      if (hash1[i] !== hash2[i]) {
        distance++;
      }
    }
    return distance;
  }

  private calculateSimilarity(hash1: string, hash2: string): number {
    const distance = this.hammingDistance(hash1, hash2);
    const maxDistance = hash1.length;
    return 1.0 - distance / maxDistance;
  }

  async isDuplicate(
    stepNumber: number,
    imageBuffer: Buffer,
  ): Promise<number | null> {
    if (!this.enabled) {
      return null;
    }

    const currentHash = await this.computeHash(imageBuffer);

    this.screenshotHashes.set(stepNumber, currentHash);

    for (const [prevStepNumber, prevHash] of Array.from(
      this.screenshotHashes.entries(),
    )) {
      if (prevStepNumber >= stepNumber) continue;

      const similarity = this.calculateSimilarity(
        currentHash.hash,
        prevHash.hash,
      );
      const distance = this.hammingDistance(currentHash.hash, prevHash.hash);

      if (similarity >= this.SIMILARITY_THRESHOLD) {
        const duplicateInfo: DuplicateInfo = {
          stepNumber,
          originalStepNumber: prevStepNumber,
          similarity,
          reason: `${(similarity * 100).toFixed(1)}% similar (${distance}/${currentHash.hash.length} bits differ)`,
        };

        this.duplicates.push(duplicateInfo);

        console.log(
          `Screenshot ${stepNumber} is duplicate of step ${prevStepNumber}: ${duplicateInfo.reason}`,
        );
        return prevStepNumber;
      }
    }

    return null;
  }

  getDuplicates(): DuplicateInfo[] {
    return [...this.duplicates];
  }

  clear(): void {
    this.screenshotHashes.clear();
  }

  getStats(): { total: number; unique: number; duplicates: number } {
    return {
      total: this.screenshotHashes.size,
      unique: this.screenshotHashes.size,
      duplicates: this.duplicates.length,
    };
  }
}
