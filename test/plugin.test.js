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
