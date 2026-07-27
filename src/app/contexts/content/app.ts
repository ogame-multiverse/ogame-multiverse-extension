import { LocalizationStrings } from '../../../types/LocalizationStrings';
import { browserInfo } from '../../dom/browserInfos';
import { ResourceInjector } from '../../dom/resourceInjector';
import { Localizator } from '../../localization/localizator';
import { contentScriptLoggerFactory } from '../../logging/loggerFactory';
import { contentProtocolRegistrar } from '../../messaging/contentProtocol';
import { OgameQueriesOptions } from '../../messaging/data/ogameQueriesOptions';
import { serviceWorkerProtocolClient } from '../../messaging/serviceWorkerProtocol';
import { OgameCookies } from '../../ogameCookies';
import { UniverseDataNormalizer } from '../../universeDataNormalizer';
import { OgameDomParser } from '../../dom/ogameDom/ogameDomParser';
import { OgameEventsScanner } from './ogameEventsScanner';
import { OgmWindowUtils } from './ogmWindowUtils';
import { SidebarManager } from './sidebarManager';


// Entry point for the content context. Initializes into an IFE to avoid polluting global scope. 
(async () => {
  const logger = contentScriptLoggerFactory.CreateLogger("ContentContextApp");
  const universeKey = UniverseDataNormalizer.NormalizeUniverseKey(OgmWindowUtils.UNIVERSE_KEY);

  const resourceInjector = new ResourceInjector();
  const sidebarManager = new SidebarManager(resourceInjector)


  /* LOCALIZATION */

  // Fetch the localization data from the service worker storage for the current universe key. This includes the language and localization strings.
  let localizationData = await serviceWorkerProtocolClient.GetLocalizationDataAsync(logger, universeKey);

  // Initialize localization based on the language stored in the service worker, or fallback to the language stored in the OGame cookies if not available.
  Localizator.Init(localizationData.Language ?? OgameCookies.PlayerLanguage);

  /* STARTUP (AFTER PAGE CONTEXT STARTED) */

  // Initialize the OGame DOM data analyzer with the fetched localization data.
  const ogameDomParser = new OgameDomParser(localizationData);
  const ogameEventsScanner = new OgameEventsScanner(ogameDomParser);

  // Register a callback to be executed when the page context has started. This is where we handle universe registration, localization updates, and OGame queries.
  contentProtocolRegistrar.OnPageContextStarted(logger, async (data: { universeName: string, universeDomain: string, language: string, localizationStrings: LocalizationStrings }) => {
    //Dom ready has already happened


    // Register the universe in the service worker storage with the universe key, domain, and current timestamp.
    await serviceWorkerProtocolClient.RegisterUniverseAsync(logger, universeKey, data.universeName, data.universeDomain, Date.now());

    const queryOptions = OgameQueriesOptions.AccountAndLifeformBonusesAllowed()
    const languageChanged = localizationData.Language !== data.language;

    if (languageChanged) {
      // If the language has changed, we need to force a fetch of lifeform bonuses for the new language.
      queryOptions.ForceLifeformBonusesFetch = true;

      // Update the localization data with the new language and localization strings received from the page context.
      localizationData.Language = data.language;
      localizationData.LocalizationStrings = data.localizationStrings;

      // Save the new localization strings to the service worker storage and run OGame queries to fetch lifeform bonuses for the new language.
      await serviceWorkerProtocolClient.SaveLocalizationStringsAsync(logger, universeKey, data.language, data.localizationStrings);



      // Reinitialize the Localizator with the new language.
      Localizator.Init(localizationData.Language);
    }

    // Run OGame queries to fetch account info and lifeform bonuses, forcing a fetch of lifeform bonuses if the language has changed.
    await serviceWorkerProtocolClient.RunOgameQueries(logger, universeKey, data.universeDomain, queryOptions);

    // If the language has changed, fetch the updated localization data from the service worker storage.
    if (languageChanged) {
      const storedLocalizationData = await serviceWorkerProtocolClient.GetLocalizationDataAsync(logger, universeKey);
      localizationData.Language = storedLocalizationData.Language;
      localizationData.LocalizationStrings = storedLocalizationData.LocalizationStrings;
      localizationData.TechsLocalizations = storedLocalizationData.TechsLocalizations;
    }


    // Analyze the OGame DOM data to extract relevant information for the extension.
    ogameDomParser.AnalyzeDom(logger);

    if (ogameDomParser.Data) {
      await serviceWorkerProtocolClient.ApplyDomDataAsync(logger, universeKey, ogameDomParser.Data);
    }


    // Start scanning for OGame events in the page context.
    await ogameEventsScanner.StartAsync(logger);

  });


  /* STARTUP (BEFORE DOM READY) */

  // Initialize the content context by injecting the extension script into the page context and initializing browser info.
  await Promise.all([browserInfo.InitAsync(), resourceInjector.InjectExtensionScriptResourceAsync(logger, 'app.page.js')]);

  // Render the sidebar in the page context.
  await sidebarManager.RenderSidebarAsync(logger);

})();