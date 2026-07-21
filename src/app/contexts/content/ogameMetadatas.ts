export class OgameMetadatas {
  private static GetMetaValue(key: string): string | undefined {
    return document.querySelector(`meta[name="${key}"]`)?.getAttribute('content') ?? undefined;
  }

  private static _UniverseName: string | undefined;
  public static UniverseName(): string {
    if (this._UniverseName === undefined) {
      this._UniverseName = OgameMetadatas.GetMetaValue('ogame-universe-name');
    }
    return this._UniverseName ?? '';
  }
}
