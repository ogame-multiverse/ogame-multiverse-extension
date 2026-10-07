# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Fleet slots indicator showing, for each universe, the number of active fleets out of the maximum number of fleet slots.
- Expedition slots indicator showing, for each universe, the number of active expeditions out of the maximum number of expedition slots.
- Per-universe option to show or hide the expedition counter.
- Red exclamation mark next to the Universes tab title, displayed when one or more universes have exceeded their configured inactivity threshold.
- New Events tab listing the fleet events as seen by the player. Like the fleet counters in the Universes tab, events reflect the state as seen by the player.
  - Chronological fleet list
    - Events from all universes are grouped by universe and sorted by arrival time.
    - Each section has a universe header with its tab management badges and its reload button.
  - Optional timeline
    - A "Show timeline" checkbox toggles a timeline with markers every 15 minutes, linked by a rail.
    - A date badge appears when the day changes.
    - When many empty time slots follow one another, only the first and the last are displayed, linked by a dotted line.
  - Real-time countdowns
    - Countdowns update every second, using the formats `Xd XXh`, `Xh XXm` or `Xm XXs`.
    - Once the arrival time has passed, the card switches to a "finished" state.
    - A tooltip shows the exact arrival time.
  - Fleet ownership
    - Each fleet is flagged as own, hostile or friendly.
    - Some mission types are considered friendly even when the fleet is not yours: transport, ACS defend, exploration and anomaly reward delivery.
    - Returning fleets and ghost fleets have their own style.
  - Ghost fleet detection
    - Ghost fleets are detected by their mission type and composition.
    - Only your own fleets can be flagged as ghost.
    - Espionage: the fleet is not made up solely of espionage probes and travels between one of your moons and position 16 of a system (outbound from the moon, or returning to it).
    - Harvest: the fleet is not made up solely of recyclers and is attached to a moon (origin on the outbound trip, destination on the return trip).
    - Colonisation: the fleet is not made up solely of colony ships and is attached to a moon (origin on the outbound trip, destination on the return trip).
    - Deployment: return trip only, from one of your own moons, carrying at least one resource.
  - Automatic grouping
    - Consecutive fleets are merged into a single group when they share:
      - the same mission;
      - the same return status;
      - the same ownership (own or not);
      - the same ghost status;
      - arrival times at most 5 minutes apart.
  - Other behaviors
    - Cards of the universe active in the current window are highlighted.
    - Tooltips (Tippy) show the details of a group's sub-cards, each with its own countdown.
- Per-universe option to enable or disable fleet event tracking. It is disabled by default.
  - The Events tab is hidden as long as no universe has fleet event tracking enabled, and reappears as soon as one does. This applies to every open side panel; if the Events tab was active when it disappears, the side panel switches back to the Universes tab.
- Per-universe fleet event filters, available in the universe settings under "Events tracking" (only shown while fleet tracking is enabled).
  - Matrix of checkboxes: one row per mission type, one column per ownership (own, friendly, hostile). Combinations that cannot exist have no checkbox.
  - Rows are organized as follows:
    - Ungrouped: Ghost, Expedition.
    - Military: Attack, Espionage, Moon destruction, Missile attack, ACS defend.
    - Civil: Transport, Deployment, Harvest, Colonisation, Exploration.
    - Anomalies: Anomaly encounter, Reward delivery.
  - Attack and ACS attack share a single row, as do anomaly encounter and ACS anomaly encounter.
  - Ghost row: when checked, ghost fleets are always displayed, whatever the filters of their mission type. When unchecked, they follow the regular filters.
  - "Check all" and "Uncheck all" buttons.
  - Every box is checked by default. Events with an unknown mission type are always displayed.
  - Filters only hide events in the Events tab and apply to both outbound and return trips.
