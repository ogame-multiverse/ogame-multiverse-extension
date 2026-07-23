import $ from 'jquery';
import { Logger } from '../../logging/logger';
import { SidePanelUniverseCounters } from "../../model/sidePanel/sidePanelUniverseCounters";
import { OgmContentContext } from "./ogmContentContext";
import { Observer } from '../../dom/observer';

export class OgameHeaderScanner {
  private observer: MutationObserver | undefined;

  constructor(private readonly logger: Logger) { }

  public Start(): void {
    if (this.observer) {
      this.logger.warn("Start called but already observing.");
      return;
    }
    else {

      OgameHeaderScanner.Sync();
      const obserrveSelector = [
        '#newmessagesindicatorcomponent .messagesIndicator',
        '#newmessagesindicatorcomponent .chatIndicator',
        '#eventboxFilled'
      ];

      if (this.observer) {
        this.logger.warn("Start called but already observing.");
        return;
      }

      this.observer = Observer.Observe(
        [{ element: $(obserrveSelector.join(', ')), options: { childList: true, subtree: true } }],
        (mutations) => {
          // Ignore mutations that are not relevant
          if (!mutations || mutations.length === 0) return;

          // Ignore mutations that are only related to the temp counter (e.g., when hovering over the message icon)
          if (mutations.every(m => $(m.target).closest('#tempcounter').length > 0)) return;

          this.logger.debug("Detected relevant DOM changes, syncing counters...", mutations);

          OgameHeaderScanner.Sync();
        }
      );
      this.logger.debug("Started observing DOM changes for message and fleet counters.");
    }
  }

  public Stop(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = undefined;
      this.logger.info("Observer disconnected.");
    }
  }

  public static Sync(): void {
    const { hostile, friendly, own } = OgameHeaderScanner.GetFleetCounters();
    const { messages, chat } = OgameHeaderScanner.GetMessageCounters();

    OgmContentContext.Instance.UpdateUniverseStatusAsync(
      new SidePanelUniverseCounters({
        NewMessages: messages,
        NewChatMessages: chat,
        HostileFleetCount: hostile,
        FriendlyFleetCount: friendly,
        OwnFleetCount: own
      })
    );
  }

  private static GetFleetCounters(): { hostile: number, friendly: number, own: number } {
    let hostile = 0, friendly = 0, own = 0;

    const $root = $('#eventboxFilled');
    if ($root.length > 0) {
      const parseCount = (selector: string): number => {
        const text = $root.find(selector).text().trim();
        if (!text) return 0;
        const match = text.match(/\d+/);
        return match ? Math.max(0, Number(match[0]) || 0) : 0;
      };

      const hasAnyCounter = $root.find('.event_list .undermark, .event_list .middlemark, .event_list .overmark').length > 0;

      own = hasAnyCounter ? parseCount('.event_list .undermark') : 0;
      friendly = hasAnyCounter ? parseCount('.event_list .middlemark') : 0;
      hostile = hasAnyCounter ? parseCount('.event_list .overmark') : 0;
    }

    return { hostile, friendly, own };
  }

  public static GetMessageCounters(): { messages: number, chat: number } {
    const $container = $('#newmessagesindicatorcomponent');
    const $root = $container.length > 0 ? $container : $(document.body);

    const parseSingle = ($el: JQuery<HTMLElement>): number => {
      const attrs = ['data-new-messages', 'data-count', 'data-value', 'aria-label', 'title'];

      for (const attrName of attrs) {
        const attr = ($el.attr(attrName) || '').trim();
        if (!attr) continue;
        const digits = attr.replace(/[^0-9]/g, '');
        if (!digits) continue;
        const n = parseInt(digits, 10);
        if (Number.isFinite(n)) return Math.max(0, n);
      }

      const newCountText = $el.find('.newCount').text().trim();
      const fullText = `${newCountText} ${$el.text().trim()}`.trim();
      const digits = fullText.replace(/[^0-9]/g, '');
      const n = digits ? parseInt(digits, 10) : 0;
      return Number.isFinite(n) ? Math.max(0, n) : 0;
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