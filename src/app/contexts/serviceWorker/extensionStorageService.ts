import browser from 'webextension-polyfill';
import { Logger } from '../../logging/logger';

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
export class ExtensionStorageService extends BaseExtensionStorageService {

  constructor(private readonly logger: Logger) {
    super();
  }

  /**
   * Returns the appropriate storage area object based on the provided StorageArea enum.
   * @param area The storage area to retrieve (Local, Sync, or Session).
   * @returns The corresponding browser.Storage.StorageArea object.
   */
  private getArea(area: StorageArea): browser.Storage.StorageArea {
    return browser.storage[area];
  }

  /**
   * Retrieves the value associated with a specific key.
   * @param key The key to retrieve.
   * @returns A Promise resolved with the value (T) or null if the key does not exist.
   */
  public async Get<T>(area: StorageArea, key: string): Promise<T | null> {
    try {
      // Request the specific key; the API returns {key: value}
      const result = await this.getArea(area).get(key);

      // If the key is not found, 'result' is an empty object or the object lacks the key.
      if (result && key in result) {
        this.logger.debug(`✅ Successfully retrieved key '${key}' from '${area}' storage`);
        return result[key] as T;
      }
      this.logger.warn(`⚠️ Key '${key}' not found in '${area}' storage`);
      return null;
    } catch (error) {
      this.logger.error(`⚠️ Error retrieving key '${key}':`, error);
      return null;
    }
  }

  /**
   * Saves a value to the storage area.
   * @param key The key to save.
   * @param value The value to save (must match type T).
   * @returns An empty Promise.
   */
  public async Set<T>(area: StorageArea, key: string, value: T): Promise<void> {
    this.logger.debug(`💾 About to save key '${key}' into ${area} storage`);
    try {
      await this.getArea(area).set({ [key]: value });
      this.logger.debug(`✅ Successfully saved key '${key}' to '${area}' storage`);
    } catch (error) {
      this.logger.error(`⚠️ Error saving key '${key}':`, error);
    }
  }

  public async GetSizeInBytes(area: StorageArea, key: string): Promise<number> {
    try {
      const result = await this.getArea(area).get(key);
      if (result && key in result) {
        const sizeInBytes = BaseExtensionStorageService.GetByteSize(result[key]);
        this.logger.debug(`✅ Size of key '${key}' in '${area}' storage: ${sizeInBytes} bytes`);
        return sizeInBytes;
      }
      this.logger.warn(`⚠️ Key '${key}' not found in '${area}' storage`);
      return 0;
    } catch (error) {
      this.logger.error(`⚠️ Error getting size of key '${key}':`, error);
      return 0;
    }
  }

  /**
   * Removes a key from the storage area.
   * @param key The key to remove.
   * @returns An empty Promise.
   */
  public async Remove(area: StorageArea, key: string): Promise<void> {
    try {
      await this.getArea(area).remove(key);
      this.logger.debug(`✅ Successfully removed key '${key}' from '${area}' storage`);
    } catch (error) {
      this.logger.error(`⚠️ Error removing key '${key}':`, error);
    }
  }

  /**
   * Retrieves all key-value pairs from the storage area.
   * @param typeGuard Optional type guard function to filter values of type T.
   * @returns A Promise resolved with a record of key-value pairs, filtered by the type guard if provided.
   */
  public async GetAll<T = any>(area: StorageArea, typeGuard?: (value: unknown) => value is T
  ): Promise<Record<string, T>> {
    try {
      const result = (await this.getArea(area).get(null)) ?? {};

      // If no predicate is provided, return all entries as-is
      if (!typeGuard) return result as Record<string, T>;

      // Strict runtime filtering: keep only entries matching the type predicate
      const filtered: Record<string, T> = {};
      for (const [key, value] of Object.entries(result)) {
        if (typeGuard(value)) {
          filtered[key] = value;
        }
      }

      return filtered;
    } catch (error) {
      this.logger.error(`⚠️ Error reading all keys from '${area}' storage:`, error);
      return {};
    }
  }
  /**
   * Returns the total size in bytes of the whole storage area.
   */
  public async GetAllSizeInBytes(area: StorageArea): Promise<number> {
    try {
      const storageArea = this.getArea(area);
      if (typeof storageArea.getBytesInUse === 'function') {
        return await storageArea.getBytesInUse(null);
      }

      const allValues = await this.GetAll(area);
      return BaseExtensionStorageService.GetByteSize(allValues);
    } catch (error) {
      this.logger.error(`⚠️ Error getting total size from '${area}' storage:`, error);
      return 0;
    }
  }

  /**
   * Clears all keys from the storage area.
   */
  public async Clear(area: StorageArea): Promise<void> {
    try {
      await this.getArea(area).clear();
      this.logger.debug(`✅ Successfully cleared '${area}' storage`);
    } catch (error) {
      this.logger.error(`⚠️ Error clearing '${area}' storage:`, error);
    }
  }
}