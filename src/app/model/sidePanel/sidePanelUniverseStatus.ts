import { UniverseSidePanelOptions } from './universeSidePanelOptions';
import { SidePanelUniverseCounters } from './sidePanelUniverseCounters';
export class SidePanelUniverseStatus {
  public UniverseKey: string;
  public UniverseDisplayName: string;
  public IsOpen: boolean;
  public OpenTabsCount: number;

  public LastRefreshAtIso?: string;

  public SidePanelUniverseCounters: SidePanelUniverseCounters;
  public SidePanelOptions: UniverseSidePanelOptions;

  constructor(data: Partial<SidePanelUniverseStatus>) {
    this.UniverseKey = data.UniverseKey;
    this.UniverseDisplayName = data.UniverseDisplayName;
    this.IsOpen = data.IsOpen;
    this.OpenTabsCount = data.OpenTabsCount;
    this.LastRefreshAtIso = data.LastRefreshAtIso;
    this.SidePanelUniverseCounters = data.SidePanelUniverseCounters ?? new SidePanelUniverseCounters({});
    this.SidePanelOptions = data.SidePanelOptions ?? new UniverseSidePanelOptions({})
  }
}