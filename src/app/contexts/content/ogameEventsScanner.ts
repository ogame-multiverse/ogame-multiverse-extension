import $ from 'jquery';
import { Debouncer } from '../../async/debouncer';
import { DomDelayer } from '../../async/domDelayer';
import { Observer } from '../../dom/observer';
import { OgameDomParser } from '../../dom/ogameDom/ogameDomParser';
import { OgameMetadatas } from '../../dom/ogameDom/ogameMetadatas';
import { Logger } from '../../logging/logger';
import { serviceWorkerProtocolClient } from '../../messaging/serviceWorkerProtocol';
import { SidePanelUniverseCounters } from "../../model/sidePanel/sidePanelUniverseCounters";
import { UniverseDataNormalizer } from '../../universeDataNormalizer';
import { OgmWindowUtils } from './ogmWindowUtils';
import { tolerationRules } from './tolerationRules';
import { DateUtils } from '../../dateUtils';
import { MissionType } from '../../model/enums/missionType';

interface MutationsAnalysis {
    isRelevant: boolean,
    hasCountersMutations: boolean,
    hasFlyinFleetMutations: boolean
}
export class OgameEventsScanner {
    private observer: MutationObserver | undefined;
    private readonly waitedSelectors = ['#newmessagesindicatorcomponent', '#eventboxFilled', '#eventContent'];

    private readonly watchedSelectors = ['#newmessagesindicatorcomponent', '#eventboxFilled', '#eventContent .eventFleet'];

    constructor(private readonly ogameDomParser: OgameDomParser) { }

    public async StartAsync(logger: Logger): Promise<void> {
        // Clean up any previous event listeners to avoid duplicates
        $(document).off('visibilitychange.OgameHeaderScanner');

        // Listen for visibility changes to start/stop observation and sync counters when the tab becomes visible
        $(document).on('visibilitychange.OgameHeaderScanner', async () => {
            if (tolerationRules.EventsMonitoringIsEnabledForCurrentTab()) {
                logger.debug("Tab became visible, syncing asnd starting observation...");
                await this.Sync(logger, true);
                await this.StartObservingAsync(logger);
            } else {
                logger.debug("Tab became hidden, stopping observation.");
                this.StopObserving(logger);
            }
        });

        //Initial sync and observation if the tab is already visible
        if (tolerationRules.EventsMonitoringIsEnabledForCurrentTab()) {
            await this.StartObservingAsync(logger);
            this.Sync(logger, true);
        }
    }

    public Stop(logger: Logger): void {
        $(document).off('visibilitychange.OgameHeaderScanner');
        this.StopObserving(logger);
    }

    private AnalyseMutations(mutations: MutationRecord[]): MutationsAnalysis {
        let hasCountersMutations = false;
        let hasFlyinFleetMutations = false;

        for (const m of mutations) {
            const targetEl = m.target instanceof Element ? m.target : m.target.parentElement;
            if (!targetEl) continue;

            // Exclude mutations that are within the #tempcounter or .countDown elements, as they are not relevant for syncing counters nor flying fleet events
            if (targetEl.closest('#tempcounter, .countDown')) {
                continue;
            }

            // Some changes on the message counters or chat counters
            if (targetEl.closest('#newmessagesindicatorcomponent, #eventboxFilled')) {
                hasCountersMutations = true;
            }

            // Some changes on the flying fleet events
            if (targetEl.closest('#eventContent, .eventFleet')) {
                hasFlyinFleetMutations = true;
            }
        }

        return {
            isRelevant: hasCountersMutations || hasFlyinFleetMutations,
            hasCountersMutations,
            hasFlyinFleetMutations
        };
    }

    private async StartObservingAsync(logger: Logger): Promise<void> {
        if (this.observer) return; // Already observing

        try {
            await DomDelayer.WaitForAllQuerySelectors(this.waitedSelectors, 50, AbortSignal.timeout(DateUtils.FiveSecondsInMilliseconds));

            // Security check: Ensure that the tab is still visible and monitoring is enabled before starting observation
            if (!tolerationRules.EventsMonitoringIsEnabledForCurrentTab()) return;

            this.observer = Observer.Observe(
                [{ element: $(this.watchedSelectors.join(', ')), options: { childList: true, subtree: true } }],
                (mutations) => {
                    if (!tolerationRules.EventsMonitoringIsEnabledForCurrentTab()) return;
                    if (!mutations || mutations.length === 0) return;

                    const mutationsAnalysis = this.AnalyseMutations(mutations);

                    if (!mutationsAnalysis.isRelevant) return;

                    logger.debug("Detected relevant DOM changes", mutationsAnalysis);
                    this.Sync(logger, true);
                }
            );
            logger.debug("Started observing DOM changes for message and fleet counters.");
        }
        catch (error) {
            logger.error("Error waiting for DOM elements to observe:", { watchedSelectors: this.watchedSelectors, error });
        }
    }

    private StopObserving(logger: Logger): void {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = undefined;
            logger.debug("Observer disconnected.");
        }
    }

    private async Sync(logger: Logger, removeFinishedFlyings: boolean): Promise<void> {
        if (!tolerationRules.EventsMonitoringIsEnabledForCurrentTab()) return;

        Debouncer.Debounce("OgameHeaderScanner.Sync", () => {
            if (!tolerationRules.EventsMonitoringIsEnabledForCurrentTab()) return;

            const universeKey = UniverseDataNormalizer.NormalizeUniverseKey(OgmWindowUtils.UNIVERSE_KEY);
            if (universeKey === '') return;

            const { hostile, friendly, own } = this.ogameDomParser.AnalyseFleetCounters();
            const { messages, chat } = this.ogameDomParser.AnalyseMessageCounters();
            const flyingFleetEvents = this.ogameDomParser.AnalyseFlyings(logger, removeFinishedFlyings);
            // Count the number of active expeditions (returning fleets with mission type Expedition)
            const activeExpeditions = flyingFleetEvents.reduce((count, e) => (e.IsReturn && e.MissionType === MissionType.Expedition) ? count + 1 : count, 0);

            serviceWorkerProtocolClient.UpdateUniverseStatusAsync(logger, universeKey, new SidePanelUniverseCounters({
                NewMessages: messages,
                NewChatMessages: chat,
                HostileFleetCount: hostile,
                FriendlyFleetCount: friendly,
                OwnFleetCount: own,
                ActiveExpeditions: activeExpeditions,
            }), flyingFleetEvents);

        }, 100);
    }

}