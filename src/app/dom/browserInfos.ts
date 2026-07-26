import browser from 'webextension-polyfill';


const supportedLanguages = new Set(['en', 'fr', 'es', 'de', 'tr', 'br']);
class BrowserInfo {
  public IsFirefox = false;
  public IsChrome = false;
  public Language = 'en';

  public async InitAsync(): Promise<void> {

    // try to detect the browser type using the getBrowserInfo API (available in Firefox)
    if (typeof browser.runtime.getBrowserInfo === 'function') {
      const info = await browser.runtime.getBrowserInfo();
      this.IsFirefox = info.name === 'Firefox';
    }
    // fallback to checking for the sidebarAction API (available in Firefox) or the user agent string
    else {
      this.IsFirefox = typeof (browser as any).sidebarAction !== 'undefined'
        || navigator.userAgent.includes('Firefox');
    }

    this.IsChrome = !this.IsFirefox;

    this.Language = this.ResolveLanguage();
  }

  private ResolveLanguage(): string {
    const browserLanguage = browser?.i18n?.getUILanguage?.() || navigator.language || 'en';
    const languageCode = browserLanguage.split('-')[0].toLowerCase();

    if (languageCode === 'pt') return 'br';
    if (supportedLanguages.has(languageCode)) return languageCode;
    return 'en';
  }
}

export const browserInfo = new BrowserInfo();