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

export class OgameEventsScanner {
  private observer: MutationObserver | undefined;

  constructor(private readonly logger: Logger) { }

  public async StartAsync(): Promise<void> {



    if (this.observer) {
      this.logger.warn("Start called but already observing.");
      return;
    }

    // Listen for visibility changes to sync counters when the tab becomes visible
    $(document).on('visibilitychange.OgameHeaderScanner', () => {
      if (document.visibilityState === 'visible') {
        this.logger.debug("Tab became visible, syncing counters...");
        this.Sync();
      }
    });

    // Wait for the relevant DOM elements to be present before starting observation
    const watchedSelectors = ['#newmessagesindicatorcomponent', '#eventboxFilled'];
    try {
      await DomDelayer.WaitForAllQuerySelectors(watchedSelectors, 50, 5000);
      // Change detection for message and fleet counters
      this.observer = Observer.Observe(
        [{ element: $(watchedSelectors.join(', ')), options: { childList: true, subtree: true } }],
        (mutations) => {
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
      this.logger.error("Error waiting for DOM elements to observe:", { watchedSelectors, error });
    }
    finally {
      // Initial sync on start
      this.logger.debug("Performing initial sync of counters.");
      this.Sync();
    }
  }

  public Stop(): void {
    $(document).off('visibilitychange.OgameHeaderScanner');
    if (this.observer) {
      this.observer.disconnect();
      this.observer = undefined;
      this.logger.info("Observer disconnected.");
    }
  }

  private async Sync(): Promise<void> {
    Debouncer.Debounce("OgameHeaderScanner.Sync", () => {
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