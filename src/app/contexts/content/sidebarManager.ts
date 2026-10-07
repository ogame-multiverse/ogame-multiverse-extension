import $ from 'jquery';
import { browserInfo } from '../../dom/browserInfos';
import { InjectedResourceType, ResourceInjector } from '../../dom/resourceInjector';
import { Logger } from '../../logging/logger';
import { serviceWorkerProtocolClient } from '../../messaging/serviceWorkerProtocol';

export class SidebarManager {

  private readonly resourceInjector: ResourceInjector;
  constructor(private readonly logger: Logger) {
    this.resourceInjector = new ResourceInjector(this.logger);
  }


  public async RenderSidebarAsync(): Promise<void> {

    /* 
     * Firefox don't allow to open the sidebar from content script, so we don't inject the sidebar HTML in Firefox.
     * It's a shitty browser behavior (as always with Firefox), but we have to deal with it.
     */
    if (browserInfo.IsChrome) {
      await this.resourceInjector.InjectExtensionResourceAsync('views/sidebars.html', InjectedResourceType.Html);
      $('.ogm-sidebar .ogm-sidebar-header .ogm-sidebar-header-button').off('click').on('click', (e) => {
        e.preventDefault();
        serviceWorkerProtocolClient.ToggleSidePanel(this.logger);
      });
    }
  }
}

