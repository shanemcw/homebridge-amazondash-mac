'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const initialize = require('../index');

const targetMAC = '11:22:33:44:55:66';
const otherMAC = 'AA:BB:CC:DD:EE:FF';
const makeUUID = value => crypto.createHash('sha1').update(value).digest('hex');

class TestAccessory {
  constructor(name, uuid) {
    this.displayName = name;
    this.UUID = uuid;
    this.context = {};
    this.services = new Map();
    this.addService('AccessoryInformation');
  }

  addService(type) {
    const characteristics = new Map();
    const service = {
      setCharacteristic() { return service; },
      getCharacteristic(name) {
        if (!characteristics.has(name)) {
          const characteristic = {
            props: {},
            events: [],
            setProps(props) { Object.assign(this.props, props); return this; },
            setValue(value) { this.events.push(value); return this; }
          };
          characteristics.set(name, characteristic);
        }
        return characteristics.get(name);
      }
    };
    this.services.set(type, service);
    return service;
  }

  getService(type) { return this.services.get(type); }
}

function makePlatform(buttons, debug = 1) {
  let Platform;
  initialize({
    platformAccessory: TestAccessory,
    hap: {
      Service: { AccessoryInformation: 'AccessoryInformation', StatelessProgrammableSwitch: 'StatelessProgrammableSwitch' },
      Characteristic: {
        Manufacturer: 'Manufacturer', Model: 'Model', FirmwareRevision: 'FirmwareRevision',
        SerialNumber: 'SerialNumber', ProgrammableSwitchEvent: 'ProgrammableSwitchEvent'
      },
      uuid: { generate: makeUUID }
    },
    registerPlatform(plugin, name, constructor) { Platform = constructor; }
  });
  const registrations = [];
  const removals = [];
  const messages = [];
  const api = {
    on() {},
    registerPlatformAccessories(plugin, name, accessories) { registrations.push(...accessories); },
    unregisterPlatformAccessories(plugin, name, accessories) { removals.push(...accessories); }
  };
  const platform = new Platform(message => messages.push(message), { interface: 'test0', debug, buttons }, api);
  platform.spawnDump = () => {};
  return { platform, registrations, removals, messages };
}

function makeCachedAccessory(mac = targetMAC, revision, doublePress = false) {
  const initial = makePlatform([{ name: 'Existing Button', MAC: mac, doublePress, homeKitRevision: revision }]);
  initial.platform.didFinishLaunching();
  return initial.platform.accessories[mac];
}

function pressCharacteristic(accessory) {
  return accessory.getService('StatelessProgrammableSwitch').getCharacteristic('ProgrammableSwitchEvent');
}

test('preserves legacy identities and treats omitted doublePress as false', () => {
  const cached = makeCachedAccessory();
  delete cached.context.homeKitRevision;
  const current = makePlatform([{ name: 'Existing Button', MAC: targetMAC, homeKitRevision: 0 }]);
  current.platform.configureAccessory(cached);
  current.platform.didFinishLaunching();

  assert.equal(cached.UUID, makeUUID(targetMAC));
  assert.equal(current.platform.accessories[targetMAC], cached);
  assert.deepEqual(current.registrations, []);
  assert.deepEqual(current.removals, []);
});

test('refreshes only the requested button and publishes its new press capabilities', () => {
  const cached = makeCachedAccessory();
  const other = makeCachedAccessory(otherMAC);
  const current = makePlatform([
    { name: 'Existing Button', MAC: targetMAC, doublePress: true, homeKitRevision: 1, alias: ['aabbccddeeee'] },
    { name: 'Other Button', MAC: otherMAC, doublePress: false }
  ]);
  current.platform.configureAccessory(cached);
  current.platform.configureAccessory(other);
  current.platform.didFinishLaunching();
  const replacement = current.platform.accessories[targetMAC];

  assert.notEqual(replacement.UUID, cached.UUID);
  assert.deepEqual(current.removals, [cached]);
  assert.deepEqual(current.registrations, [replacement]);
  assert.equal(current.platform.accessories[otherMAC], other);
  assert.equal(replacement.context.homeKitRevision, 1);
  assert.equal(replacement.context.doublePress, true);
  assert.equal(current.platform.alias['AA:BB:CC:DD:EE:EE'], targetMAC);
  assert.deepEqual(pressCharacteristic(replacement).props.validValues, [0, 1]);
  assert.equal(pressCharacteristic(replacement).props.maxValue, 1);
  assert.ok(current.messages.some(message => /Apple Home.*room.*press actions/i.test(message)));

  current.platform.dashEventWithAccessory(current.platform, replacement);
  current.platform.dashEventWithAccessory(current.platform, replacement);
  assert.deepEqual(pressCharacteristic(replacement).events, [0, 1]);
});

