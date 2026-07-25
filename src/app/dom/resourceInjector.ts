import $ from 'jquery';
import browser from 'webextension-polyfill';
import { Logger } from '../logging/logger';
import { Localizator } from '../localization/localizator';

export enum InjectedResourceType {
  Script,
  Html,
}

export class ResourceInjector {
  constructor(private readonly logger: Logger) { }

  public async GetExtensionResourceUrlAsync(resourcePath: string): Promise<string> {
    return browser.runtime.getURL(resourcePath);
  }

  public async InjectExtensionScriptResourceAsync(scriptName: string): Promise<void> {
    try {
      const script = document.createElement('script');

      script.src = await this.GetExtensionResourceUrlAsync(scriptName);

      // Append the script to the document head or document element
      (document.head || document.documentElement).appendChild(script);
    } catch (e) {
      this.logger.error('Error injecting script resource:', e);
    }
  }

  public async InjectExtensionResourceAsync(
    resourceUrl: string,
    resourceType: InjectedResourceType,
    target?: string | JQuery<HTMLElement> | null,
    insertion: 'append' | 'prepend' = 'append'
  ): Promise<void> {
    if (resourceType === InjectedResourceType.Script) {
      await this.InjectExtensionScriptResourceAsync(resourceUrl);
    } else if (resourceType === InjectedResourceType.Html) {
      const extensionResourceUrl = await this.GetExtensionResourceUrlAsync(resourceUrl);
      const extensionResourceResponse = await fetch(extensionResourceUrl);
      const extensionResourceContent = await extensionResourceResponse.text();

      // Resolve target: accept a selector string, a jQuery object, or null/undefined
      let $insertion: JQuery<HTMLElement>;
      if (!target) {
        $insertion = $('body');
      } else if (typeof target === 'string') {
        $insertion = $(target);
      } else {
        $insertion = target;
      }

      if (insertion === 'prepend') {
        $insertion.prepend(extensionResourceContent);
      } else {
        $insertion.append(extensionResourceContent);
      }

      Localizator.ApplyAll($insertion);
    } else {
      throw new Error(`Unknown resource type: ${resourceType}`);
    }

    this.logger.info(`✅ [Content] inject resource: ${resourceUrl}`);
  }
}

