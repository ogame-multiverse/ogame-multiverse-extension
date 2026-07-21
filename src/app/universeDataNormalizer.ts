export class UniverseDataNormalizer {
  public static ToUniverseDisplayName(universeKey: string): string {
    const normalized = (universeKey || '').trim();
    const match = /^s(\d+)-([a-z]{2,3})$/i.exec(normalized);
    if (!match) return normalized;

    const serverNumber = match[1];
    const language = match[2].toUpperCase();
    return `S${serverNumber} (${language})`;
  }


  public static NormalizeUniverseKey(universeKey: string | undefined): string {
    return (universeKey || '').trim().toLowerCase();
  }
}