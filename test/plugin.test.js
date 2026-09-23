'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const initialize = require('../index');

function loadPlatform() {
  let Platform;

  const homebridge = {
    platformAccessory: function PlatformAccessory() {},
    hap: {
      Service: {
        AccessoryInformation: 'AccessoryInformation',
        StatelessProgrammableSwitch: 'StatelessProgrammableSwitch'
      },
      Characteristic: {
        Manufacturer: 'Manufacturer',
        Model: 'Model',
        FirmwareRevision: 'FirmwareRevision',
        SerialNumber: 'SerialNumber',
        ProgrammableSwitchEvent: 'ProgrammableSwitchEvent'
      },
      uuid: {
        generate(value) {
          return value;
        }
      }
    },
    registerPlatform(pluginName, platformName, platformConstructor, dynamic) {
      assert.equal(pluginName, 'homebridge-amazondash-mac');
      assert.equal(platformName, 'AmazonDash-MAC');
      assert.equal(dynamic, true);
      Platform = platformConstructor;
    }
  };

  initialize(homebridge);
  assert.equal(typeof Platform, 'function');
  return Platform;
}

function makeAccessory(alias) {
  const characteristic = {
    setProps() {
      return characteristic;
    }
  };

  const service = {
    setCharacteristic() {
      return service;
    },
    getCharacteristic() {
      return characteristic;
    }
  };

  return {
    displayName: 'Test Button',
    context: {
      mac: '11:22:33:44:55:66',
      alias,
      doublePress: false,
      model: 'test-model',
      firmware: 'test-firmware',
      serial: 'test-serial'
    },
    getService() {
      return service;
    }
  };
}

function makePacketPlatform(dumpname = 'tcpdump') {
  const Platform = loadPlatform();
  const api = { on() {} };
  const platform = new Platform(() => {}, { debug: 1 }, api);
  const accessory = {
    displayName: 'Packet Test Button',
    context: {
      lastTriggered: null
    }
  };

  platform.dumpname = dumpname;
  platform.accessories['AA:BB:CC:DD:EE:FF'] = accessory;
  platform.alias['AA:BB:CC:DD:EE:FF'] = 'AA:BB:CC:DD:EE:FF';

  return { platform, accessory };
}

test('registers as the expected dynamic Homebridge platform', () => {
  loadPlatform();
});

test('normalizes configured alias MAC addresses', () => {
  const Platform = loadPlatform();
  const api = { on() {} };
  const platform = new Platform(() => {}, { debug: 1 }, api);
  const accessory = makeAccessory(['aabbccddeeff', 'AA:BB:CC:DD:EE:01']);

  platform.configureAccessory(accessory);

  assert.equal(platform.alias['11:22:33:44:55:66'], '11:22:33:44:55:66');
  assert.equal(platform.alias['AA:BB:CC:DD:EE:FF'], '11:22:33:44:55:66');
  assert.equal(platform.alias['AA:BB:CC:DD:EE:01'], '11:22:33:44:55:66');
});

test('preserves debug level zero and defaults missing debug to one', () => {
  const Platform = loadPlatform();
  const api = { on() {} };
  const silentPlatform = new Platform(() => {}, { debug: 0 }, api);
  const defaultPlatform = new Platform(() => {}, {}, api);

  assert.equal(silentPlatform.debug, 0);
  assert.equal(defaultPlatform.debug, 1);
});

test('removes accessories even when debug level is zero', () => {
  const Platform = loadPlatform();
  let unregistered = null;
  let logCount = 0;
  const api = {
    on() {},
    unregisterPlatformAccessories(pluginName, platformName, accessories) {
      assert.equal(pluginName, 'homebridge-amazondash-mac');
      assert.equal(platformName, 'AmazonDash-MAC');
      unregistered = accessories;
    }
  };
  const platform = new Platform(() => { logCount++; }, { debug: 0 }, api);
  const accessory = {
    displayName: 'Silent Button',
    context: {
      mac: 'AA:BB:CC:DD:EE:FF'
    }
  };

  platform.accessories[accessory.context.mac] = accessory;
  platform.removeAccessory(accessory);

  assert.deepEqual(unregistered, [accessory]);
  assert.equal(platform.accessories[accessory.context.mac], undefined);
  assert.equal(logCount, 0);
});

