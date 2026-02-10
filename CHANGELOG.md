# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project aims to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html) once releases are tagged.

## [Unreleased]

### Added
- Locked Pro-only topics (Intermediate/Advanced) on the Topics page for guest/free users (shows a lock badge and disables navigation).
- Route-level Pro-only gate on the topic page to prevent direct URL access without Pro.
- Difficulty filter on the Topics page: All / Beginner / Intermediate / Advanced (persisted in the URL via `?difficulty=` for shareable links).
- Topics page redesigned with a minimal sticky filter bar (Search + Category + Subcategory + Difficulty + Status + Reset) for a cleaner desktop/mobile experience.
- Multiple lesson presentation styles for story-based lessons (Focus/Dark/Cards/Split/Minimal/Bold), with a preference selector in the profile.
- Added additional Pro-only lesson presentation styles: Paper / Terminal / Glass.
- In-lesson presentation style switcher (available from lesson/review top bars).
- Journey-level presentation protocol (`journey.protocol.presentation`) to define default and supported presentation styles.

### Changed
- Topics page polish: headline uses “1-minute”, Status labels are clearer (“To watch”/“Watched”), and the sticky filter bar now stays fully visible under the sticky header.
- Centralized topic access gating in `src/services/entitlements.js` via `getTopicGate()`.
- Presentation-style entitlements: Guest + Free users can choose Focus + Dark; other styles are marked Pro-only.
- Pricing page updated to include lesson presentation styles and remove redundant Free-plan copy.

### Fixed
- Prevented the “click into Pro-only then discover it’s locked” UX for free users.
- Dark (Spotlight) style: review-mode navigation bar is now visible.
- Split (Visual + Text) style: improved alignment and reduced layout/scroll issues on long-content modules.
- Split (Visual + Text) style: removed the thin vertical gutter line.
