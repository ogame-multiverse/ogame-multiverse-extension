import { Coordinates } from '../../model/coordinates';
import { PositionType } from '../../model/enums/positionType';

export class OgameMetadatas {
  private static GetMetaValue(key: string): string | undefined {
    return document.querySelector<HTMLMetaElement>(`meta[name="${key}"]`)?.content || undefined;
  }

  // General metadata
  public static OGameSessionId(): string | undefined {
    return OgameMetadatas.GetMetaValue('ogame-session');
  }

  public static OGameVersion(): string | undefined {
    return OgameMetadatas.GetMetaValue('ogame-version');
  }

  public static OGameTimestamp(): string | undefined {
    return OgameMetadatas.GetMetaValue('ogame-timestamp');
  }

  public static GameLanguage(): string {
    return OgameMetadatas.GetMetaValue('ogame-language');
  }

  // Selected UI language metadata with fallback chain
  public static UILanguage(): string {
    return OgameMetadatas.GetMetaValue('ogame-ui-language');
  }

  // Universe metadata
  public static UniverseName(): string | undefined {
    return OgameMetadatas.GetMetaValue('ogame-universe-name');
  }

  public static UniverseDomain(): string | undefined {
    return OgameMetadatas.GetMetaValue('ogame-universe');
  }

  // Current position metadata
  public static CurrentPositionId(): number {
    const idStr = OgameMetadatas.GetMetaValue('ogame-planet-id');
    return idStr !== undefined ? parseInt(idStr, 10) : 0;
  }

  public static CurrentPositionName(): string | undefined {
    return OgameMetadatas.GetMetaValue('ogame-planet-name');
  }

  public static CurrentPositionType(): PositionType.Planet | PositionType.Moon | undefined {
    const type = OgameMetadatas.GetMetaValue('ogame-planet-type');
    return type === 'moon' ? PositionType.Moon : type === 'planet' ? PositionType.Planet : undefined;
  }

  public static CurrentPositionCoordinates(): Coordinates {
    return new Coordinates(true, OgameMetadatas.GetMetaValue('ogame-planet-coordinates') || '0:0:0');
  }

  // Alliance metadata
  public static AllianceId(): number | undefined {
    const idStr = OgameMetadatas.GetMetaValue('ogame-alliance-id');
    return idStr !== undefined ? parseInt(idStr, 10) : undefined;
  }

  public static AllianceName(): string | undefined {
    return OgameMetadatas.GetMetaValue('ogame-alliance-name');
  }

  public static AllianceTag(): string | undefined {
    return OgameMetadatas.GetMetaValue('ogame-alliance-tag');
  }

  // Player metadata
  public static PlayerId(): number | undefined {
    const idStr = OgameMetadatas.GetMetaValue('ogame-player-id');
    return idStr !== undefined ? parseInt(idStr, 10) : undefined;
  }

  public static PlayerName(): string | undefined {
    return OgameMetadatas.GetMetaValue('ogame-player-name');
  }
}