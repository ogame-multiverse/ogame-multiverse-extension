import { Logger } from "../logging/logger";
export class I18nValue {
  public code: string;
  public values: Record<string, string>;
  constructor(code: string, values: Record<string, string>) {
    this.code = code;
    this.values = values;
  }
}

export class I18n {
  private static translationBundles: Record<string, Record<string, string>> = {};
  private static lang = "en";
  private static textAttrNames: string[] = ["data-i18n"];
  private static attrAttrNames: string[] = ["data-i18n-attr"];

  /**
   * Initialize i18n: set language, load translations, and apply to DOM.
   */
  public static Init(
    lang = "en",
    translations: I18nValue[],
    textAttrNames: string[] = ["data-i18n"],
    attrAttrNames: string[] = ["data-i18n-attr"]
  ): void {
    this.lang = lang;
    this.textAttrNames = textAttrNames;
    this.attrAttrNames = attrAttrNames;

    translations.forEach(({ code, values }) => {
      Object.keys(values).forEach((langKey) => {
        if (!this.translationBundles[langKey]) {
          this.translationBundles[langKey] = {};
        }
        this.translationBundles[langKey][code] = values[langKey];
      });
    });
  }

  /**
   * Get translated string for a key. If missing, returns the key.
   * Supports simple interpolation via {{var}}.
   */
  public static Translate(key: string, vars?: Record<string, string | number>): string {
    const translations = this.translationBundles[this.lang] || {};
    let value = translations[key] ?? key; // Fallback to the key if translation is missing

    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        value = value.replace(new RegExp(`{{\\s*${k}\\s*}}`, "g"), String(v));
      });
    }
    return value;
  }

  /**
     * Apply translations to DOM under root (default document).
     * - textAttrNames: replace innerHTML with translated text
     * - attrAttrNames: replace attributes using spec "attr:Key;attr2:OtherKey"
     */
  public static ApplyAll(logger: Logger, root: HTMLElement | Document = document): void {
    // Vérifier que Init a été appelé
    if (!this.textAttrNames || !this.attrAttrNames) {
      logger.warn("I18n.Init() must be called before ApplyAll()");
      return;
    }

    // text nodes
    const textSelector = this.textAttrNames.map((n) => `[${n}]`).join(",");
    root.querySelectorAll<HTMLElement>(textSelector).forEach((el) => {
      let attrName = "";

      I18n.textAttrNames.some((name) => {
        if (el.hasAttribute(name)) {
          attrName = name;
          return true; // break
        }
        return false;
      });

      const key = el.getAttribute(attrName) || "";
      if (!key) return;
      el.innerHTML = I18n.Translate(key);
    });

    // attributes
    const attrSelector = this.attrAttrNames.map((n) => `[${n}]`).join(",");
    root.querySelectorAll<HTMLElement>(attrSelector).forEach((el) => {
      let attrName = "";

      I18n.attrAttrNames.some((name) => {
        if (el.hasAttribute(name)) {
          attrName = name;
          return true; // break
        }
        return false;
      });

      const spec = el.getAttribute(attrName) || "";
      spec.split(";").forEach((pair) => {
        const trimmedPair = pair.trim();
        if (!trimmedPair) return;

        const parts = trimmedPair.split(":");
        if (parts.length !== 2) return;

        const attr = parts[0].trim();
        const key = parts[1].trim();
        if (!attr || !key) return;

        el.setAttribute(attr, I18n.Translate(key));
      });
    });
  }
}