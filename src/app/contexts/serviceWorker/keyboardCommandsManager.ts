import browser from 'webextension-polyfill';
import { Logger } from '../../logging/logger';
import { SidePanelManager } from './sidePanelManager';


export class KeyboardCommandsManager {
    constructor(private readonly logger: Logger, private readonly sidePanelManager: SidePanelManager) { }


    public RegisterKeyboardCommands(): void {
        if (this.sidePanelManager.IsSidebarActionBrowser) return;
        if (!browser?.commands?.onCommand) return;

        this.logger.debug("Registering keyboard commands for OGame Multiverse extension");
        browser.commands.onCommand.addListener((command, tab) => {
            this.logger.debug(`Keyboard command received (${command})`);
            if (command !== "toggle_side_panel") return;
            if (tab?.windowId === undefined) {
                this.logger.error("Keyboard command received without a windowId");
                return;
            }
            this.sidePanelManager.ToggleSidePanel(tab.windowId);
        });
    }

}