import { ExtensionLocalData } from '../../model/save/extensionLocalData';
import { UniverseSidePanelOptions } from '../../model/sidePanel/universeSidePanelOptions';
import { ExtensionStorageService } from './extensionStorageService';

export class SaveManager {
  constructor(private readonly extensionStorageService: ExtensionStorageService<ExtensionLocalData>) { }
  public async GetAllExtensionLocalDataAsync(): Promise<Record<string, ExtensionLocalData>> {
    return await this.extensionStorageService.GetAll();
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
    let localSave = await this.extensionStorageService.Get(universeKey)
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
