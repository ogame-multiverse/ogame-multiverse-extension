import { Localizator } from '../shared/localization/localizator';
import { SidePanelSafeMessaging } from './sidePanelSafeMessaging';
import { UniversePanelController } from './universePanelController';

class SidePanelContextApp {
  private readonly supportedLanguages = new Set(['en', 'fr', 'es', 'de', 'tr', 'br']);
  private readonly messaging = new SidePanelSafeMessaging(this.HandleContextInvalidated.bind(this));
  private readonly universePanelController = new UniversePanelController(this.messaging);

  public Start(): void {
    const language = this.ResolveLanguage();
    document.documentElement.lang = language;

    Localizator.Init(language);
    Localizator.ApplyAll();

    this.InitializeTabs('tab-universe');
  }

  private ResolveLanguage(): string {
    const chromeApi = (globalThis as { chrome?: { i18n?: { getUILanguage?: () => string } } }).chrome;
    const browserLanguage = chromeApi?.i18n?.getUILanguage?.() || navigator.language || 'en';
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

  private HandleContextInvalidated(): void {
    this.universePanelController.StopSync();
    window.setTimeout(() => {
      window.location.reload();
    }, 50);
  }
}

new SidePanelContextApp().Start();
