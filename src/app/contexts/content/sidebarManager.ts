import $ from 'jquery';
import { Logger } from '../../logging/logger';
import { serviceWorkerProtocolClient } from '../../messaging/serviceWorkerProtocol';

import { ResourceInjector, InjectedResourceType } from '../../dom/resourceInjector';

export class SidebarManager {

  private readonly resourceInjector: ResourceInjector;  constructor(private readonly logger: Logger) {
    this.resourceInjector = new ResourceInjector(this.logger);
  }


  public async RenderSidebarAsync(): Promise<void> {
    await this.resourceInjector.InjectExtensionResourceAsync('views/sidebars.html', InjectedResourceType.Html);


    $('.ogm-sidebar .ogm-sidebar-header .ogm-sidebar-header-button').off('click').on('click', (e) => {
      e.preventDefault();
      serviceWorkerProtocolClient.OpenSidePanel(this.logger);
    });
  }

}

