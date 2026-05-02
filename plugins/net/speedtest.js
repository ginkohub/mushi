import { SpeedTestService } from "@ginkohub/speedtest-js";
import { MESSAGES_UPSERT } from "../../src/const.js";
import pen from "../../src/pen.js";
import { Role } from "../../src/roles.js";

const service = new SpeedTestService();
const clientInfo = await service.fetchClientInfo();
const bestServer = await service.findBestServer();

/** @type {import('../../src/plugin.js').Plugin} */
export default {
  cmd: ["speed"],
  timeout: 15,
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
      `*ISP*: ${clientInfo.isp}`,
      `*IP*: ${ipCensored}`,
      "",
      `*Country*: ${testServer.country}`,
      `*Server*: ${testServer.name}`,
      `*Sponsor*: ${testServer.sponsor}`,
      `*Latency*: ${testServer.latency}ms`,
      `*Distance*: ${testServer.distance} KM`,
      "",
      "wait for testing...",
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
        "# Result",
        `*Latency*: ${latency}ms`,
        `*Jitter*: ${jitter}ms`,
        `*Download*: ${speedDownload.toFixed(2)} Mbps in ${endDownload}`,
        `*Upload*: ${speedUpload.toFixed(2)} Mbps in ${endUpload}`,
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
