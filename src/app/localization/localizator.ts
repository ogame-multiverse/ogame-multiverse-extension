import { I18n } from "./I18n";
import { Localizations } from "./translations";

export class Localizator {
  public static Init(lang: string): void {
    I18n.Init(lang, Localizations, ["oga-data-i18n"], ["oga-data-i18n-attr"]);
  }

  // 🔧 Correction : Utilisation des types et objets natifs (Document / HTMLElement)
  public static ApplyAll(root: HTMLElement | Document = document): void {
    I18n.ApplyAll(root);
  }

  public static Translate(key: string, vars?: Record<string, string | number>): string {
    return I18n.Translate(key, vars);
  }
}