import { OgmContentContext } from './OgmContentContext';
import { OgameHeaderScanner } from './OgameHeaderScanner';

// Entry point for the content context. Initializes into an IFE to avoid polluting global scope. 
(() => {
  OgmContentContext.Instance.InitializeAsync().then(() => {
    const headerScanner = new OgameHeaderScanner(1000);
    headerScanner.Start();
  });
})();