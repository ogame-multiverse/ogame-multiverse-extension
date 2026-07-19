import { UniverseDataNormalizer } from "../shared/UniverseDataNormalizer";
import { ExtensionLocalData } from "../shared/save/extensionLocalData";
import { SaveManager } from "../shared/save/saveManager";
import { UniverseData } from "../shared/universeData";

import { SidePanelUniverseStatus } from "../shared/messaging/messageContracts";
import { UniverseTabsService } from "./UniverseTabsService";
import { UniverseRegisterData } from "../shared/UniverseRegisterData";

export class UniverseManager {

  private readonly universeDataByUniverse = new Map<string, UniverseData>();
  private readonly savesByUniverse = new Map<string, ExtensionLocalData>();

  private readonly saveManager: SaveManager;
  private readonly universeTabsService: UniverseTabsService
  constructor(saveManager: SaveManager, universeTabsService: UniverseTabsService) {
    this.saveManager = saveManager;
    this.universeTabsService = universeTabsService;
  }

  public async InitializeAsync(): Promise<void> {
    try {
      const universes = await this.saveManager.GetAllExtensionLocalDataAsync();

      // On vide proprement la Map actuelle sans détruire sa référence en mémoire
      this.savesByUniverse.clear();

      if (universes) {
        for (const [key, value] of Object.entries(universes)) {
          this.savesByUniverse.set(key, value);
        }
      }

      console.info(`[Init] Initialisé avec succès. Nombre d'univers : ${this.savesByUniverse.size}`);
    } catch (error) {
      console.error("[Init] Erreur d'initialisation :", error);
    }
  }

  public async RegisterUniverseAsync(payload: UniverseRegisterData): Promise<void> {
    // Register the universe in the local save and update the in-memory map
    const localSave = await this.saveManager.RegisterUniverseAsync(payload);
    this.savesByUniverse.set(payload.UniverseKey, localSave);
  }

  public async RemoveUniverseAsync(universeKey: string): Promise<void> {
    //remove the universe from the local save and update the in-memory map
    await this.saveManager.RemoveUniverseAsync(universeKey);
    this.savesByUniverse.delete(universeKey);
    this.universeDataByUniverse.delete(universeKey);

  }

  public async UpdateUniverseStatusAsync(universeKey: string, universeData: UniverseData): Promise<void> {
    const key = UniverseDataNormalizer.NormalizeUniverseKey(universeKey);
    if (!key) return;

    // Update the in-memory universe data
    this.universeDataByUniverse.set(key, universeData);

    // Update the local save with the new universe name if it has changed
    const localSave = this.savesByUniverse.get(key);
    if (localSave && localSave.UniverseName !== universeData.UniverseName) {
      localSave.UniverseName = universeData.UniverseName;
      await this.saveManager.SaveExtensionLocalDataAsync({ universeKey, localSave });
    }

  }


  public async ListUniverseStatusesAsync(): Promise<SidePanelUniverseStatus[]> {
    const allUniverseKeys = Array.from(this.savesByUniverse.keys());
    console.info(`[ListUniverseStatusesAsync] Found ${allUniverseKeys.length} universe(s) in local save.`);

    await this.universeTabsService.RebuildOpenTabsStateAsync();
    const openTabsCountByUniverse = this.universeTabsService.GetOpenTabsCountByUniverse(allUniverseKeys);

    return Array.from(allUniverseKeys)
      .sort((a, b) => a.localeCompare(b))
      .map((universeKey) => this.BuildUniverseStatus(universeKey, this.savesByUniverse.get(universeKey), openTabsCountByUniverse));
  }

  private BuildUniverseStatus(universeKey: string, universe: ExtensionLocalData | undefined, openTabsCountByUniverse: Map<string, number>): SidePanelUniverseStatus {
    const openTabsCount = openTabsCountByUniverse.get(universeKey) || 0;
    const lastRefreshAtMs = universe?.LastRefreshDate;

    const universeData = this.universeDataByUniverse.get(universeKey);
    const detectedDisplayName = universe?.UniverseName;

    return {
      universeKey,
      universeDisplayName: detectedDisplayName || UniverseDataNormalizer.ToUniverseDisplayName(universeKey),
      isOpen: openTabsCount > 0,
      openTabsCount,
      newMessages: universeData?.MessagesCount ?? 0,
      newChatMessages: universeData?.ChatMessagesCount ?? 0,
      hostileFleetCount: universeData?.HostileFleetCount ?? 0,
      friendlyFleetCount: universeData?.FriendlyFleetCount ?? 0,
      ownFleetCount: universeData?.OwnFleetCount ?? 0,
      lastRefreshAtIso: typeof lastRefreshAtMs === 'number' ? new Date(lastRefreshAtMs).toISOString() : undefined,
      WarningThresholdMinutes: universe?.WarningThresholdMinutes ?? 15,
      ShowHostileFleetIndicator: universe?.ShowHostileFleetIndicator ?? true,
      ShowFriendlyFleetIndicator: universe?.ShowFriendlyFleetIndicator ?? true,
      ShowOwnFleetIndicator: universe?.ShowOwnFleetIndicator ?? true,
      ShowUnreadMessagesIndicator: universe?.ShowUnreadMessagesIndicator ?? true,
      ShowUnreadChatMessagesIndicator: universe?.ShowUnreadChatMessagesIndicator ?? true,
    };
  }




}