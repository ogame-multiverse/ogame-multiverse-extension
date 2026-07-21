export class SidePanelManager {
  public Start(): void {
    try {
      const chromeApi = (globalThis as { chrome?: any }).chrome;
      if (!chromeApi?.sidePanel) return;

      if (typeof chromeApi.sidePanel.setPanelBehavior === 'function') {
        void chromeApi.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error: unknown) => console.debug('setPanelBehavior failed', error));
      }
    } catch (error) {
      console.debug('SidePanelManager.Start failed', error);
    }
  }
}
