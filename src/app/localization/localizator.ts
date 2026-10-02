import { I18n } from "./I18n";
import { Localizations } from "./translations";
import { Logger } from '../logging/logger';

export class Localizator {
  private static currentLanguage: string | undefined;

  public static Init(lang: string): void {
    // Only initialize if the language is different from the current one and if the language is defined
    if (lang && Localizator.currentLanguage !== lang) {
      I18n.Init(lang, Localizations, ["oga-data-i18n"], ["oga-data-i18n-attr"]);
    }
  }

  // 🔧 Fix: Use native types and objects (Document / HTMLElement)
  public static ApplyAll(logger: Logger, root: HTMLElement | Document = document): void {
    I18n.ApplyAll(logger, root);
  }

  public static Translate(key: string, vars?: Record<string, string | number>): string {
    return I18n.Translate(key, vars);
  }
}