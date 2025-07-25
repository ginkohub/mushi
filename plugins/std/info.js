/**
 * Copyright (C) 2025 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import os from 'os';
import fs from 'fs';
import { execSync } from 'child_process';
import { formatBytes, formatElapse } from '../../src/tools.js';
import { MESSAGES_UPSERT } from '../../src/const.js';
import { eventNameIs, fromMe, midwareAnd, midwareOr } from '../../src/midware.js';
import { fromOwner } from '../settings.js';

function getDistro() {
  const platform = os.platform();
  if (platform === 'linux') {
    try {
      const osRelease = fs.readFileSync('/etc/os-release', 'utf8');
      const match = osRelease.match(/^PRETTY_NAME="(.+)"$/m);
      return match ? match[1] : os.release();
    } catch (e) {
      return os.release();
    }
  } else if (platform === 'freebsd') {
    try {
      return execSync('uname -v').toString().trim();
    } catch (e) {
      return os.release();
    }
  }
  return platform;
}

function getGpu() {
  const platform = os.platform();
  try {
    if (platform === 'linux') {
      const gpuInfo = execSync('lspci | grep -i "vga\\|3d\\|2d"').toString().trim();
      const gpuModel = gpuInfo.split(':').pop().trim();
      return gpuModel.split('[')[1].split(']')[0];
    } else if (platform === 'freebsd') {
      const gpuInfo = execSync("pciconf -lv | grep -B 4 -i 'vga'").toString();
      const match = gpuInfo.match(/device\s*=\s*'(.+)'/);
      return match ? match[1] : 'N/A';
    }
    return 'N/A';
  } catch (e) {
    return 'N/A';
  }
}

/** @type {import('../../src/plugin.js').Plugin} */
export default {
  cmd: ['info', 'i'],
  cat: 'system',
  tags: ['system'],
  desc: 'Show server information.',
  midware: midwareAnd(
    eventNameIs(MESSAGES_UPSERT),
    midwareOr(fromMe, fromOwner)
  ),

  exec: async (c) => {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memoryUsage = process.memoryUsage();
    const cpus = os.cpus();

    const infoText = `
*Server Information*

*OS*: ${getDistro()}
*Kernel*: ${os.release()} ${os.machine()}
*Uptime*: ${formatElapse(os.uptime() * 1000, ' ')}
*CPU*: ${cpus[0].model}
*CPU Cores*: ${cpus?.length} core(s) 
*GPU*: ${getGpu()}

*Memory*
*Used*: ${formatBytes(usedMem)}
*Free*: ${formatBytes(freeMem)}
*Total*: ${formatBytes(totalMem)}

*Node.js Information*
*Node.js*: ${process.version}
*Runtime*: ${formatElapse(process.uptime() * 1000, ' ')}s
*RSS*: ${formatBytes(memoryUsage.rss)}
*Heap Total*: ${formatBytes(memoryUsage.heapTotal)}
*Heap Used*: ${formatBytes(memoryUsage.heapUsed)}
*External*: ${formatBytes(memoryUsage.external)}
    `;

    return await c.reply({ text: infoText.trim() }, { quoted: c.event });
  }
};
