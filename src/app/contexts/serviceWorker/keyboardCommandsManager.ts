import browser from 'webextension-polyfill';
import { browserInfo } from '../../dom/browserInfos';
import { Logger } from '../../logging/logger';
import { SidePanelManager } from './sidePanelManager';


export class KeyboardCommandsManager {
  constructor(private readonly logger: Logger, private readonly sidePanelManager: SidePanelManager) { }


  public RegisterKeyboardCommands(): void {
    if (browserInfo.IsChrome) {
      // Register keyboard commands for Chrome: For Chrome, we can use the commands API to listen for keyboard shortcuts defined in the manifest.json file.
      this.logger.debug("Registering keyboard commands for OGame Multiverse extension");
      browser.commands.onCommand.addListener(async (command, tab) => {
        this.logger.debug(`Keyboard command received (${command})`);
        if (command === "toggle_side_panel") {
          this.sidePanelManager.ToggleSidePanel(tab.windowId);
        }
      });
    }
  }

}

