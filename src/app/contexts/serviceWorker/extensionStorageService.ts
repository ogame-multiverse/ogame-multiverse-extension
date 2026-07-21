// The type polyfill is still needed to avoid the error on 'browser'.
declare var browser: typeof chrome;
const browserApi = (typeof browser !== 'undefined' ? browser : chrome) as typeof chrome;

/**
 * Enumeration for the different storage areas available in browser extensions:
 *  - Local: Extension's local storage.
 *    - persists only on the current device.
 *    - not synced with other devices.
 *    - suitable for large data or cache.
 *  - Sync: Synchronized storage across devices.
 *    - persists across devices where the user is logged in.
 *    - data is synced via the browser's sync mechanism.
 *    - limited quota (usually around 100KB).
 *  - Session: Storage for the current session only.
 *    - cleared when the browser or extension is closed.
 *    - not synced across devices.
 *    - limited quota.
 */
export enum StorageArea {
  Local = 'local',
  Sync = 'sync',
  Session = 'session',
}

class BaseExtensionStorageService {
  protected static GetByteSize(obj: unknown): number {
    if (obj === undefined) return 0;
    const s = JSON.stringify(obj);
    if (!s) return 0;
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s).length;
    // fallback for environments with Buffer
    // @ts-ignore
    if (typeof Buffer !== 'undefined') return Buffer.byteLength(s, 'utf8');
    return s.length;
  }
}

/**
 * Generic base class to manage an extension storage area.
 * T is the type of the stored value (e.g., string, number, MySettingsObject).
 */
export class ExtensionStorageService<T> extends BaseExtensionStorageService {
  private storageArea: chrome.storage.StorageArea;

  constructor(
    private area: StorageArea
  ) {
    super();
    this.storageArea = browserApi.storage[area];
  }

  /**
   * Retrieves the value associated with a specific key.
   * @param key The key to retrieve.
   * @returns A Promise resolved with the value (T) or null if the key does not exist.
   */
  public async Get(key: string): Promise<T | null> {
    try {
      // Request the specific key; the API returns {key: value}
      const result = await this.storageArea.get(key);

      // If the key is not found, 'result' is an empty object or the object lacks the key.
      if (result && key in result) {
        console.debug(`✅ Successfully retrieved key '${key}' from '${this.area}' storage`);
        return result[key] as T;
      }
      console.warn(`⚠️ Key '${key}' not found in '${this.area}' storage`);
      return null;
    } catch (error) {
      console.error(`⚠️ Error retrieving key '${key}':`, error);
      return null;
    }
  }

  /**
   * Saves a value to the storage area.
   * @param key The key to save.
   * @param value The value to save (must match type T).
   * @returns An empty Promise.
   */
  public async Set(key: string, value: T): Promise<void> {
    const sizeInBytes = BaseExtensionStorageService.GetByteSize(value);
    console.info(`💾 About to save ${sizeInBytes} bytes into ${this.area} storage with key '${key}'`);
    try {
      await this.storageArea.set({ [key]: value });
      console.debug(`✅ Successfully saved key '${key}' to '${this.area}' storage`);
    } catch (error) {
      console.error(`⚠️ Error saving key '${key}':`, error);
    }
  }

  public async GetSizeInBytes(key: string): Promise<number> {
    try {
      const result = await this.storageArea.get(key);
      if (result && key in result) {
        const value = result[key];
        const jsonString = JSON.stringify(value);
        const sizeInBytes = new TextEncoder().encode(jsonString).length;
        console.debug(`✅ Size of key '${key}' in '${this.area}' storage: ${sizeInBytes} bytes`);
        return sizeInBytes;
      }
      console.warn(`⚠️ Key '${key}' not found in '${this.area}' storage`);
      return 0;
    } catch (error) {
      console.error(`⚠️ Error getting size of key '${key}':`, error);
      return 0;
    }
  }

  /**
   * Removes a key from the storage area.
   * @param key The key to remove.
   * @returns An empty Promise.
   */
  public async Remove(key: string): Promise<void> {
    try {
      await this.storageArea.remove(key);
      console.info(`✅ Successfully removed key '${key}' from '${this.area}' storage`);
    } catch (error) {
      console.error(`⚠️ Error removing key '${key}':`, error);
    }
  }

  /**
     * Returns all key/value pairs from the storage area.
     */
  public async GetAll(): Promise<Record<string, T | null>> {
    try {
      const result = await this.storageArea.get(null);
      // 🔧 Correction : Cast explicite du résultat vers le type attendu
      return (result ?? {}) as Record<string, T | null>;
    } catch (error) {
      console.error(`⚠️ Error reading all keys from '${this.area}' storage:`, error);
      return {};
    }
  }

  /**
   * Returns the total size in bytes of the whole storage area.
   */
  public async GetAllSizeInBytes(): Promise<number> {
    try {
      if (typeof this.storageArea.getBytesInUse === 'function') {
        return await this.storageArea.getBytesInUse(null);
      }

      const allValues = await this.GetAll();
      return BaseExtensionStorageService.GetByteSize(allValues);
    } catch (error) {
      console.error(`⚠️ Error getting total size from '${this.area}' storage:`, error);
      return 0;
    }
  }

  /**
   * Clears all keys from the storage area.
   */
  public async Clear(): Promise<void> {
    try {
      await this.storageArea.clear();
      console.info(`✅ Successfully cleared '${this.area}' storage`);
    } catch (error) {
      console.error(`⚠️ Error clearing '${this.area}' storage:`, error);
    }
  }
}

// ----------------------------------------------------------------------
// USAGE EXAMPLE (Better Typing)
// ----------------------------------------------------------------------

// 1. Define an interface for your synchronized preferences
/*
interface UserSettings {
    theme: 'dark' | 'light';
    volume: number;
}
*/

// 2. Create strongly typed instances
/*
const syncStorage = new ExtensionStorageService<UserSettings>(logger, 'StorageArea.Sync');
const localStorageForCache = new ExtensionStorageService<string>(logger, 'StorageArea.Local');
const webLocalStorage = new WebStorageService<number>(logger); // To store numbers in window.localStorage
*/
