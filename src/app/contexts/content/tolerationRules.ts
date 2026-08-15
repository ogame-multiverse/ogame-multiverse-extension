/**
 * CRITICAL COMPLIANCE COMPONENT
 *
 * This class centralizes the game toleration and compliance rules enforced by this extension.
 * It is an extremely sensitive file that directly determines whether the extension
 * complies with OGame rules and maintains its official toleration status.
 *
 * ANY CHANGES TO THIS FILE, OR TO ANY LOCATION WHERE THIS CLASS IS CONSUMED,
 * MUST BE SCRUTINIZED AND REVIEWED WITH EXTREME CARE.
 */
class TolerationRules {
  /**
   * Determines whether event-box monitoring (fleets, messages, chats) is allowed for the current tab.
   *
   * Official game rules require that DOM event data is strictly extracted while the player
   * is actively viewing the universe tab. Background extraction on unfocused tabs is prohibited.
   *
   * @returns {boolean} `true` if the current tab is visible to the player; `false` otherwise.
   */
  public EventsMonitoringIsEnabledForCurrentTab(): boolean {
    return typeof document !== 'undefined' && document.visibilityState === 'visible';
  }
}

/**
 * Global instance for enforcement of compliance rules.
 *
 * WARNING: ANY MODIFICATION TO LINES OF CODE CONSUMING THIS INSTANCE
 * MUST BE SCRUTINIZED AND REVIEWED WITH EXTREME CARE TO AVOID COMPLIANCE VIOLATIONS.
 */
export const tolerationRules = new TolerationRules();