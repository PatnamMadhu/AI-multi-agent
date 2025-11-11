import blockhash from "blockhash-core";
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

  /**
   * Compute perceptual hash for a screenshot buffer
   */
  async computeHash(imageBuffer: Buffer): Promise<PerceptualHash> {
    return new Promise((resolve, reject) => {
      try {
        const png = PNG.sync.read(imageBuffer);
        
        // blockhash-core expects RGBA data (4 channels per pixel)
        const { width, height, data } = png;
        const imgData = {
          width,
          height,
          data: new Uint8Array(data), // Use full RGBA data
        };

        // Compute blockhash with RGBA data (4 channels)
        const hash = blockhash(imgData, this.HASH_BITS, 2);

        resolve({
          hash,
          bits: this.HASH_BITS * this.HASH_BITS,
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Calculate Hamming distance between two hashes (number of differing bits)
   */
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

  /**
   * Calculate similarity percentage (0.0 to 1.0)
   */
  private calculateSimilarity(hash1: string, hash2: string): number {
    const distance = this.hammingDistance(hash1, hash2);
    const maxDistance = hash1.length;
    return 1.0 - distance / maxDistance;
  }

  /**
   * Check if screenshot is duplicate of any previous screenshot
   * Returns the step number of the duplicate, or null if unique
   */
  async isDuplicate(stepNumber: number, imageBuffer: Buffer): Promise<number | null> {
    if (!this.enabled) {
      return null; // Visual diff disabled
    }

    const currentHash = await this.computeHash(imageBuffer);
    
    // Store hash for future comparisons
    this.screenshotHashes.set(stepNumber, currentHash);

    // Compare with all previous screenshots
    for (const [prevStepNumber, prevHash] of this.screenshotHashes.entries()) {
      if (prevStepNumber >= stepNumber) {
        continue; // Skip current and future steps
      }

      const similarity = this.calculateSimilarity(currentHash.hash, prevHash.hash);
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
          `Screenshot ${stepNumber} is duplicate of step ${prevStepNumber}: ${duplicateInfo.reason}`
        );
        return prevStepNumber;
      }
    }

    return null; // Unique screenshot
  }

  /**
   * Get all detected duplicates for this workflow
   */
  getDuplicates(): DuplicateInfo[] {
    return [...this.duplicates];
  }

  /**
   * Clear all stored hashes (call at end of workflow)
   */
  clear(): void {
    this.screenshotHashes.clear();
  }

  /**
   * Get statistics about duplicate detection
   */
  getStats(): { total: number; unique: number; duplicates: number } {
    return {
      total: this.screenshotHashes.size,
      unique: this.screenshotHashes.size,
      duplicates: 0, // This would need tracking during workflow execution
    };
  }
}
