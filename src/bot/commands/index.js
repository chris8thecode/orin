import {
  kickCommand,
  promoteCommand,
  demoteCommand,
  muteCommand,
  unmuteCommand,
  groupInfoCommand,
  genkeyCommand,
} from './admin/index.js';
import { menuCommand } from './general/menu.js';
import { pingCommand } from './general/ping.js';
import { speedtestCommand } from './general/speedTest.js';
import { infoCommand, runtimeCommand } from './general/info.js';

const commands = new Map();

const allCommands = [
  menuCommand,
  pingCommand,
  speedtestCommand,
  infoCommand,
  runtimeCommand,
  kickCommand,
  promoteCommand,
  demoteCommand,
  muteCommand,
  unmuteCommand,
  groupInfoCommand,
  genkeyCommand,
];

allCommands.forEach((cmd) => {
  commands.set(cmd.name.toLowerCase(), cmd);
  cmd.aliases?.forEach((alias) => {
    commands.set(alias.toLowerCase(), cmd);
  });
});

export function getCommand(name) {
  return commands.get(name.toLowerCase());
}

export function getAllCommands() {
  return allCommands;
}
