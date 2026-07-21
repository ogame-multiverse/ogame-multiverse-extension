export class UniverseSidePanelOptions {
  public WarningThresholdMinutes: number = 15;
  public ShowHostileFleetIndicator: boolean = true;
  public ShowFriendlyFleetIndicator: boolean = true;
  public ShowOwnFleetIndicator: boolean = true;
  public ShowUnreadMessagesIndicator: boolean = true;
  public ShowUnreadChatMessagesIndicator: boolean = true;

  constructor(data: Partial<UniverseSidePanelOptions>) {
    this.WarningThresholdMinutes = data.WarningThresholdMinutes ?? 15;
    this.ShowHostileFleetIndicator = data.ShowHostileFleetIndicator ?? true;
    this.ShowFriendlyFleetIndicator = data.ShowFriendlyFleetIndicator ?? true;
    this.ShowOwnFleetIndicator = data.ShowOwnFleetIndicator ?? true;
    this.ShowUnreadMessagesIndicator = data.ShowUnreadMessagesIndicator ?? true;
    this.ShowUnreadChatMessagesIndicator = data.ShowUnreadChatMessagesIndicator ?? true;
  }
}