- Technical informations:
  - Parsing of the OGame page to retrieve the data required for fleet event tracking.
  - Support for two new OGame data endpoints:
    - Species Bonuses (`/game/index.php?page=componentOnly&component=externaldataexport&action=speciesBonuses&asJson=1`)
      - Only fetched on page load if the last fetch is more than 1 hour old.
      - Changing the UI language forces a new fetch, regardless of the time to live, to retrieve the matching translations.
      - Provides the translation data used to detect fleet composition.
      - Provides the lifeform bonuses used to compute the maximum number of expedition slots.
      - Data not used yet is also parsed, in preparation for future features.
    - Account Information (`/game/index.php?page=componentOnly&component=externaldataexport&action=accountInfo&asJson=1`)
      - Only fetched on page load if the last fetch is more than 10 minutes old.
      - Provides the account data that affects the maximum number of expedition slots (player class and Astrophysics research level).
      - Data not used yet is also parsed, in preparation for future features.

### Changed
- Softened the interface colors to make them less harsh.
- "Last observed indicators" and "Events tracking" groups in the universe settings are now collapsible and collapsed by default, to save vertical space.

## [1.3.0.1] - 2026-08-31

### Fixed

- Resolved non-responsive layout issue on universe cards when shrinking the Firefox sidepanel to its minimum width.

## [1.3.0.0] - 2026-08-30

### Added
- Added universe reorganization in list mode (special thanks to GeGe).
- Added grid layout reorganization when expanding the sidepanel to full view.
- Categorized universe dashboard into **Favorite** and **Other** sections.

### Changed
- Since indicators are now static snapshots, an active OGame tab is no longer required to display them.
- Technical refactoring and codebase improvements.

## [1.2.0.1] - 2026-08-21
### Fixed
- Compatibility fix for Mozilla Add-ons store requirements (manifest update).

## [1.2.0.0] - 2026-08-16

### Added
* **Compliance Rules Centralization**: `TolerationRules` (`tolerationRules.ts`) to centralize critical game compliance logic that determines the extension's official toleration status.
* **Git Pre-commit Hook**: Automated check to detect and warn about changes affecting compliance rules or their consumption.
* **Automated Hook Setup**: Automatic Git hooks path configuration (`core.hooksPath .githooks`) integrated into `build.sh`.

### Changed
* **Last Seen Indicators**: Fleet, message, and chat indicators now act as "last seen" snapshots that only update when you actively view a universe tab.
* **Persistent Display**: Since indicators are now static snapshots, they remain displayed in the SidePanel whenever a universe tab is open—regardless of whether it is active, in the background, or in another window.

## [1.1.0.0] - 2026-08-07

### Added
- Multiple new ways to toggle the side panel:
  - Context menu integration.
  - `Ctrl+Space` keyboard shortcut.
  - In-page trigger button on OGame pages (Chrome only; disabled on Firefox due to click event messaging limitations between content scripts and the Service Worker).
- Multi-window universe tab state evaluation and dynamic badge rendering:
  - **State Scoping**: Tracks universe tabs locally versus remote windows and monitors active window focus.
  - **Contextual Badge Actions & Dynamic Icons**:
    - **Universe tab active in current window**: Displays a green indicator bar on the left.
    - **Universe tab open in current window**: Displays an active status badge (`check_circle`).
    - **Universe tab open (inactive) in current window**: Displays an open badge, transforming to a `visibility` icon on hover to focus the tab (`activate`).
    - **Universe tab open in current AND other windows**: Displays a remote tab badge, transforming to a `close` icon on hover to close remote instances (`close`).
    - **Universe tab open exclusively in another window**: Displays a remote tab badge, transforming to an `input` icon on hover to pull the tab into the current window (`move`).
    - **Universe closed across all windows**: Displays a closed status badge (`cancel`).

### Changed
- Updated UI element visibility rules for universe rows in the SidePanel:
  - Visible only if the universe is closed or open within the **current browser window** (hidden when open exclusively in other windows):
    - The **refresh button**
    - The **settings button**
  - Visible only if the universe is open within the **current browser window** (hidden when closed or open exclusively in other windows):
    - The **messages, chat, and fleet indicators**
- Migrated inter-layer communication to use `webext-core`.
- Replaced polling loops in the content script and side panel with an event-driven `MutationObserver` pipeline:
  - Content script detects DOM changes via `MutationObserver` and pushes events to the Service Worker.
  - Service Worker forwards the updates to the side panel.
- Replaced native `console.log` calls with the dedicated logger utility.


## [1.0.0.0] - 2026-07-22

### Added
- Initial stable release with multi-universe monitoring, inactivity tracking and events monitoring