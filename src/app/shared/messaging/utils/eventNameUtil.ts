import { GlobalConstants } from "../../../globalConstants";

export class EventNameUtil {
  public static BuildEventName(token: string, referer?: string): string {
    return GlobalConstants.DATASET_NAME.concat(token).concat(referer ? `-`.concat(referer) : "");
  }
}

