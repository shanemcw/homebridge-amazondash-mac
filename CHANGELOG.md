# Changelog

All notable changes to this project will be documented in this file.

## 4.0.0-beta.2 - 2026-09-16

### Fixed

- Find Linux monitor-mode inspection tools in standard administrative directories even when Homebridge's PATH omits them, preventing an unnecessary `tcpdump --monitor-mode` request for an interface already in monitor mode.

## 4.0.0-beta.1 - 2026-09-14

Homebridge 2 compatibility beta.

### Changed

- Promote the 4.0.0 Homebridge 2 compatibility work from alpha to beta.
- Update Express to `^4.22.3` and refresh the dependency lockfile.
- Rename the prerelease development branch to `release/4.0` and update CI accordingly.
- Retain the existing 3.x configuration and runtime behavior except for the documented 4.0 compatibility fixes.

### User action

- No configuration changes are required.

## 4.0.0-alpha.4 - 2026-09-13

Monitor-mode handling compatibility alpha.

### Changed

- Detect whether the configured WiFi interface is already in monitor mode using `iw`, with `iwconfig` as a fallback.
- Omit `tcpdump --monitor-mode` when the interface is already in monitor mode, avoiding libpcap mode-switch failures on otherwise working monitor interfaces.
- Preserve `--monitor-mode` when monitor mode is not detected so `tcpdump`/libpcap can still attempt to enable it.
- Replace the old generic tcpdump-bug diagnostic with guidance specific to monitor-mode setup.
- Clarify standalone tcpdump testing and retain `airodump-ng` as an alternate capture method.
- Add regression tests for monitor-mode detection and tcpdump argument selection.

### User action

- No configuration changes are required.
- Existing installations that preconfigure their WiFi interface in monitor mode should no longer need the `airodump-ng` workaround solely because `tcpdump --monitor-mode` reports that monitor mode is unsupported.
- Installations that rely on `tcpdump` to request monitor mode continue to use `--monitor-mode` when the interface is not already reported as monitor mode.

## 4.0.0-alpha.3 - 2026-09-13

Runtime correctness and shutdown lifecycle alpha.

### Changed

- Preserve `debug: 0` instead of replacing it with the default debug level.
- Remove and unregister accessories regardless of the configured debug level.
- Guard tcpdump listening-message parsing when an interface match is not present.
- Listen for Homebridge shutdown, stop the active capture process, clear pending restart timers, and prevent capture respawn after shutdown begins.
- Added regression tests for debug level zero, accessory removal, malformed listening output, shutdown cleanup, and capture restart prevention.

### User action

- No configuration changes are required.
- `debug: 0` once again behaves as an explicit silent debug selection.
- Capture restart behavior is unchanged during normal runtime; automatic restart is only suppressed during Homebridge shutdown.

## 4.0.0-alpha.2 - 2026-09-12

tcpdump source-address parsing fix.

### Changed

- Prefer the `SA:` source address when tcpdump labels multiple MAC addresses on a captured packet.
- Preserve the existing first-MAC fallback when tcpdump does not provide an `SA:` label.
- Keep `airodump-ng` parsing on the existing first-MAC behavior.
- Added regression tests for tcpdump source-address selection, tcpdump fallback behavior, and the `airodump-ng` parsing path.
- Corrected the Jammy Jellyfish troubleshooting note to identify the tested Panda adapter as PAU06.

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
