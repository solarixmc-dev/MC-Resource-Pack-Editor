/**
 * Pack Library Service
 * Manages storing and retrieving exported packs in localStorage
 * Now user-specific based on login credentials
 */

export interface SavedPack {
  id: string;
  name: string;
  description: string;
  icon: string | null;
  packData: ArrayBuffer;
  createdAt: string;
  fileSize: number;
  userId: string; // Add user ID to associate packs with users
}

const STORAGE_KEY_PREFIX = 'mc-pack-editor-library-';

export class PackLibrary {
  private savedPacks: SavedPack[] = [];
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
    this.loadFromStorage();
  }

  private getStorageKey(): string {
    return `${STORAGE_KEY_PREFIX}${this.userId}`;
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.getStorageKey());
      if (stored) {
        this.savedPacks = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load pack library:', error);
      this.savedPacks = [];
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(this.getStorageKey(), JSON.stringify(this.savedPacks));
    } catch (error) {
      console.error('Failed to save pack library:', error);
      throw new Error('Failed to save pack to library. Storage may be full.');
    }
  }

  async savePack(
    name: string,
    description: string,
    icon: string | null,
    packData: ArrayBuffer
  ): Promise<SavedPack> {
    // Convert ArrayBuffer to base64 for storage
    const base64Data = this.arrayBufferToBase64(packData);
    
    const savedPack: SavedPack = {
      id: crypto.randomUUID(),
      name,
      description,
      icon,
      packData: base64Data,
      createdAt: new Date().toISOString(),
      fileSize: packData.byteLength,
      userId: this.userId, // Associate with current user
    };

    this.savedPacks.unshift(savedPack);
    this.saveToStorage();

    return savedPack;
  }

  async loadPack(id: string): Promise<ArrayBuffer> {
    const pack = this.savedPacks.find(p => p.id === id);
    if (!pack) {
      throw new Error('Pack not found');
    }

    return this.base64ToArrayBuffer(pack.packData as any);
  }

  getAllPacks(): SavedPack[] {
    return [...this.savedPacks];
  }

  deletePack(id: string): void {
    this.savedPacks = this.savedPacks.filter(p => p.id !== id);
    this.saveToStorage();
  }

  getPackById(id: string): SavedPack | undefined {
    return this.savedPacks.find(p => p.id === id);
  }

  clearAll(): void {
    this.savedPacks = [];
    this.saveToStorage();
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  getStorageUsage(): { used: number; total: number; percentage: number } {
    const used = JSON.stringify(this.savedPacks).length;
    const total = 5 * 1024 * 1024; // 5MB typical localStorage limit
    return {
      used,
      total,
      percentage: (used / total) * 100,
    };
  }

  // Static method to get user-specific library instance
  static forUser(userId: string): PackLibrary {
    return new PackLibrary(userId);
  }
}

// Function to get user-specific library
export function getUserPackLibrary(userId: string): PackLibrary {
  return PackLibrary.forUser(userId);
}
