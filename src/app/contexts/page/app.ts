/// <reference path="../../../types/LocalizationStrings.d.ts" />
import $ from 'jquery';
import { pageLoggerFactory } from '../../logging/loggerFactory';
import { contentProtocolClient } from '../../messaging/contentProtocol';
import { OgameMetadatas } from '../../dom/ogameDom/ogameMetadatas';


const logger = pageLoggerFactory.CreateLogger('App');


$(async () => {
  logger.info('Page context fully started.');
  const universeName = OgameMetadatas.UniverseName();
  const universeDomain = OgameMetadatas.UniverseDomain();
  const language = OgameMetadatas.UILanguage();
  logger.debug('Sending PageContextStarted message to content script with localization strings.', { universeName, universeDomain, language, LocalizationStrings });
  contentProtocolClient.PageContextStarted(logger, universeName, universeDomain, language, LocalizationStrings);
});
