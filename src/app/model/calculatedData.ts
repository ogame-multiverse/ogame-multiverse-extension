export class CalculatedData {
    MaximumFleetSlots: number;
    MaximumExpeditionSlots: number;
    constructor(data: Partial<CalculatedData>) {
        this.MaximumFleetSlots = data.MaximumFleetSlots ?? 0;
        this.MaximumExpeditionSlots = data.MaximumExpeditionSlots ?? 0;
    }
}