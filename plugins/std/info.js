/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import { MESSAGES_UPSERT } from "../../src/const.js";
import { Role } from "../../src/roles.js";
import { formatBytes, formatElapse, isBun, isDeno } from "../../src/tools.js";
import { translate } from "../../src/translate.js";

const t = translate({
  en: {
    server_info: "Server Information",
    os: "OS",
    kernel: "Kernel",
    uptime: "Uptime",
    cpu: "CPU",
    cpu_cores: "CPU Cores",
    gpu: "GPU",
    memory: "Memory",
    used: "Used",
    free: "Free",
    total: "Total",
    runtime_info: "Runtime Information",
    runtime: "Runtime",
    running: "Running",
    rss: "RSS",
    heap_total: "Heap Total",
    heap_used: "Heap Used",
    external: "External",
    cores_val: "{val} core(s)",
  },
  id: {
    server_info: "Informasi Server",
    os: "OS",
    kernel: "Kernel",
    uptime: "Waktu Aktif",
    cpu: "CPU",
    cpu_cores: "Inti CPU",
    gpu: "GPU",
    memory: "Memori",
    used: "Digunakan",
    free: "Tersedia",
    total: "Total",
    runtime_info: "Informasi Runtime",
    runtime: "Runtime",
    running: "Berjalan",
    rss: "RSS",
    heap_total: "Total Heap",
    heap_used: "Heap Terpakai",
    external: "Eksternal",
    cores_val: "{val} inti",
  },
});

function getDistro() {
  const platform = os.platform();
  if (platform === "linux") {
    try {
      const osRelease = fs.readFileSync("/etc/os-release", "utf8");
      const match = osRelease.match(/^PRETTY_NAME="(.+)"$/m);
      return match ? match[1] : os.release();
    } catch {
      return os.release();
    }
  } else if (platform === "freebsd") {
    try {
      return execSync("uname -v").toString().trim();
    } catch {
      return os.release();
    }
  }
  return platform;
}

function getGpu() {
  const platform = os.platform();
  try {
    if (platform === "linux") {
      const gpuInfo = execSync('lspci | grep -i "vga\\|3d\\|2d"')
        .toString()
        .trim();
      const gpuModel = gpuInfo.split(":").pop().trim();
      return gpuModel.split("[")[1].split("]")[0];
    } else if (platform === "freebsd") {
      const gpuInfo = execSync("pciconf -lv | grep -B 4 -i 'vga'").toString();
      const match = gpuInfo.match(/device\s*=\s*'(.+)'/);
      return match ? match[1] : "N/A";
    }
    return "N/A";
  } catch {
    return "N/A";
  }
}

/** @type {import('../../src/plugin.js').Plugin} */
export default {
  cmd: ["info", "i"],
  cat: "system",
  tags: ["system"],
  desc: "Show server information.",
  events: [MESSAGES_UPSERT],
  roles: [Role.USER],
  exec: async (c) => {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memoryUsage = process.memoryUsage();
    const cpus = os.cpus();

    const runtime = isBun
      ? {
          name: "Bun",
          version: Bun.version,
        }
      : isDeno
        ? {
            name: "Deno",
            version: Deno.version.deno,
          }
        : {
            name: "NodeJS",
            version: process.version,
          };

    const infoText = `
*${t("server_info", {}, c)}*

*${t("os", {}, c)}*: ${getDistro()}
*${t("kernel", {}, c)}*: ${os.release()} ${os.machine()}
*${t("uptime", {}, c)}*: ${formatElapse(os.uptime() * 1000, " ")}
*${t("cpu", {}, c)}*: ${cpus[0].model}
*${t("cpu_cores", {}, c)}*: ${t("cores_val", { val: cpus?.length }, c)}
*${t("gpu", {}, c)}*: ${getGpu()}

*${t("memory", {}, c)}*
*${t("used", {}, c)}*: ${formatBytes(usedMem)}
*${t("free", {}, c)}*: ${formatBytes(freeMem)}
*${t("total", {}, c)}*: ${formatBytes(totalMem)}

*${t("runtime_info", {}, c)}*
*${t("runtime", {}, c)}*: ${runtime.name} ${runtime.version}
*${t("running", {}, c)}*: ${formatElapse(process.uptime() * 1000, " ")}
*${t("rss", {}, c)}*: ${formatBytes(memoryUsage.rss)}
*${t("heap_total", {}, c)}*: ${formatBytes(memoryUsage.heapTotal)}
*${t("heap_used", {}, c)}*: ${formatBytes(memoryUsage.heapUsed)}
*${t("external", {}, c)}*: ${formatBytes(memoryUsage.external)}
    `;

    return await c.reply({ text: infoText.trim() }, { quoted: c.event });
  },
};
