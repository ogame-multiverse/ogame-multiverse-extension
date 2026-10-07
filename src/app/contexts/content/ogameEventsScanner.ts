import $ from 'jquery';
import { Debouncer } from '../../async/debouncer';
import { DomDelayer } from '../../async/domDelayer';
import { Observer } from '../../dom/observer';
import { Logger } from '../../logging/logger';
import { serviceWorkerProtocolClient } from '../../messaging/serviceWorkerProtocol';
import { SidePanelUniverseCounters } from "../../model/sidePanel/sidePanelUniverseCounters";
import { UniverseDataNormalizer } from '../../universeDataNormalizer';
import { OgameMetadatas } from './ogameMetadatas';
import { OgmWindowUtils } from './ogmWindowUtils';
import { tolerationRules } from './tolerationRules';

export class OgameEventsScanner {
  private observer: MutationObserver | undefined;
  private readonly watchedSelectors = ['#newmessagesindicatorcomponent', '#eventboxFilled'];

  constructor(private readonly logger: Logger) { }

  public async StartAsync(): Promise<void> {
    // Clean up any previous event listeners to avoid duplicates
    $(document).off('visibilitychange.OgameHeaderScanner');

    // Listen for visibility changes to start/stop observation and sync counters when the tab becomes visible
    $(document).on('visibilitychange.OgameHeaderScanner', async () => {
      if (tolerationRules.EventsMonitoringIsEnabledForCurrentTab()) {
        this.logger.debug("Tab became visible, syncing asnd starting observation...");
        await this.Sync();
        await this.StartObservingAsync();
      } else {
        this.logger.debug("Tab became hidden, stopping observation.");
        this.StopObserving();
      }
    });

    //Initial sync and observation if the tab is already visible
    if (tolerationRules.EventsMonitoringIsEnabledForCurrentTab()) {
      await this.StartObservingAsync();
      this.Sync();
    }
  }

  public Stop(): void {
    $(document).off('visibilitychange.OgameHeaderScanner');
    this.StopObserving();
  }

  private async StartObservingAsync(): Promise<void> {
    if (this.observer) return; // Already observing

    try {
      await DomDelayer.WaitForAllQuerySelectors(this.watchedSelectors, 50, AbortSignal.timeout(5000));

      // Vérification de sécurité si le tab s'est masqué pendant l'attente du DOM
      if (!tolerationRules.EventsMonitoringIsEnabledForCurrentTab()) return;

      this.observer = Observer.Observe(
        [{ element: $(this.watchedSelectors.join(', ')), options: { childList: true, subtree: true } }],
        (mutations) => {
          if (!tolerationRules.EventsMonitoringIsEnabledForCurrentTab()) return;
          if (!mutations || mutations.length === 0) return;

          // Ignore les mutations liées au compteur temporaire au survol
          if (mutations.every(m => $(m.target).closest('#tempcounter').length > 0)) return;

          this.logger.debug("Detected relevant DOM changes, syncing counters...", mutations);
          this.Sync();
        }
      );
      this.logger.debug("Started observing DOM changes for message and fleet counters.");
    }
    catch (error) {
      this.logger.error("Error waiting for DOM elements to observe:", { watchedSelectors: this.watchedSelectors, error });
    }
  }

  private StopObserving(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = undefined;
      this.logger.debug("Observer disconnected.");
    }
  }

  private async Sync(): Promise<void> {
    if (!tolerationRules.EventsMonitoringIsEnabledForCurrentTab()) return;

    Debouncer.Debounce("OgameHeaderScanner.Sync", () => {
      if (!tolerationRules.EventsMonitoringIsEnabledForCurrentTab()) return;

      const universeKey = UniverseDataNormalizer.NormalizeUniverseKey(OgmWindowUtils.UNIVERSE_KEY);
      if (universeKey === '') return;

      const { hostile, friendly, own } = this.GetFleetCounters();
      const { messages, chat } = this.GetMessageCounters();

      serviceWorkerProtocolClient.UpdateUniverseStatusAsync(this.logger, universeKey, OgameMetadatas.UniverseName(), new SidePanelUniverseCounters({
        NewMessages: messages,
        NewChatMessages: chat,
        HostileFleetCount: hostile,
        FriendlyFleetCount: friendly,
        OwnFleetCount: own
      }));

    }, 100);
  }

  private GetFleetCounters(): { hostile: number; friendly: number; own: number } {
    let hostile = 0, friendly = 0, own = 0;

    const $root = $('#eventboxFilled');
    if ($root.length > 0) {
      const parseCount = (selector: string): number => {
        const text = $root.find(selector).text().trim();
        const match = text.match(/\d+/);
        return match ? Math.max(0, parseInt(match[0], 10)) : 0;
      };

      const hasAnyCounter = $root.find('.event_list .undermark, .event_list .middlemark, .event_list .overmark').length > 0;

      own = hasAnyCounter ? parseCount('.event_list .undermark') : 0;
      friendly = hasAnyCounter ? parseCount('.event_list .middlemark') : 0;
      hostile = hasAnyCounter ? parseCount('.event_list .overmark') : 0;
    }

    return { hostile, friendly, own };
  }

  private GetMessageCounters(): { messages: number; chat: number } {
    const $container = $('#newmessagesindicatorcomponent');
    const $root = $container.length > 0 ? $container : $(document.body);

    const parseSingle = ($el: JQuery<HTMLElement>): number => {
      const attrs = ['data-new-messages', 'data-count', 'data-value', 'aria-label', 'title'];

      for (const attrName of attrs) {
        const attr = ($el.attr(attrName) || '').trim();
        if (!attr) continue;
        const match = attr.match(/\d+/);
        if (match) return Math.max(0, parseInt(match[0], 10));
      }

      const newCountText = $el.find('.newCount').text().trim();
      const textToParse = newCountText || $el.text().trim();
      const match = textToParse.match(/\d+/);
      return match ? Math.max(0, parseInt(match[0], 10)) : 0;
    };

    const parseCount = ($parent: JQuery<HTMLElement>, selectors: string[]): number => {
      let max = 0;
      selectors.forEach((selector) => {
        $parent.find(selector).each((_, el) => {
          const count = parseSingle($(el));
          if (count > max) max = count;
        });
      });
      return max;
    };

    const messages = parseCount($root, ['.messagesIndicator']);
    const chat = parseCount($root, ['.chatIndicator']);

    return { messages, chat };
  }
}