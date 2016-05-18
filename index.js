var spawn = require('child_process').spawn;
var airodump;
var Accessory, Service, Characteristic, UUIDGen;

module.exports = function(homebridge) {
  Accessory = homebridge.platformAccessory;
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  UUIDGen = homebridge.hap.uuid;

  homebridge.registerPlatform("homebridge-AmazonDash-NG-ng", "AmazonDash-NG-NG", DashPlatform, true);
}

function DashPlatform(log, config, api) {
  var self = this;

  self.log = log;
  self.config = config || { "platform": "AmazonDash-NG-NG" };
  self.buttons = self.config.buttons || [];

  self.accessories = {}; // MAC -> Accessory

  if (api) {
    self.api = api;

    self.api.on('didFinishLaunching', self.didFinishLaunching.bind(this));
  }
}

DashPlatform.prototype.configureAccessory = function(accessory) {
  var self = this;

  accessory.reachable = true;
  accessory
    .getService(Service.StatelessProgrammableSwitch)
    .getCharacteristic(Characteristic.ProgrammableSwitchEvent)
    .setValue(0);

  var accessoryMAC = accessory.context.mac;
  self.accessories[accessoryMAC] = accessory;
}

DashPlatform.prototype.didFinishLaunching = function() {
  var self = this;

  for (var i in self.buttons) {
    var button = self.buttons[i];
    if (!self.accessories[button.mac]) {
      self.addAccessory(button.mac, button.name);
    }
  }

  var registedMACs = Object.keys(self.accessories);
  if (registedMACs.length > 0) {
    self.log("Starting airodump with if:" + self.config.interface + " on channel: " + self.config.channel);
    
    self.airodump = spawn('airodump-ng', [self.config.interface, '--channel', self.config.channel, '--berlin', 1]);
    airodump.stdout.on('data', self.handleOutput);
	  airodump.stderr.on('data', self.handleOutput);
		airodump.on('close', function(code) { self.log('Process ended. Code: ' + code); });
      
    self.log("airodump started.")
  }
}

DashPlatform.prototype.handleOutput = function(data) {
  var self = this;
  
  //split lines
  var lines = ('' + data).match(/[^\r\n]+/g);
  for (line in lines) {
      //clean out the linux control chars
      line = lines[line].replace(/[\x00-\x1F\x7F-\x9F]/g, '').toLowerCase();
      
      //filter out mac addresses, only take the first occurence per line
      var matches = /((?:[\dA-Fa-f]{2}\:){5}(?:[\dA-Fa-f]{2}))/.exec(line); // << includes all mac addresses
      if (matches != null && matches.length > 0) {
          //log(module.name, "STDOUT: '" + matches[1] + "'"); //for debugging
          var accessory = self.accessories[matches[1]];
          if (accessory) { self.dashEventWithAccessory(accessory); }
      }
  }
}

DashPlatform.prototype.dashEventWithAccessory = function(accessory) {
  var targetChar = accessory
    .getService(Service.StatelessProgrammableSwitch)
    .getCharacteristic(Characteristic.ProgrammableSwitchEvent);

  targetChar.setValue(1);
  setTimeout(function(){targetChar.setValue(0);}, 10000);
}

DashPlatform.prototype.addAccessory = function(mac, name) {
  /*var self = this;
  var uuid = UUIDGen.generate(mac);

  var newAccessory = new Accessory(name, uuid, 15);
  newAccessory.reachable = true;
  newAccessory.context.mac = mac;
  newAccessory.addService(Service.StatelessProgrammableSwitch, name);
  newAccessory
    .getService(Service.AccessoryInformation)
    .setCharacteristic(Characteristic.Manufacturer, "Amazon")
    .setCharacteristic(Characteristic.Model, "JK76PL")
    .setCharacteristic(Characteristic.SerialNumber, mac);

  this.accessories[mac] = newAccessory;
  this.api.registerPlatformAccessories("homebridge-AmazonDash-NG", "AmazonDash-NG", [newAccessory]);

  var dashButton = dash_button(mac);
  dashButton.on('detected', function() {
    self.dashEventWithAccessory(newAccessory);
  });*/
}

DashPlatform.prototype.removeAccessory = function(accessory) {
  if (accessory) {
    var mac = accessory.context.mac;
    this.api.unregisterPlatformAccessories("homebridge-AmazonDash-NG", "AmazonDash-NG", [accessory]);
    delete this.accessories[mac];
  }
}

DashPlatform.prototype.configurationRequestHandler = function(context, request, callback) {
  if (request && request.type === "Terminate") {
    return;
  }

  if (!context.step) {
    var instructionResp = {
      "type": "Interface",
      "interface": "instruction",
      "title": "Before You Start...",
      "detail": "Please make sure homebridge is running with elevated privileges and you have setup the dependency follow the tutorial.",
      "showNextButton": true,
      "buttonText": "View Tutorial",
      "actionURL": "https://github.com/hortinstein/node-dash-button"
    }

    context.step = 1;
    callback(instructionResp);
  } else {
    switch (context.step) {
      case 1:
        var respDict = {
          "type": "Interface",
          "interface": "list",
          "title": "What do you want to do?",
          "items": [
            "Add New Dash Button",
            "Disassociate Existed Dash Button"
          ]
        }
        context.step = 2;
        callback(respDict);
        break;
      case 2:
        var selection = request.response.selections[0];
        if (selection === 0) {
          //Setup New
          var respDict = {
            "type": "Interface",
            "interface": "input",
            "title": "New Dash Button",
            "items": [
              {
              "id": "name",
              "title": "Name",
              "placeholder": "Orange Dash"
              }, 
              {
              "id": "mac",
              "title": "MAC Address (lowercase)",
              "placeholder": "11:22:33:44:aa:ff"
              }
            ]
          }
          context.step = 4;
          callback(respDict);
        } else {
          //Remove Exist
          var self = this;
          var buttons = Object.keys(this.accessories).map(function(k){return self.accessories[k]});
          var names = buttons.map(function(k){return k.displayName});

          var respDict = {
            "type": "Interface",
            "interface": "list",
            "title": "Which Dash Button do you want to remove?",
            "items": names
          }
          context.buttons = buttons;
          context.step = 6;
          callback(respDict);
        }
        break;
      case 4:
        var userInputs = request.response.inputs;
        var name = userInputs.name;
        var MACAddress = userInputs.mac;
        this.addAccessory(MACAddress, name);
        var respDict = {
          "type": "Interface",
          "interface": "instruction",
          "title": "Success",
          "detail": "The new dash button is now added.",
          "showNextButton": true
        }
        context.step = 5;
        callback(respDict);
        break;
      case 5:
        var self = this;
        delete context.step;
        var newConfig = this.config;
        var newButtons = Object.keys(this.accessories).map(function(k){
          var accessory = self.accessories[k];
          var button = {
            'name': accessory.displayName,
            'mac': accessory.context.mac
          };
          return button;
        });
        newConfig.buttons = newButtons;

        callback(null, "platform", true, newConfig);
        break;
      case 6:
        var selection = request.response.selections[0];
        var accessory = context.buttons[selection];
        this.removeAccessory(accessory);
        var respDict = {
          "type": "Interface",
          "interface": "instruction",
          "title": "Success",
          "detail": "The dash button is now removed.",
          "showNextButton": true
        }
        context.step = 5;
        callback(respDict);
        break;
    }
  }
}
