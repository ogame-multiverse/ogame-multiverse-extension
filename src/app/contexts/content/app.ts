import $ from 'jquery';
import { OgameHeaderScanner } from './ogameHeaderScanner';
import { OgmContentContext } from './ogmContentContext';
import { contentScriptLoggerFactory } from '../../logging/loggerFactory'

// Entry point for the content context. Initializes into an IFE to avoid polluting global scope. 
(() => {
  OgmContentContext.Instance.InitializeAsync().then(() => {
    $(() => {
      const headerScanner = new OgameHeaderScanner(contentScriptLoggerFactory.CreateLogger("OgameHeaderScanner"));
      headerScanner.StartAsync();



    });
  });
})();