import browser from 'webextension-polyfill';
import { LocalizationStrings } from '../../../types/LocalizationStrings';
import { browserInfo } from '../../dom/browserInfos';
import { OgameDomData } from '../../dom/ogameDom/ogameDomData';
import { Localizator } from '../../localization/localizator';
import { serviceWorkerLoggerFactory } from '../../logging/loggerFactory';
import { OgameQueriesOptions } from '../../messaging/data/ogameQueriesOptions';
import { serviceWorkerProtocolRegistrar } from '../../messaging/serviceWorkerProtocol';
import { sidePanelBroadcastProtocolClient } from '../../messaging/sidePanelBroadcastProtocol';
import { FlyingFleetEvent } from '../../model/flyingFleetEvent';
import { SidePanelUniverseCounters } from '../../model/sidePanel/sidePanelUniverseCounters';
import { UniverseLayoutConfig } from '../../model/sidePanel/universeLayoutConfig';
import { UniverseSidePanelOptions } from '../../model/sidePanel/universeSidePanelOptions';
import { SidePanelGlobalOptions } from '../../model/sidePanel/sidePanelGlobalOptions';
import { ContextMenusManager } from './contextMenusManager';
import { ExtensionStorageService } from './extensionStorageService';
import { KeyboardCommandsManager } from './keyboardCommandsManager';
import { ApiDataParser } from './ogameRequest/api/apiDataParser';
import { OgameQuery, OgameQueryResult } from './ogameRequest/ogameQuery';
import { SaveManager } from './saveManager';
import { SidePanelManager } from './sidePanelManager';
import { UniverseManager } from './universeManager';
import { UniverseTabsManager } from './universeTabsManager';
import { ApiDataMerger } from './ogameRequest/api/apiDataMerger';
import { GlobalConstants } from '../../globalConstants';

class ServiceWorkerContextApp {
    private readonly extensionStorageService: ExtensionStorageService;
    private readonly saveManager: SaveManager;
    private readonly universeManager: UniverseManager;
    private readonly universeTabsManager: UniverseTabsManager;
    private readonly sidePanelManager: SidePanelManager;
    private readonly contextMenusManager: ContextMenusManager;
    private readonly keyboardCommandsManager: KeyboardCommandsManager
    private readonly logger = serviceWorkerLoggerFactory.CreateLogger("ServiceWorkerContextApp");
    private readonly ogameQuery: OgameQuery;
    private readonly apiDataMerger: ApiDataMerger;
    private readonly apiDataParser: ApiDataParser;

    constructor() {
        this.extensionStorageService = new ExtensionStorageService(serviceWorkerLoggerFactory.CreateLogger("ExtensionStorageService"));

        this.saveManager = new SaveManager(this.extensionStorageService);
        this.universeTabsManager = new UniverseTabsManager(serviceWorkerLoggerFactory.CreateLogger("UniverseTabsService"));

        this.sidePanelManager = new SidePanelManager(serviceWorkerLoggerFactory.CreateLogger("SidePanelManager"));
        this.universeManager = new UniverseManager(serviceWorkerLoggerFactory.CreateLogger("UniverseManager"), this.saveManager, this.universeTabsManager);
        this.contextMenusManager = new ContextMenusManager(serviceWorkerLoggerFactory.CreateLogger("ContextMenusManager"), this.sidePanelManager);
        this.keyboardCommandsManager = new KeyboardCommandsManager(serviceWorkerLoggerFactory.CreateLogger("KeyboardCommandsManager"), this.sidePanelManager);
        this.ogameQuery = new OgameQuery(serviceWorkerLoggerFactory.CreateLogger("OgameQuery"));
        this.apiDataParser = new ApiDataParser();
        this.apiDataMerger = new ApiDataMerger(serviceWorkerLoggerFactory.CreateLogger("ApiDataMerger"), this.saveManager, this.apiDataParser);
        this.RegisterServiceWorkerEvents();

        browser.runtime.onInstalled.addListener(this.OnExtensionInstallation);
    }

