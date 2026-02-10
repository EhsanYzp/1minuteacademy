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

### Changed
- Topics page polish: headline uses “1-minute”, Status labels are clearer (“To watch”/“Watched”), and the sticky filter bar now stays fully visible under the sticky header.
- Centralized topic access gating in `src/services/entitlements.js` via `getTopicGate()`.

### Fixed
- Prevented the “click into Pro-only then discover it’s locked” UX for free users.
