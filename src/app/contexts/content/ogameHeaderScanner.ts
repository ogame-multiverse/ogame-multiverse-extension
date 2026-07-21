import { SidePanelUniverseCounters } from "../../model/sidePanel/sidePanelUniverseCounters";
import { OgmContentContext } from "./ogmContentContext";

export class OgameHeaderScanner {
  private readonly intervalMs: number;
  private timerId: number | undefined;

  constructor(intervalMs = 1000) {
    this.intervalMs = intervalMs;
  }

  public Start(): void {
    if (this.timerId) {
      console.warn("OgameHeaderScanner: Start called but timer is already running.");
      return;
    }
    this.timerId = setInterval(() => OgameHeaderScanner.Sync(), this.intervalMs);
    console.info(`OgameHeaderScanner: Started with interval ${this.intervalMs}ms.`);
  }

  public Stop(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = undefined;
      console.info("OgameHeaderScanner: Stopped.");
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
      }));
  }

  private static GetFleetCounters(): { hostile: number, friendly: number, own: number } {
    let hostile = 0, friendly = 0, own = 0;

    const root = document.querySelector('#eventboxFilled') as HTMLElement | null;
    if (root) {
      const parseCount = (selector: string): number => {
        const text = (root.querySelector(selector)?.textContent || '').trim();
        if (!text) return 0;
        const match = text.match(/\d+/);
        return match ? Math.max(0, Number(match[0]) || 0) : 0;
      };

      const hasAnyCounter = root.querySelector('.event_list .undermark') !== null
        || root.querySelector('.event_list .middlemark') !== null
        || root.querySelector('.event_list .overmark') !== null;

      own = hasAnyCounter ? parseCount('.event_list .undermark') : 0;
      friendly = hasAnyCounter ? parseCount('.event_list .middlemark') : 0;
      hostile = hasAnyCounter ? parseCount('.event_list .overmark') : 0;
    }

    return { hostile, friendly, own };
  }

  public static GetMessageCounters(): { messages: number, chat: number } {
    let messages = 0, chat = 0;

    const root = document.querySelector('#newmessagesindicatorcomponent') ?? document.body;

    const parseSingle = (el: Element): number => {
      const attrs = ['data-new-messages', 'data-count', 'data-value', 'aria-label', 'title'];
      for (const attrName of attrs) {
        const attr = (el.getAttribute(attrName) || '').trim();
        if (!attr) continue;
        const digits = attr.replace(/[^0-9]/g, '');
        if (!digits) continue;
        const n = parseInt(digits, 10);
        if (Number.isFinite(n)) return Math.max(0, n);
      }

      const newCountText = (el.querySelector('.newCount')?.textContent || '').trim();
      const fullText = `${newCountText} ${(el.textContent || '').trim()}`.trim();
      const digits = fullText.replace(/[^0-9]/g, '');
      const n = digits ? parseInt(digits, 10) : 0;
      return Number.isFinite(n) ? Math.max(0, n) : 0;
    };
    const parseCount = (parent: ParentNode, selectors: string[]): number => {
      let max = 0;
      for (const selector of selectors) {
        parent.querySelectorAll(selector).forEach((el) => {
          const count = parseSingle(el);
          if (count > max) max = count;
        });
      }
      return max;
    };

    messages = parseCount(root, ['.messagesIndicator']);
    chat = parseCount(root, ['.chatIndicator']);

    return { messages, chat };
  }

}