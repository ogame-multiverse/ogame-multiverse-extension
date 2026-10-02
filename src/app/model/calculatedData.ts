export class CalculatedData {
    MaximumExpeditionSlots: number;
    constructor(data: Partial<CalculatedData>) {
        this.MaximumExpeditionSlots = data.MaximumExpeditionSlots ?? 0;
    }
}