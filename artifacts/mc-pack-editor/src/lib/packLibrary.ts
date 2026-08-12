/**
 * Pack Library Service
 * Manages storing and retrieving exported packs using IndexedDB
 * Local storage without authentication requirement
 */

export interface SavedPack {
  id: string;
  name: string;
  description: string;
  icon: string | null;
  packData: string; // base64 encoded
  createdAt: string;
  fileSize: number;
  userId: string;
}

export interface EditorState {
  packs: Array<{
    id: string;
    name: string;
    description: string;
    icon: string | null;
    fileCount: number;
  }>;
  packName: string;
  packDescription: string;
  packIcon: string | null;
}

class PackLibraryIndexedDB {
  private userId: string;
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = 'MCPackEditorLibrary';
  private readonly DB_VERSION = 2; // Incremented to add new store
  private readonly STORE_NAME = 'packs';
  private readonly EDITOR_STATE_STORE = 'editorState';

  constructor(userId: string) {
    this.userId = userId;
  }

  private async initDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create packs store if it doesn't exist
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
          store.createIndex('userId', 'userId', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
        
        // Create editor state store if it doesn't exist
        if (!db.objectStoreNames.contains(this.EDITOR_STATE_STORE)) {
          const editorStore = db.createObjectStore(this.EDITOR_STATE_STORE, { keyPath: 'userId' });
        }
      };
    });
  }

  async savePack(
    name: string,
    description: string,
    icon: string | null,
    packData: ArrayBuffer
  ): Promise<SavedPack> {
    console.log('=== Saving pack to IndexedDB ===');
    console.log('User ID:', this.userId);
    console.log('Pack name:', name);
    console.log('Pack size:', packData.byteLength);

    const db = await this.initDB();

    const savedPack: SavedPack = {
      id: crypto.randomUUID(),
      name,
      description,
      icon,
      packData: this.arrayBufferToBase64(packData),
      createdAt: new Date().toISOString(),
      fileSize: packData.byteLength,
      userId: this.userId,
    };

    console.log('Saved pack object:', savedPack);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.add(savedPack);

      request.onsuccess = () => {
        console.log('Successfully saved to IndexedDB');
        resolve(savedPack);
      };

      request.onerror = () => reject(request.error);
    });
  }

  async loadPack(packId: string): Promise<ArrayBuffer> {
    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.get(packId);

      request.onsuccess = () => {
        const pack = request.result;
        if (pack) {
          const arrayBuffer = this.base64ToArrayBuffer(pack.packData);
          resolve(arrayBuffer);
        } else {
          reject(new Error('Pack not found'));
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  async deletePack(packId: string): Promise<void> {
    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.delete(packId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clearAll(): Promise<void> {
    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Editor state persistence
  async saveEditorState(state: EditorState): Promise<void> {
    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.EDITOR_STATE_STORE], 'readwrite');
      const store = transaction.objectStore(this.EDITOR_STATE_STORE);
      const request = store.put({
        userId: this.userId,
        state: JSON.stringify(state),
        updatedAt: new Date().toISOString()
      });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async loadEditorState(): Promise<EditorState | null> {
    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.EDITOR_STATE_STORE], 'readonly');
      const store = transaction.objectStore(this.EDITOR_STATE_STORE);
      const request = store.get(this.userId);

      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          try {
            const state = JSON.parse(result.state) as EditorState;
            resolve(state);
          } catch (error) {
            console.error('Failed to parse editor state:', error);
            resolve(null);
          }
        } else {
          resolve(null);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  async clearEditorState(): Promise<void> {
    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.EDITOR_STATE_STORE], 'readwrite');
      const store = transaction.objectStore(this.EDITOR_STATE_STORE);
      const request = store.delete(this.userId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Clean up old editor state entries from packs store (public method)
  async cleanupOldEditorStateEntries(): Promise<void> {
    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.openCursor();

      request.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest).result;
        if (cursor) {
          const pack = cursor.value;
          if (pack.id && pack.id.startsWith('editor-state-')) {
            cursor.delete();
          }
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  async getAllPacks(): Promise<SavedPack[]> {
    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const index = store.index('userId');
      const request = index.getAll(this.userId);

      request.onsuccess = () => {
        const packs = request.result || [];
        // Filter out any old editor state entries
        const filteredPacks = packs.filter(pack => !pack.id.startsWith('editor-state-'));
        // Sort by createdAt descending (newest first)
        filteredPacks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        console.log('Loaded packs from IndexedDB:', filteredPacks);
        resolve(filteredPacks);
      };

      request.onerror = () => reject(request.error);
    });
  }

  getStorageUsage(): { used: number; total: number; percentage: number } {
    // IndexedDB doesn't have a reliable way to get storage usage
    // Return estimated values
    return { used: 0, total: 500 * 1024 * 1024, percentage: 0 }; // 500MB estimated
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
}

// Factory function to get local library
export function getLocalPackLibrary(): PackLibraryIndexedDB {
  return new PackLibraryIndexedDB('local-user');
}
