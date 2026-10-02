export class OgmWindowUtils {
  public static readonly UNIVERSE_KEY = (window.location.host || "").split(".")[0];

  // Ultra-fast access with no instantiation and no DOM dependency
  public static readonly SEARCH_PARAMS = new URLSearchParams(window.location.search);

  public static readonly PAGE =
    this.SEARCH_PARAMS.get("component") ??
    this.SEARCH_PARAMS.get("page") ??
    undefined;
}