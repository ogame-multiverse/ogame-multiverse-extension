import browser from 'webextension-polyfill';
import { browserInfo } from '../../dom/browserInfos';
import { Localizator } from '../../localization/localizator';
import { Logger } from '../../logging/logger';
import { SidePanelManager } from './sidePanelManager';
export class ContextMenusManager {

  constructor(private readonly logger: Logger, private readonly sidePanelManager: SidePanelManager) { }

  public RegisterContextMenus(): void {
    const contextMenus = browserInfo.IsFirefox ? browser.menus : browser.contextMenus;
    this.logger.debug("Registering context menu items for OGame Multiverse extension");
    contextMenus.create({
      id: "open-ogame-sidebar",
      title: Localizator.Translate("ContextMenuOpenSidePanel"),
      contexts: ["all"]
    })

    this.logger.debug("Adding click listener for context menu items");
    contextMenus.onClicked.addListener(async (info, tab) => {
      if (info.menuItemId !== "open-ogame-sidebar") return;
      this.sidePanelManager.OpenSidePanel(tab.windowId);
    });
  }
}