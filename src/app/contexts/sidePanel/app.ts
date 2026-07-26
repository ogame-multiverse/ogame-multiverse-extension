import { Localizator } from '../../localization/localizator';
import browser from 'webextension-polyfill';
import { browserInfo } from '../../dom/browserInfos';
import { UniversePanelController } from './universePanelController';
import { sidePanelLoggerFactory } from '../../logging/loggerFactory';
import { sidePanelProtocolRegistrar } from '../../messaging/sidePanelProtocol';

class SidePanelContextApp {
  private windowId: number | undefined;
  private readonly logger = sidePanelLoggerFactory.CreateLogger('SidePanelContextApp');
  private readonly universePanelController = new UniversePanelController(sidePanelLoggerFactory.CreateLogger('UniversePanelController'));

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

    this.RegisterSidePanelEvents();

    document.documentElement.lang = browserInfo.Language;


    this.InitializeTabs('tab-universe');
  }

  private RegisterSidePanelEvents(): void {
    const port = sidePanelProtocolRegistrar.OpenPort(this.logger, this.windowId);
    sidePanelProtocolRegistrar.OnClosePanel(() => { window.close(); });
    sidePanelProtocolRegistrar.Connect(this.logger, port);
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

    const initialTab = tabs.find((tab) => tab.id === defaultTabId) || tabs.find((tab) => tab.getAttribute('aria-selected') === 'true');
    if (initialTab) activate(initialTab.id);
  }

}

new SidePanelContextApp().StartAsync();
