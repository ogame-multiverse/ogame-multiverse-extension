export class OgmWindowUtils {
  public static readonly DOMAIN = window.location.hostname;
  public static readonly UNIVERSE_KEY = window.location.host.split(".")[0];
  public static readonly URL = new URL(window.location.href);
  public static readonly PAGE =
    this.URL.searchParams.get("component") ?? this.URL.searchParams.get("page") ?? undefined;
}