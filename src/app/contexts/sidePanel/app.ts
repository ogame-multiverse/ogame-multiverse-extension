import browser from 'webextension-polyfill';
import { Debouncer } from '../../async/debouncer';
import { browserInfo } from '../../dom/browserInfos';
import { Localizator } from '../../localization/localizator';
import { sidePanelLoggerFactory } from '../../logging/loggerFactory';
import { sidePanelBroadcastProtocolRegistrar } from '../../messaging/sidePanelBroadcastProtocol';
import { FlyingFleetEvent } from '../../model/flyingFleetEvent';
import { SidePanelUniverseCounters } from '../../model/sidePanel/sidePanelUniverseCounters';
import { UniverseSidePanelOptions } from '../../model/sidePanel/universeSidePanelOptions';
import { EventsPanelController } from './eventsPanelController';
import { LocalWindowTabsTracker } from './localWindowTabsTracker';
import { TabRelatedController } from './tabRelatedController';
import { UniversePanelController } from './universePanelController';

class SidePanelContextApp {
    private windowId: number | undefined;

    private readonly logger = sidePanelLoggerFactory.CreateLogger('SidePanelContextApp');
    private readonly localWindowTabsTracker = new LocalWindowTabsTracker(this.logger);
    private readonly universePanelController = new UniversePanelController(this.logger, this.localWindowTabsTracker);
    private readonly eventsPanelController = new EventsPanelController(this.logger, this.localWindowTabsTracker);

    private readonly RefreshGlobalWarning = Debouncer.Debounce(() => {
        void TabRelatedController.RefreshGlobalWarningAsync(this.logger);
    }, 300);

    public async StartAsync(): Promise<void> {
        await browserInfo.InitAsync();
        Localizator.Init(browserInfo.Language);
        Localizator.ApplyAll(this.logger);

        const currentWindow = await browser.windows.getCurrent();
        this.windowId = currentWindow.id;

        if (!this.windowId) {
            this.logger.error("Failed to retrieve the current window ID.");
            return;
        }

        this.ConnectPresencePort();

        document.documentElement.lang = browserInfo.Language;

        await this.localWindowTabsTracker.RefreshAsync();

        this.universePanelController.Initialize();
        await this.eventsPanelController.InitializeAsync();

        // The service worker broadcasts to every open side panel: only close if the request targets our window
        sidePanelBroadcastProtocolRegistrar.OnClosePanel(this.logger, (data: { windowId: number }) => {
            if (data.windowId === this.windowId) window.close();
        });

        sidePanelBroadcastProtocolRegistrar.OnRegisterUniverse(this.logger, () => {
            TabRelatedController.InvalidateSharedCaches();
            this.universePanelController.Refresh();
            void this.eventsPanelController.RefreshUniverseStatusesAndWarningsAsync();
            this.RefreshGlobalWarning();
        });
        sidePanelBroadcastProtocolRegistrar.OnRemoveUniverse(this.logger, (universeKey: string) => {
            TabRelatedController.InvalidateSharedCaches();
            this.universePanelController.RemoveSingleUniverse(universeKey);
            this.RefreshGlobalWarning();
        });
        sidePanelBroadcastProtocolRegistrar.OnUpdateUniverseStatus(
            this.logger,
            (data: { universeKey: string; universeCounters: SidePanelUniverseCounters; isOpen: boolean; flyingFleetEvents: FlyingFleetEvent[] }) => {
                this.universePanelController.UpdateSingleUniverseStatus(data);
                this.eventsPanelController.UpdateSingleUniverseFleetEvents(data.universeKey, data.flyingFleetEvents);
            }
        );

        sidePanelBroadcastProtocolRegistrar.OnUpdateUniverseOpenState(this.logger, (data: { universeKey: string; isOpen: boolean }) => {
            this.universePanelController.UpdateUniverseOpenState(data.universeKey, data.isOpen);
            this.localWindowTabsTracker.NotifyExternalChange();
        });

        sidePanelBroadcastProtocolRegistrar.OnUpdateUniverseSidePanelOptions(
            this.logger,
            (data: { universeKey: string; options: UniverseSidePanelOptions }) => {
                TabRelatedController.InvalidateSharedCaches();
                this.universePanelController.UpdateSingleUniverseOptions(data.universeKey, data.options);
                this.eventsPanelController.UpdateSingleUniverseOptions(data.universeKey, data.options);
                this.RefreshGlobalWarning();
            }
        );

        sidePanelBroadcastProtocolRegistrar.OnUpdateSidePanelGlobalOptions(this.logger, (options) => {
            this.eventsPanelController.OnSidePanelGlobalOptionsUpdated(options);
        });

        sidePanelBroadcastProtocolRegistrar.OnUpdateUniverseGrid(this.logger, () => {
            this.universePanelController.Refresh();
        });

        this.WatchUniverseRefreshWarning();

        this.InitializeTabs('tab-universe');
    }

    /** Keeps the presence port alive: the service worker can be terminated at any time, which closes the port
     *  without closing this panel. Reconnecting lets the new service worker instance know this window is open. */
    private ConnectPresencePort(): void {
        try {
            const port = browser.runtime.connect({ name: 'ogm-sidepanel-presence' });
            port.postMessage({ type: 'SIDEPANEL_INIT', windowId: this.windowId });
            port.onDisconnect.addListener(() => {
                window.setTimeout(() => this.ConnectPresencePort(), 1000);
            });
        } catch (error) {
            this.logger.error('Failed to connect the side panel presence port', error);
        }
    }

    /** Shows a red "priority_high" icon on the universe tab whenever at least one universe
     *  needs a refresh. State is computed from data (TabRelatedController.RefreshGlobalWarningAsync),
     *  independently of the active tab or DOM content. */
    private WatchUniverseRefreshWarning(): void {
        const universeTab = document.getElementById('tab-universe');
        if (!universeTab) return;

        TabRelatedController.OnGlobalRefreshWarningChanged((hasWarning) => {
            universeTab.classList.toggle('has-refresh-warning', hasWarning);
        });

        this.RefreshGlobalWarning();
        window.setInterval(() => TabRelatedController.RecomputeGlobalWarningFromCache(), 10_000);
    }

    private InitializeTabs(defaultTabId: string): void {
        const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>('.tab'));
        const panels = Array.from(document.querySelectorAll<HTMLElement>('.panel'));

        const activate = (tabId: string): void => {
            tabs.forEach((tab) => tab.setAttribute('aria-selected', String(tab.id === tabId)));
            panels.forEach((panel) => panel.dataset.active = String(panel.getAttribute('aria-labelledby') === tabId));
        };

        tabs.forEach((tab) => {
            tab.addEventListener('click', () => activate(tab.id));
        });

        const initialTab =
            tabs.find((tab) => tab.id === defaultTabId) ||
            tabs.find((tab) => tab.getAttribute('aria-selected') === 'true');

        if (initialTab) activate(initialTab.id);
    }
}

new SidePanelContextApp().StartAsync();