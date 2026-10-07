import browser from 'webextension-polyfill';
import { browserInfo } from '../../dom/browserInfos';
import { Localizator } from '../../localization/localizator';
import { Logger } from '../../logging/logger';
import { SidePanelManager } from './sidePanelManager';


export class ContextMenusManager {

  constructor(private readonly logger: Logger, private readonly sidePanelManager: SidePanelManager) { }

  public async RegisterContextMenusAsync(): Promise<void> {
    const contextMenus = browserInfo.IsFirefox ? browser.menus : browser.contextMenus;


    const commands = await browser.commands.getAll();
    const cmdName = browserInfo.IsFirefox ? "_execute_sidebar_action" : "toggle_side_panel";
    const actionCmd = commands.find(c => c.name === cmdName);
    const shortcutHint = actionCmd?.shortcut ? `  (${actionCmd.shortcut})` : "";
    const title = `${Localizator.Translate("ContextMenuToggleSidePanel")}${shortcutHint}`;

    this.logger.debug("Registering context menu items for OGame Multiverse extension");

    try {
      await contextMenus.remove("toggle_side_panel");
    }
    catch (error) {
      this.logger.debug("No existing context menu item to remove, proceeding to create a new one.");
    }

    try {
      await contextMenus.create({
        id: "toggle_side_panel",
        title: title,
        contexts: ["all"]
      })

      this.logger.debug("Adding click listener for context menu items");
      contextMenus.onClicked.addListener(async (info, tab) => {
        if (info.menuItemId !== "toggle_side_panel") return;
        this.sidePanelManager.ToggleSidePanel(tab.windowId);
      });

    }
    catch (error) {
      this.logger.error("Failed to create context menu item for OGame Multiverse extension", error);
    }



  }
}