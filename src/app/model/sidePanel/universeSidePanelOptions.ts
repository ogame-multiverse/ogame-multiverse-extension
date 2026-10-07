export class UniverseSidePanelOptions {
    public WarningThresholdMinutes: number = 15;
    public ShowHostileFleetIndicator: boolean = true;
    public ShowFriendlyFleetIndicator: boolean = true;
    public ShowOwnFleetIndicator: boolean = true;
    public ShowUnreadMessagesIndicator: boolean = true;
    public ShowUnreadChatMessagesIndicator: boolean = true;
    public FleetTrackingEnabled: boolean = true;
    public ShowExpeditionsIndicator: boolean = true;
    public ShowFleetSlotsIndicator: boolean = true;
    /** Fleet events filters (see fleetEventFilters.ts). Key = `${groupKey}:${ownership}`, value = shown or not.
     *  A missing key means "shown" (checked by default). */
    public FleetEventFilters: Record<string, boolean> = {};

    constructor(data: Partial<UniverseSidePanelOptions>) {
        this.WarningThresholdMinutes = data.WarningThresholdMinutes ?? 15;
        this.ShowHostileFleetIndicator = data.ShowHostileFleetIndicator ?? true;
        this.ShowFriendlyFleetIndicator = data.ShowFriendlyFleetIndicator ?? true;
        this.ShowOwnFleetIndicator = data.ShowOwnFleetIndicator ?? true;
        this.ShowUnreadMessagesIndicator = data.ShowUnreadMessagesIndicator ?? true;
        this.ShowUnreadChatMessagesIndicator = data.ShowUnreadChatMessagesIndicator ?? true;
        this.FleetTrackingEnabled = data.FleetTrackingEnabled ?? true;
        this.ShowExpeditionsIndicator = data.ShowExpeditionsIndicator ?? true;
        this.ShowFleetSlotsIndicator = data.ShowFleetSlotsIndicator ?? true;
        this.FleetEventFilters = { ...(data.FleetEventFilters ?? {}) };
    }
}