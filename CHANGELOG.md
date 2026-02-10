# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project aims to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html) once releases are tagged.

## [Unreleased]

### Added
- Locked Pro-only topics (Intermediate/Advanced) on the Topics page for guest/free users (shows a lock badge and disables navigation).
- Route-level Pro-only gate on the topic page to prevent direct URL access without Pro.

### Changed
- Centralized topic access gating in `src/services/entitlements.js` via `getTopicGate()`.

### Fixed
- Prevented the “click into Pro-only then discover it’s locked” UX for free users.