test('preserves a refreshed identity on ordinary restart and cache recreation', () => {
  const button = { name: 'Existing Button', MAC: targetMAC, doublePress: true, homeKitRevision: 1 };
  const first = makePlatform([{ ...button }]);
  first.platform.didFinishLaunching();
  const accessory = first.platform.accessories[targetMAC];
  const restarted = makePlatform([{ ...button }]);
  restarted.platform.configureAccessory(accessory);
  restarted.platform.didFinishLaunching();
  const withoutCache = makePlatform([{ ...button }]);
  withoutCache.platform.didFinishLaunching();

  assert.deepEqual(restarted.registrations, []);
  assert.deepEqual(restarted.removals, []);
  assert.equal(restarted.platform.accessories[targetMAC].UUID, accessory.UUID);
  assert.equal(withoutCache.platform.accessories[targetMAC].UUID, accessory.UUID);
});

test('a second revision produces another identity when disabling Double Press', () => {
  const cached = makeCachedAccessory(targetMAC, 1, true);
  const current = makePlatform([{ name: 'Existing Button', MAC: targetMAC, doublePress: false, homeKitRevision: 2 }]);
  current.platform.configureAccessory(cached);
  current.platform.didFinishLaunching();
  const replacement = current.platform.accessories[targetMAC];

  assert.notEqual(replacement.UUID, cached.UUID);
  assert.notEqual(replacement.UUID, makeUUID(targetMAC));
  assert.equal(replacement.context.homeKitRevision, 2);
  assert.equal(pressCharacteristic(replacement).props.maxValue, 0);
});

test('changing press options alone retains the existing HomeKit identity', () => {
  const cached = makeCachedAccessory(targetMAC, 1);
  const current = makePlatform([{ name: 'Existing Button', MAC: targetMAC, doublePress: true, homeKitRevision: 1 }]);
  current.platform.configureAccessory(cached);
  current.platform.didFinishLaunching();

  assert.equal(current.platform.accessories[targetMAC].UUID, cached.UUID);
  assert.deepEqual(pressCharacteristic(current.platform.accessories[targetMAC]).props.validValues, [0, 1]);
});

test('reports reassignment even when ordinary runtime messages are disabled', () => {
  const cached = makeCachedAccessory();
  const current = makePlatform([{ name: 'Existing Button', MAC: targetMAC, homeKitRevision: 1 }], 0);
  current.platform.configureAccessory(cached);
  current.platform.didFinishLaunching();

  assert.ok(current.messages.some(message => /Apple Home.*room.*press actions/i.test(message)));
});

test('rejects invalid revisions before removing an existing button', async t => {
  for (const revision of [-1, 1.5, '1', true, Number.MAX_SAFE_INTEGER + 1]) {
    await t.test(String(revision), () => {
      const cached = makeCachedAccessory();
      const current = makePlatform([{ name: 'Existing Button', MAC: targetMAC, homeKitRevision: revision }]);
      current.platform.configureAccessory(cached);
      current.platform.didFinishLaunching();

      assert.equal(current.platform.accessories[targetMAC], cached);
      assert.deepEqual(current.removals, []);
      assert.deepEqual(current.registrations, []);
      assert.ok(current.messages.some(message => /revision.*integer/i.test(message)));
    });
  }
});

test('direct accessory creation also validates revision values', () => {
  const current = makePlatform([]);
  current.platform.addAccessory({ name: 'Bad Revision', MAC: targetMAC, homeKitRevision: -1 });

  assert.deepEqual(current.registrations, []);
  assert.equal(current.platform.accessories[targetMAC], undefined);
});