test('handles listening output that does not contain an interface match', () => {
  const Platform = loadPlatform();
  const messages = [];
  const api = { on() {} };
  const platform = new Platform((message) => { messages.push(message); }, { debug: 1 }, api);

  platform.dumpname = 'tcpdump';

  assert.doesNotThrow(() => {
    platform.handleError(platform, 'listening without interface details');
  });
  assert.equal(messages.length, 1);
});

test('handles Homebridge shutdown and clears pending capture restart', () => {
  const Platform = loadPlatform();
  let shutdownHandler = null;
  let killed = false;
  const api = {
    on(event, listener) {
      if (event === 'shutdown') {
        shutdownHandler = listener;
      }
    }
  };
  const platform = new Platform(() => {}, { debug: 1 }, api);

  platform.restartTimer = setTimeout(() => {}, 60000);
  platform.wifidump = {
    killed: false,
    kill() {
      this.killed = true;
      killed = true;
    }
  };

  assert.equal(typeof shutdownHandler, 'function');
  shutdownHandler();

  assert.equal(platform.shuttingDown, true);
  assert.equal(platform.restartTimer, null);
  assert.equal(killed, true);
});

test('does not spawn a capture process after shutdown begins', () => {
  const Platform = loadPlatform();
  const api = { on() {} };
  const platform = new Platform(() => {}, { debug: 1 }, api);

  platform.shuttingDown = true;

  assert.doesNotThrow(() => {
    platform.spawnDump(platform);
  });
  assert.equal(platform.wifidump, null);
});

test('does not restart tcpdump after a fatal monitor-mode error', () => {
  const Platform = loadPlatform();
  const messages = [];
  const api = { on() {} };
  const platform = new Platform((message) => { messages.push(message); }, { interface: 'wlan0', debug: 1 }, api);

  platform.dumpname = 'tcpdump';
  platform.handleError(platform, "wlan0: That device doesn't support monitor mode");
  platform.scheduleDumpRestart(platform);

  assert.equal(platform.captureRestartBlocked, true);
  assert.equal(platform.restartTimer, null);
  assert.ok(messages.some((message) => /not restarting tcpdump after a fatal capture error/.test(message)));
});

test('keeps restart behavior for transient capture exits', () => {
  const Platform = loadPlatform();
  const api = { on() {} };
  const platform = new Platform(() => {}, { interface: 'wlan0', debug: 1 }, api);

  platform.dumpname = 'tcpdump';
  platform.spawnDump = () => {};
  platform.scheduleDumpRestart(platform);

  assert.notEqual(platform.restartTimer, null);
  platform.handleShutdown();
  assert.equal(platform.restartTimer, null);
});

test('recognizes the alternate tcpdump monitor-mode failure wording', () => {
  const Platform = loadPlatform();
  const api = { on() {} };
  const platform = new Platform(() => {}, { interface: 'wlan0', debug: 1 }, api);

  platform.dumpname = 'tcpdump';
  platform.handleError(platform, 'wlan0: This device does not support monitor mode');

  assert.equal(platform.captureRestartBlocked, true);
});

test('detects monitor mode from iw without requiring iwconfig', () => {
  const Platform = loadPlatform();
  const api = { on() {} };
  const platform = new Platform(() => {}, { debug: 1 }, api);
  const commands = [];

  platform.commandOutput = (command) => {
    commands.push(command);
    return command === 'iw' ? 'Interface wlan0\n\ttype monitor\n' : '';
  };

  assert.equal(platform.interfaceIsMonitor('wlan0'), true);
  assert.deepEqual(commands, ['iw']);
});

test('falls back to iwconfig when iw does not report monitor mode', () => {
  const Platform = loadPlatform();
  const api = { on() {} };
  const platform = new Platform(() => {}, { debug: 1 }, api);
  const commands = [];

  platform.commandOutput = (command) => {
    commands.push(command);
    return command === 'iwconfig' ? 'wlan0  IEEE 802.11  Mode:Monitor' : '';
  };

  assert.equal(platform.interfaceIsMonitor('wlan0'), true);
  assert.deepEqual(commands, ['iw', 'iwconfig']);
});

