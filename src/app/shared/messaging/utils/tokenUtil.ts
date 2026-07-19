import { GlobalConstants } from "../../../globalConstants";

export class TokenUtil {
  public static GetCallbackToken(): string | undefined {
    const token = document.documentElement.dataset[GlobalConstants.DATASET_NAME];
    // Token "1" is used to mark the token as read by the page client
    return token && token !== "1" ? token : undefined;
  }

  public static CreateToken(): string {
    // Generate a random 12-character hexadecimal token
    // Example: "a3f4c2e1b6d7"
    return (Math.floor(Math.random() * 0xffffffffffff) + 1e6).toString(16).padStart(12, "0");
  }
}

