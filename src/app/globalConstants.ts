export class GlobalConstants {
  public static readonly APP_VERSION: string = '__VERSION__';
  public static readonly APP_NAME: string = 'OGame Multiverse';
  public static readonly APP_DB_NAME: string = 'OGameMultiverse';

  /* Pattern to match OGame game URLs, e.g. https://s123-en.ogame.gameforge.com/game/index.php?page=ingame */
  public static readonly OGAME_URL_GAME_PATTERN: string = 'https://*.ogame.gameforge.com/game/*';

  /* Base domain for OGame universes. */
  public static readonly OGAME_DOMAIN: string = 'ogame.gameforge.com';

  /* Regular expressions to identify tabs that should trigger sync when active. */
  public static readonly SYNC_TABS_URLS_REGEXPS: RegExp[] = [    
   /^https:\/\/[^/]+\.ogame\.gameforge\.com\/game\//i, // OGame game pages
  ];
}
