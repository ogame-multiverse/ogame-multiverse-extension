import { Localizator } from '../../localization/localizator';
import browser from 'webextension-polyfill';
import { browserInfo } from '../../dom/browserInfos';
import { UniversePanelController } from './universePanelController';
import { sidePanelLoggerFactory } from '../../logging/loggerFactory';
import { sidePanelProtocolRegistrar } from '../../messaging/sidePanelProtocol';
import { GlobalConstants } from '../../globalConstants';

class SidePanelContextApp {
  private windowId: number | undefined;
  private activePort: browser.Runtime.Port | null = null;
  private reconnectTimeoutId: number | undefined;
  private pingIntervalId: number | undefined;

  private readonly logger = sidePanelLoggerFactory.CreateLogger('SidePanelContextApp');
  private readonly universePanelController = new UniversePanelController(
    sidePanelLoggerFactory.CreateLogger('UniversePanelController')
  );

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

    document.documentElement.lang = browserInfo.Language;

    this.InitializeSidePanelProtocol();
    this.InitializeTabs('tab-universe');
  }

  private InitializeSidePanelProtocol(): void {
    // Register the port connection and disconnection events
    sidePanelProtocolRegistrar.OnClosePanel(() => {
      window.close();
    });

    this.ConnectPort();
  }

  private ConnectPort(): void {
    if (!this.windowId) return;

    // Cleanup any existing reconnection timeout
    if (this.reconnectTimeoutId !== undefined) {
      window.clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = undefined;
    }

    // Cleanup any existing ping interval
    if (this.pingIntervalId !== undefined) {
      window.clearInterval(this.pingIntervalId);
      this.pingIntervalId = undefined;
    }

    // Disconnect the existing port safely without triggering onDisconnect
    if (this.activePort) {
      const oldPort = this.activePort;
      this.activePort = null;
      try {
        oldPort.disconnect();
      } catch {
        // Ignore any errors during disconnection
      }
    }

    // Open a new port and connect it
    this.logger.debug(`Opening side panel port for windowId ${this.windowId}`);
    const newPort = sidePanelProtocolRegistrar.OpenPort(this.logger, this.windowId);
    this.activePort = newPort;

    sidePanelProtocolRegistrar.Connect(this.logger, newPort);

    // 🔄 Ping Keep-Alive toutes les 20s pour éviter la coupure Chrome au bout de 30s
    this.pingIntervalId = window.setInterval(() => {
      if (this.activePort === newPort) {
        try {
          newPort.postMessage({ type: 'PING' });
        } catch {
          // Ignorer si le port s'est fermé
        }
      }
    }, GlobalConstants.SIDE_PANEL_PING_SERVICE_WORKER_INTERVAL_MS);

    // Handle port disconnection and attempt to reconnect after a delay
    newPort.onDisconnect.addListener(() => {
      // Ignorer si le port a déjà été nettoyé ou remplacé
      if (this.activePort !== newPort) return;

      this.logger.warn("Side panel port disconnected. Attempting to reconnect...");
      this.activePort = null;

      if (this.pingIntervalId !== undefined) {
        window.clearInterval(this.pingIntervalId);
        this.pingIntervalId = undefined;
      }

      this.reconnectTimeoutId = window.setTimeout(() => {
        this.ConnectPort();
        // Refresh the universe panel after reconnection
        this.universePanelController.Refresh();
      }, 1000);
    });
  }

  private InitializeTabs(defaultTabId: string): void {
    const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>('.tab'));
    const panels = Array.from(document.querySelectorAll<HTMLElement>('.panel'));

    const activate = (tabId: string): void => {
      tabs.forEach((tab) => {
        const active = tab.id === tabId;
        tab.setAttribute('aria-selected', String(active));
      });

      panels.forEach((panel) => {
        const active = panel.getAttribute('aria-labelledby') === tabId;
        panel.dataset.active = active ? 'true' : 'false';
      });

      if (tabId === 'tab-universe') {
        this.universePanelController.Activate();
      } else {
        this.universePanelController.Deactivate();
      }
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