    private RegisterServiceWorkerEvents(): void {

        /* LOCALIZATION */
        serviceWorkerProtocolRegistrar.OnSaveLocalizationStrings(this.logger, async (data: { universeKey: string, language: string, localizationStrings: LocalizationStrings }) => {
            if (data.localizationStrings) await this.saveManager.SaveLocalizationStringsAsync(data.universeKey, data.language, data.localizationStrings);
        });
        serviceWorkerProtocolRegistrar.OnGetLocalizationData(this.logger, async (universeKey: string) => {
            return await this.saveManager.GetLocalizationDataAsync(universeKey);
        });



        serviceWorkerProtocolRegistrar.OnGetExtensionData(this.logger, async (universeKey: string) => {
            return await this.saveManager.GetExtensionDataAsync(universeKey);
        });

        serviceWorkerProtocolRegistrar.OnRunOgameQueries(this.logger, async (data: { universeKey: string, universeDomain: string, options: OgameQueriesOptions }) => {
            if (!data.universeDomain) return; // If universeDomain is not provided, we cannot run the queries, so we return early.

            const extensionLocalData = await this.saveManager.GetExtensionLocalDataAsync(data.universeKey);


            // Run the OGame queries based on the provided options and update the session data accordingly
            var results = await this.ogameQuery.RunOgameQueriesAsync(extensionLocalData, data.universeDomain, data.options);


            await this.apiDataMerger.MergeOgameQueryResultAsync(extensionLocalData, results);

            await this.universeManager.ApplyQueryResultAsync(data.universeKey, extensionLocalData);
        });

        // Handle the application of OGame DOM data
        serviceWorkerProtocolRegistrar.OnApplyDomData(this.logger, async (data: { universeKey: string, data: OgameDomData }) => {
            if (GlobalConstants.STORE_OGAME_PAGE_PARSING_RESULTS_TO_SESSION_STORAGE) {
                const universeSessionData = await this.saveManager.GetExtensionSessionDataAsync(data.universeKey);
                universeSessionData.PageData = data.data;
                await this.saveManager.SaveExtensionSessionDataAsync(data.universeKey, universeSessionData);
            }
        });

        // Handle the registration of a new universe, including its key, name, domain, and last refresh date
        serviceWorkerProtocolRegistrar.OnRegisterUniverse(this.logger, async (data: { universeKey: string, universeName: string, universeDomain: string, lastRefreshDate: number }) => {
            // Register the universe in the service worker storage
            await this.universeManager.RegisterUniverseAsync(data.universeKey, data.universeName, data.universeDomain, data.lastRefreshDate);

            // Notify the side panel that a new universe has been registered
            sidePanelBroadcastProtocolClient.RegisterUniverse(this.logger, data.universeKey, data.universeName, data.universeDomain, data.lastRefreshDate);
        });

        // Handle updates to the universe status, including counters and flying fleet events
        serviceWorkerProtocolRegistrar.OnUpdateUniverseStatus(this.logger, async (data: { universeKey: string, universeCounters: SidePanelUniverseCounters, flyingFleetEvents: FlyingFleetEvent[] }) => {
            // Update the universe status in the service worker storage
            await this.universeManager.UpdateUniverseStatusAsync(data.universeKey, data.universeCounters, data.flyingFleetEvents);

            // Notify the side panel about the updated universe status
            const isOpen = this.universeTabsManager.HasOpenTabForUniverse(data.universeKey);
            sidePanelBroadcastProtocolClient.UpdateUniverseStatus(this.logger, data.universeKey, data.universeCounters, isOpen, data.flyingFleetEvents);
        });

        // Handle requests to list the statuses of all universes, either in a list or grid format
        serviceWorkerProtocolRegistrar.OnGetUniversesStatuses(this.logger, (data) =>
            this.universeManager.ListUniverseStatusesAsync(data)
        );

        // Handle actions on universe tabs, such as opening or closing a tab for a specific universe
        serviceWorkerProtocolRegistrar.OnActionOnUniverseTab(this.logger, async (data) => {
            await this.universeTabsManager.ActionOnUniverseTabAsync(data.universeKey, data.action, data.windowId);
        });

        // Handle the removal of a universe, including its data and associated tabs, and notify the side panel about the removal
        serviceWorkerProtocolRegistrar.OnRemoveUniverse(this.logger, async (data: string) => {
            await this.universeManager.RemoveUniverseAsync(data);
            sidePanelBroadcastProtocolClient.RemoveUniverse(this.logger, data);
        });

        // Handle requests to get the current layout configuration of universes in the side panel
        serviceWorkerProtocolRegistrar.OnGetUniverseSidePanelOptions(this.logger, (data: string) =>
            this.universeManager.GetUniverseSidePanelOptionsAsync(data)
        );

        // Handle requests to save the layout configuration of universes in the side panel and notify the side panel about the updated options
        serviceWorkerProtocolRegistrar.OnSaveUniverseSidePanelOptions(this.logger, async (data: { universeKey: string, options: UniverseSidePanelOptions }) => {
            await this.universeManager.SaveUniverseSidePanelOptionsAsync(data.universeKey, data.options);
            sidePanelBroadcastProtocolClient.UpdateUniverseSidePanelOptions(this.logger, data.universeKey, data.options);
        });

        // Handle toggling the visibility of the side panel, allowing the user to show or hide it
        serviceWorkerProtocolRegistrar.OnToggleSidePanel(this.logger, (_, sender) =>
            this.sidePanelManager.ToggleSidePanel(sender)
        );

        // Handle Handle request to reorganize the layout of universes in the side panel, allowing the user to customize the order and arrangement of universes
        serviceWorkerProtocolRegistrar.OnSaveUniverseLayout(this.logger, async (layout: UniverseLayoutConfig) => {
            const normalized = await this.universeManager.SetUniverseLayoutAsync(layout);
            sidePanelBroadcastProtocolClient.UpdateUniverseGrid(this.logger);
            return normalized;
        });

        // Handle requests to retrieve all flying fleet events for a specific universe, or for all universes if no specific universe key is provided
        serviceWorkerProtocolRegistrar.OnGetAllFlyingFleetEvents(this.logger, async (universeKey?: string) => {
            return await this.universeManager.GetAllFlyingFleetEventsAsync(universeKey);

        });

        // Handle requests to read the global (non-universe-specific) side panel options, ex: timeline visibility
        serviceWorkerProtocolRegistrar.OnGetSidePanelGlobalOptions(this.logger, async () => {
            return await this.saveManager.GetSidePanelGlobalOptionsAsync();
        });

        // Handle requests to save the global side panel options, and notify every open side panel so they take it into account immediately
        serviceWorkerProtocolRegistrar.OnSaveSidePanelGlobalOptions(this.logger, async (options: SidePanelGlobalOptions) => {
            await this.saveManager.SaveSidePanelGlobalOptionsAsync(options);
            sidePanelBroadcastProtocolClient.UpdateSidePanelGlobalOptions(this.logger, options);
        });
    }

    /**
     * Handles the extension installation or update event. When the extension is installed or updated, it triggers a rebuild of the open tabs state in the UniverseTabsManager.
     * @param details
     */
    private readonly OnExtensionInstallation = (details: { reason: string }): void => {
        if (details.reason === 'install' || details.reason === 'update') {
            void this.universeTabsManager.RebuildOpenTabsStateAsync();
        }
    };

    public async StartAsync(): Promise<void> {
        await browserInfo.InitAsync();
        Localizator.Init(browserInfo.Language);

        await this.universeManager.InitializeAsync();
        this.universeTabsManager.Start();
        this.sidePanelManager.Start();

        await this.contextMenusManager.RegisterContextMenusAsync();
        this.keyboardCommandsManager.RegisterKeyboardCommands();
        this.logger.info('OGame Multiverse ✅ Started.');
    }
}

const app = new ServiceWorkerContextApp();
app.StartAsync();