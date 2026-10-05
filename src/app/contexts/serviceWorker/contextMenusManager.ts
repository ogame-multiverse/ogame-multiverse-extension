import browser from 'webextension-polyfill';
import { Localizator } from '../../localization/localizator';
import { Logger } from '../../logging/logger';
import { SidePanelManager } from './sidePanelManager';

const TOGGLE_SIDE_PANEL_MENU_ID = "toggle_side_panel";

export class ContextMenusManager {

    constructor(private readonly logger: Logger, private readonly sidePanelManager: SidePanelManager) { }

    private get ContextMenusApi(): typeof browser.contextMenus {
        return ((browser as any).menus ?? browser.contextMenus) as typeof browser.contextMenus;
    }

    public RegisterClickListener(): void {
        const contextMenus = this.ContextMenusApi;
        if (!contextMenus?.onClicked) return;

        contextMenus.onClicked.addListener((info, tab) => {
            if (info.menuItemId !== TOGGLE_SIDE_PANEL_MENU_ID) return;
            if (tab?.windowId === undefined) {
                this.logger.error("Context menu click received without a windowId");
                return;
            }
            this.sidePanelManager.ToggleSidePanel(tab.windowId);
        });
    }

    public async CreateContextMenusAsync(): Promise<void> {
        const contextMenus = this.ContextMenusApi;
        if (!contextMenus) return;

        const commands = await browser.commands.getAll();
        const cmdName = this.sidePanelManager.IsSidebarActionBrowser ? "_execute_sidebar_action" : "toggle_side_panel";
        const actionCmd = commands.find(c => c.name === cmdName);
        const shortcutHint = actionCmd?.shortcut ? `  (${actionCmd.shortcut})` : "";
        const title = `${Localizator.Translate("ContextMenuToggleSidePanel")}${shortcutHint}`;

        this.logger.debug("Registering context menu items for OGame Multiverse extension");

        try {
            await contextMenus.remove(TOGGLE_SIDE_PANEL_MENU_ID);
        }
        catch (error) {
            this.logger.debug("No existing context menu item to remove, proceeding to create a new one.");
        }

        try {
            await contextMenus.create({
                id: TOGGLE_SIDE_PANEL_MENU_ID,
                title: title,
                contexts: ["all"]
            });
        }
        catch (error) {
            this.logger.error("Failed to create context menu item for OGame Multiverse extension", error);
        }
    }
}