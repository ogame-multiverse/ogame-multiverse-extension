export class ExtensionLocalData {

  public UniverseKey: string;
  public UniverseName: string;
  public UniverseNumber: number;
  public UniverseLanguage: string;
  public UniverseDomain: string;

  public LastRefreshDate?: number;
  public WarningThresholdMinutes: number = 15;

  public ShowHostileFleetIndicator: boolean = true;
  public ShowFriendlyFleetIndicator: boolean = true;
  public ShowOwnFleetIndicator: boolean = true;
  public ShowUnreadMessagesIndicator: boolean = true;
  public ShowUnreadChatMessagesIndicator: boolean = true;

  constructor(data: Partial<ExtensionLocalData>) {
    this.UniverseKey = data.UniverseKey;
    this.UniverseName = data.UniverseName;
    this.UniverseNumber = data.UniverseNumber;
    this.UniverseDomain = data.UniverseDomain;

    this.LastRefreshDate = data.LastRefreshDate;
    this.WarningThresholdMinutes = data.WarningThresholdMinutes ?? 15;

    this.ShowHostileFleetIndicator = data.ShowHostileFleetIndicator ?? true;
    this.ShowFriendlyFleetIndicator = data.ShowFriendlyFleetIndicator ?? true;
    this.ShowOwnFleetIndicator = data.ShowOwnFleetIndicator ?? true;
    this.ShowUnreadMessagesIndicator = data.ShowUnreadMessagesIndicator ?? true;
    this.ShowUnreadChatMessagesIndicator = data.ShowUnreadChatMessagesIndicator ?? true;
  }
}