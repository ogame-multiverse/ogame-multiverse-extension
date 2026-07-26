import { Localizator } from '../../localization/localizator';
import browser from 'webextension-polyfill';
import { UniversePanelController } from './universePanelController';
import { sidePanelLoggerFactory } from '../../logging/loggerFactory';
import { sidePanelProtocolRegistrar } from '../../messaging/sidePanelProtocol';

class SidePanelContextApp {
  private windowId: number | undefined;
  private readonly logger = sidePanelLoggerFactory.CreateLogger('SidePanelContextApp');
  private readonly supportedLanguages = new Set(['en', 'fr', 'es', 'de', 'tr', 'br']);
  private readonly universePanelController = new UniversePanelController(sidePanelLoggerFactory.CreateLogger('UniversePanelController'));

  public async StartAsync(): Promise<void> {
    const currentWindow = await browser.windows.getCurrent();
    this.windowId = currentWindow.id;
    if (!this.windowId) {
      this.logger.error("Failed to retrieve the current window ID.");
      return;
    }

    this.RegisterSidePanelEvents();

    const language = this.ResolveLanguage();
    document.documentElement.lang = language;

    Localizator.Init(language);
    Localizator.ApplyAll(this.logger);

    this.InitializeTabs('tab-universe');
  }

  private RegisterSidePanelEvents(): void {
    const port = sidePanelProtocolRegistrar.OpenPort(this.logger, this.windowId);
    sidePanelProtocolRegistrar.OnClosePanel(() => { window.close(); });
    sidePanelProtocolRegistrar.Connect(this.logger, port);
  }

  private ResolveLanguage(): string {
    const browserLanguage = browser?.i18n?.getUILanguage?.() || navigator.language || 'en';
    const languageCode = browserLanguage.split('-')[0].toLowerCase();

    if (languageCode === 'pt') return 'br';
    if (this.supportedLanguages.has(languageCode)) return languageCode;
    return 'en';
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
