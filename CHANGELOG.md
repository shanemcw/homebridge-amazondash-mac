# Changelog

All notable changes to this project will be documented in this file.

This project uses semantic versioning. Prerelease builds are published to npm with the `alpha` tag while modernization work is in progress.

## Unreleased

### Planned

- Add automated tests and CI coverage.
- Continue Homebridge 2 modernization in small, testable increments.

## 4.0.0-alpha.0 - 2026-09-12

### Changed

- Added Homebridge 2 compatibility by removing use of the removed `PlatformAccessory.reachable` property.
- Updated the supported Homebridge engine range to `^1.6.0 || ^2.0.0`.
- Updated the supported Node.js engine range to `^22.12.0 || ^24.0.0`.

### Notes

- This alpha intentionally keeps the existing CommonJS plugin structure.
- Structural refactoring, dependency modernization, test coverage, CI modernization, web API hardening, and unrelated bug fixes are deferred to later alpha releases.