test('omits tcpdump monitor-mode request when interface is already in monitor mode', () => {
  const Platform = loadPlatform();
  const api = { on() {} };
  const platform = new Platform(() => {}, { interface: 'wlan0', debug: 1 }, api);

  platform.dumpname = 'tcpdump';
  platform.interfaceIsMonitor = () => true;

  const args = platform.tcpdumpArgs(platform);

  assert.equal(args.includes('--monitor-mode'), false);
  assert.deepEqual(args.slice(0, 4), ['tcpdump', '-i', 'wlan0', '--immediate-mode']);
});

test('keeps tcpdump monitor-mode request when interface is not already in monitor mode', () => {
  const Platform = loadPlatform();
  const api = { on() {} };
  const platform = new Platform(() => {}, { interface: 'wlan0', debug: 1 }, api);

  platform.dumpname = 'tcpdump';
  platform.interfaceIsMonitor = () => false;

  const args = platform.tcpdumpArgs(platform);

  assert.equal(args.includes('--monitor-mode'), true);
});

test('prefers tcpdump SA address when BSSID appears first', () => {
  const { platform, accessory } = makePacketPlatform('tcpdump');
  let triggered = null;

  platform.dashEventWithAccessory = (self, currentAccessory) => {
    triggered = currentAccessory;
  };

  platform.handleOutput(
    platform,
    'BSSID:11:22:33:44:55:66 SA:AA:BB:CC:DD:EE:FF DA:FF:FF:FF:FF:FF:FF'
  );

  assert.equal(triggered, accessory);
});

test('falls back to first MAC address when tcpdump SA label is absent', () => {
  const { platform, accessory } = makePacketPlatform('tcpdump');
  let triggered = null;

  platform.dashEventWithAccessory = (self, currentAccessory) => {
    triggered = currentAccessory;
  };

  platform.handleOutput(
    platform,
    'AA:BB:CC:DD:EE:FF > 11:22:33:44:55:66 broadcast packet'
  );

  assert.equal(triggered, accessory);
});

test('keeps first-MAC parsing for airodump-ng', () => {
  const { platform, accessory } = makePacketPlatform('airodump-ng');
  let triggered = null;

  platform.dashEventWithAccessory = (self, currentAccessory) => {
    triggered = currentAccessory;
  };

  platform.handleOutput(
    platform,
    'AA:BB:CC:DD:EE:FF 11:22:33:44:55:66 wireless packet'
  );

  assert.equal(triggered, accessory);
});


test('detects monitor mode with administrative tools outside the service PATH', () => {
  const fs = require('node:fs');
  const vm = require('node:vm');
  const source = fs.readFileSync(require.resolve('../index'), 'utf8');

  for (const tool of ['iw', 'iwconfig']) {
    for (const servicePATH of ['/opt/homebridge/bin:/usr/bin:/bin', undefined]) {
      const originalEnv = { TEST_SENTINEL: 'preserved' };
      if (servicePATH !== undefined) { originalEnv.PATH = servicePATH; }
      const sandbox = {
        module: { exports: {} },
        process: { platform: 'linux', env: originalEnv },
        require(name) {
          if (name !== 'child_process') { return require(name); }
          return {
            spawnSync(command, args, options) {
              const childEnv = options.env || originalEnv;
              assert.equal(childEnv.TEST_SENTINEL, 'preserved');
              assert.equal(originalEnv.PATH, servicePATH);
              const paths = (childEnv.PATH || '').split(':').filter(Boolean);
              if (servicePATH) { assert.ok(childEnv.PATH.startsWith(servicePATH)); }
              if (command !== tool || !paths.includes('/usr/sbin')) {
                return { error: { code: 'ENOENT' }, status: null };
                }
              assert.equal(args.includes('wlan0'), true);
              return { status: 0, stdout: tool === 'iw' ? 'type monitor' : 'Mode:Monitor' };
              }
            };
          }
        };
      vm.runInNewContext(source, sandbox);
      const platform = new sandbox.DashPlatform(() => {}, { interface: 'wlan0' });
      platform.dumpname = 'tcpdump';
      assert.equal(platform.tcpdumpArgs(platform).includes('--monitor-mode'), false);
      }
    }
});
