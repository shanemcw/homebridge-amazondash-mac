# Changelog

All notable changes to this project will be documented in this file.

## 4.0.0-alpha.2 - 2026-09-12

tcpdump source-address parsing fix.

### Changed

- Prefer the `SA:` source address when tcpdump labels multiple MAC addresses on a captured packet.
- Preserve the existing first-MAC fallback when tcpdump does not provide an `SA:` label.
- Keep `airodump-ng` parsing on the existing first-MAC behavior.
- Added regression tests for tcpdump source-address selection, tcpdump fallback behavior, and the `airodump-ng` parsing path.

### User action

- No configuration changes are required.
- Existing button and alias configuration remains unchanged.
- `airodump-ng` remains supported as the alternate capture method for environments where tcpdump is not usable.

## 4.0.0-alpha.1 - 2026-09-12

Testing and CI foundation alpha.

### Changed

- Added automated tests using the built-in Node.js test runner.
- Added initial coverage for Homebridge platform registration and alias MAC address normalization.
- Added GitHub Actions test coverage for Node.js 22 and 24.

### User action

- No configuration changes are required.
- Runtime behavior is unchanged from `4.0.0-alpha.0`.

## 4.0.0-alpha.0 - 2026-09-12

Homebridge 2 compatibility alpha.

### Changed

- Added compatibility with Homebridge 2.
- Removed use of the `PlatformAccessory.reachable` property, which was removed in Homebridge 2.
- Updated the supported Homebridge engine range to `^1.6.0 || ^2.0.0`.
- Updated the supported Node.js engine range to `^22.12.0 || ^24.0.0`.

### User action

- No configuration changes are required.
