export class UniverseData {
  UniverseName: string;

  HostileFleetCount: number = 0;
  FriendlyFleetCount: number = 0;
  OwnFleetCount: number = 0;

  MessagesCount: number = 0;
  ChatMessagesCount: number = 0;

  constructor(data: Partial<UniverseData> = {}) {
    if (data) {
      this.UniverseName = data.UniverseName || '';

      this.HostileFleetCount = data.HostileFleetCount || 0;
      this.FriendlyFleetCount = data.FriendlyFleetCount || 0;
      this.OwnFleetCount = data.OwnFleetCount || 0;

      this.MessagesCount = data.MessagesCount || 0;
      this.ChatMessagesCount = data.ChatMessagesCount || 0;
    }
  }
}