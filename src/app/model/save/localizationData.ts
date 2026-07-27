import { LocalizationStrings } from '../../../types/LocalizationStrings';

export class LocalizationData {
  public Language: string | undefined;
  public LocalizationStrings: LocalizationStrings;
  public TechsLocalizations: Record<number, string> | undefined;
  constructor(data: Partial<LocalizationData>) {
    this.Language = data.Language;
    this.LocalizationStrings = data.LocalizationStrings ?? ({} as LocalizationStrings);
    this.TechsLocalizations = data.TechsLocalizations;
  }
  public static GetTechIdFromName(name: string | undefined, techsLocalizations: Record<number, string> | undefined): number | undefined {
    if (!name || !techsLocalizations) return undefined;
    for (const [idStr, localizedName] of Object.entries(techsLocalizations)) {
      if (localizedName === name) return Number(idStr);
    }
    return undefined;
  }
}

