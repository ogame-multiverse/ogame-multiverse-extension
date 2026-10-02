import Cookies from "js-cookie";

export class OgameCookies {
  public static PlayerLanguage: string = Cookies.get("oglocale") ?? "en";
}

