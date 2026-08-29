import browser from 'webextension-polyfill';
import { ExtensionLocalData } from '../../model/save/extensionLocalData';
import { UniverseSidePanelOptions } from '../../model/sidePanel/universeSidePanelOptions';
import { ExtensionStorageService } from './extensionStorageService';

// Reserved storage key holding the user-defined universe display order.
export const UNIVERSE_ORDER_STORAGE_KEY = '__ogm_universe_order';

export class SaveManager {
  constructor(private readonly extensionStorageService: ExtensionStorageService) { }
  private IsExtensionLocalData(val: unknown): val is ExtensionLocalData {
    return (
      typeof val === 'object' &&
      val !== null &&
      !Array.isArray(val) &&
      ('UniverseKey' in val || 'LastRefreshDate' in val)
    );
  }

  public async GetAllExtensionLocalDataAsync(): Promise<Record<string, ExtensionLocalData>> {
    return await this.extensionStorageService.GetAll<ExtensionLocalData>(
      (val): val is ExtensionLocalData => this.IsExtensionLocalData(val)
    );
  }

  public async GetUniverseOrderAsync(): Promise<string[]> {
    try {
      const result = await browser.storage.local.get(UNIVERSE_ORDER_STORAGE_KEY);
      const raw = result?.[UNIVERSE_ORDER_STORAGE_KEY];
      if (!Array.isArray(raw)) return [];
      return raw.filter((k): k is string => typeof k === 'string').map((k) => k.trim().toLowerCase()).filter(Boolean);
    } catch {
      return [];
    }
  }

  public async SaveUniverseOrderAsync(order: string[]): Promise<string[]> {
    const normalized = this.NormalizeOrder(order);
    await browser.storage.local.set({ [UNIVERSE_ORDER_STORAGE_KEY]: normalized });
    return normalized;
  }

  public async AppendToUniverseOrderAsync(universeKey: string): Promise<void> {
    const key = (universeKey || '').trim().toLowerCase();
    if (!key) return;
    const order = await this.GetUniverseOrderAsync();
    if (order.includes(key)) return;
    order.push(key);
    await this.SaveUniverseOrderAsync(order);
  }

  public async RemoveFromUniverseOrderAsync(universeKey: string): Promise<void> {
    const key = (universeKey || '').trim().toLowerCase();
    if (!key) return;
    const order = await this.GetUniverseOrderAsync();
    const next = order.filter((k) => k !== key);
    if (next.length === order.length) return;
    await this.SaveUniverseOrderAsync(next);
  }

  private NormalizeOrder(order: string[]): string[] {
    const seen = new Set<string>();
    const normalized: string[] = [];
    for (const raw of order || []) {
      if (typeof raw !== 'string') continue;
      const key = raw.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      normalized.push(key);
    }
    return normalized;
  }

  public async GetExtensionLocalDataAsync(universeKey: string): Promise<ExtensionLocalData> {
    let localSave = new ExtensionLocalData(await this.extensionStorageService.Get(universeKey));
    if (!localSave) {
      localSave = new ExtensionLocalData({});
      await this.SaveExtensionLocalDataAsync(universeKey, localSave)
    }
    return localSave;
  }

  public async GetUniverseSidePanelOptionsAsync(universeKey: string): Promise<UniverseSidePanelOptions> {
    const localSave = await this.GetExtensionLocalDataAsync(universeKey);
    return localSave.SidePanelOptions;
  }


  public async SaveUniverseSidePanelOptionsAsync(universeKey: string, options: UniverseSidePanelOptions): Promise<void> {
    const localSave = await this.GetExtensionLocalDataAsync(universeKey);
    localSave.SidePanelOptions = options;
    await this.SaveExtensionLocalDataAsync(universeKey, localSave);
  }

  public async SaveExtensionLocalDataAsync(universeKey: string, localSave: ExtensionLocalData): Promise<void> {
    await this.extensionStorageService.Set(universeKey, localSave);
  }

  public RemoveUniverseAsync(universeKey: string): Promise<void> {
    return this.extensionStorageService.Remove(universeKey);
  }

  public async RegisterUniverseAsync(universeKey: string, universeDomain: string, lastRefreshDate: number): Promise<ExtensionLocalData> {
    let localSave = await this.extensionStorageService.Get<ExtensionLocalData>(universeKey)
    if (!localSave) {
      localSave = new ExtensionLocalData({
        UniverseKey: universeKey,
        UniverseDomain: universeDomain,
        LastRefreshDate: lastRefreshDate,
      });
    }
    else {
      localSave.LastRefreshDate = lastRefreshDate;
    }

    await this.SaveExtensionLocalDataAsync(universeKey, localSave);
    return localSave;
  }

  public async RemoveExtensionLocalDataAsync(universeKey: string): Promise<void> {
    await this.extensionStorageService.Remove(universeKey);
  }
}
