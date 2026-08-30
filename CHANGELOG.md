# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Added universe reorganization in list mode (special thanks to GeGe).
- Added grid layout reorganization when expanding the sidepanel to full view.

### Changed
- Technical refactoring and codebase improvements.

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
