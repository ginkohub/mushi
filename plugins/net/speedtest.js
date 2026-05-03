/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { SpeedTestService } from "@ginkohub/speedtest-js";
import { MESSAGES_UPSERT } from "../../src/const.js";
import pen from "../../src/pen.js";
import { Role } from "../../src/roles.js";
import { translate } from "../settings.js";

const service = new SpeedTestService();
const clientInfo = await service.fetchClientInfo();
const bestServer = await service.findBestServer();

const t = translate({
  en: {
    isp: "ISP",
    ip: "IP",
    country: "Country",
    server: "Server",
    sponsor: "Sponsor",
    latency: "Latency",
    distance: "Distance",
    testing: "wait for testing...",
    result: "# Result",
    download: "Download",
    upload: "Upload",
  },
  id: {
    isp: "Penyedia Internet",
    ip: "IP",
    country: "Negara",
    server: "Server",
    sponsor: "Sponsor",
    latency: "Laten",
    distance: "Jarak",
    testing: "tunggu sedang mengetes...",
    result: "# Hasil",
    download: "Unduh",
    upload: "Unggah",
  },
});

/** @type {import('../../src/plugin.js').Plugin} */
export default {
  cmd: ["speed"],

  cat: "net",
  desc: "Speedtest.",
  events: [MESSAGES_UPSERT],
  roles: [Role.PREMIUM],
  /** @param {import('../../src/context.js').Ctx} c */
  exec: async (c) => {
    let testServer = bestServer;

    if (c.argv?.server && c.argv?.server?.length > 1) {
      try {
        const remotes = await service.searchRemoteServers(c.argv?.server);
        if (remotes?.length > 0) {
          testServer = remotes[0];
        }
      } catch (e) {
        pen.Error("speedtest", e);
      }
    }

    const ipCensored = clientInfo.ip
      .split(".")
      .map((v, i) => {
        if (i > 0 && i < 3) {
          return "x".repeat(3);
        } else {
          return v;
        }
      })
      .join(".");
    const texts = [
      `*${t("isp")}*: ${clientInfo.isp}`,
      `*${t("ip")}*: ${ipCensored}`,
      "",
      `*${t("country")}*: ${testServer.country}`,
      `*${t("server")}*: ${testServer.name}`,
      `*${t("sponsor")}*: ${testServer.sponsor}`,
      `*${t("latency")}*: ${testServer.latency}ms`,
      `*${t("distance")}*: ${testServer.distance} KM`,
      "",
      t("testing"),
    ];

    const resp = await c.reply({ text: texts.join("\n") }, { quoted: c.event });

    const { latency, jitter } = await service.testLatency(testServer);

    let start = Date.now();
    const speedDownload = await service.testDownload(testServer);
    let end = Date.now() - start;
    const endDownload =
      end >= 1000 ? `${(end / 1000).toFixed(2)}s` : `${end}ms`;

    start = Date.now();
    const speedUpload = await service.testUpload(testServer);
    end = Date.now() - start;
    const endUpload = end >= 1000 ? `${(end / 1000).toFixed(2)}s` : `${end}ms`;

    texts.pop();

    texts.push(
      ...[
        t("result"),
        `*${t("latency")}*: ${latency}ms`,
        `*Jitter*: ${jitter}ms`,
        `*${t("download")}*: ${speedDownload.toFixed(2)} Mbps in ${endDownload}`,
        `*${t("upload")}*: ${speedUpload.toFixed(2)} Mbps in ${endUpload}`,
      ],
    );

    c.reply(
      {
        text: texts.join("\n"),
        edit: resp.key,
      },
      {
        quoted: c.event,
      },
    );
  },
};
