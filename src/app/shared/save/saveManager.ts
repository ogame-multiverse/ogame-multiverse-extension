import { ExtensionLocalData } from '../save/extensionLocalData';
import { ExtensionStorageService, StorageArea } from '../storage/extensionStorageService';
import { UniverseRegisterData } from '../UniverseRegisterData';

export class SaveManager {
  private readonly extensionStorageService: ExtensionStorageService<ExtensionLocalData> = new ExtensionStorageService<ExtensionLocalData>(StorageArea.Local);
  public async GetAllExtensionLocalDataAsync(): Promise<Record<string, ExtensionLocalData>> {
    return await this.extensionStorageService.GetAll();
  }
  public async GetExtensionLocalDataAsync(payload: { universeKey: string; }): Promise<ExtensionLocalData> {
    let localSave = await this.extensionStorageService.Get(payload.universeKey)
    if (!localSave) {
      localSave = new ExtensionLocalData({});
      await this.SaveExtensionLocalDataAsync({ universeKey: payload.universeKey, localSave })
    }
    return localSave;
  }
  public async SaveExtensionLocalDataAsync(payload: { universeKey: string; localSave: ExtensionLocalData; }): Promise<void> {
    await this.extensionStorageService.Set(payload.universeKey, payload.localSave);
  }

  public RemoveUniverseAsync(universeKey: string): Promise<void> {
    return this.extensionStorageService.Remove(universeKey);
  }

  public async RegisterUniverseAsync(payload: UniverseRegisterData): Promise<ExtensionLocalData> {
    let localSave = await this.extensionStorageService.Get(payload.UniverseKey)

    if (!localSave) {
      localSave = new ExtensionLocalData({
        UniverseKey: payload.UniverseKey,
        UniverseDomain: payload.UniverseDomain,
        LastRefreshDate: payload.LastRefreshDate,
      });
    }
    else {
      localSave.LastRefreshDate = payload.LastRefreshDate;
    }

    await this.SaveExtensionLocalDataAsync({ universeKey: payload.UniverseKey, localSave });
    return localSave;
  }

  public async RemoveExtensionLocalDataAsync(payload: { universeKey: string; }): Promise<void> {
    await this.extensionStorageService.Remove(payload.universeKey);
  }
}
