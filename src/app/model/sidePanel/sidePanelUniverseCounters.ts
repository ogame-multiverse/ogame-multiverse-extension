export class SidePanelUniverseCounters {
  public NewMessages: number | 0;
  public NewChatMessages: number | 0;
  public HostileFleetCount: number | 0;
  public FriendlyFleetCount: number | 0;
  public OwnFleetCount: number | 0;

  constructor(data: Partial<SidePanelUniverseCounters>) {
    this.NewMessages = data.NewMessages ?? 0;
    this.NewChatMessages = data.NewChatMessages ?? 0;
    this.HostileFleetCount = data.HostileFleetCount ?? 0;
    this.FriendlyFleetCount = data.FriendlyFleetCount ?? 0;
    this.OwnFleetCount = data.OwnFleetCount ?? 0;
  }
}