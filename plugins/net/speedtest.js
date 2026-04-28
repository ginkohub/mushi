import { fromMe } from '../../src/midware.js';
import { SpeedTestService } from '@ginkohub/speedtest-js';
import pen from '../../src/pen.js';
import { MESSAGES_UPSERT } from '../../src/const.js';

const service = new SpeedTestService();
const clientInfo = await service.fetchClientInfo();
const bestServer = await service.findBestServer();

/** @type {import('../../src/plugin.js').Plugin} */
export default {
  cmd: ['speed'],
  timeout: 15,
  cat: 'net',
  desc: 'Speedtest.',
  accepts: [MESSAGES_UPSERT],
  midware: fromMe,

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
        pen.Error('speedtest', e);
      }
    }

    let texts = [
      `ISP: ${clientInfo.isp}`,
      `IP: ${clientInfo.ip}`,
      '',
      `Server: ${testServer.name}`,
      `Country: ${testServer.country}`,
      `Sponsor: ${testServer.sponsor}`,
      `Latency: ${testServer.latency}ms`,
      `Distance: ${testServer.distance} KM`,
      '', 'testing ',
    ];

    const resp = await c.reply({ text: texts.join('\n') }, { quoted: c.event });

    const { latency, jitter } = await service.testLatency(testServer);

    let start = Date.now();
    const speedDownload = await service.testDownload(testServer);
    let end = Date.now() - start;
    const endDownload = end >= 1000 ? `${(end / 1000).toFixed(2)}s` : `${end}ms`;

    start = Date.now();
    const speedUpload = await service.testUpload(testServer);
    end = Date.now() - start;
    const endUpload = end >= 1000 ? `${(end / 1000).toFixed(2)}s` : `${end}ms`;

    texts.pop();

    texts.push(...[
      `Latency: ${latency}ms`,
      `Jitter: ${jitter}ms`,
      `Download: ${speedDownload.toFixed(2)}Mbps in ${endDownload}`,
      `Upload: ${speedUpload.toFixed(2)}Mbps in ${endUpload}`
    ]);

    c.reply({
      text: texts.join('\n'),
      edit: resp.key
    }, {
      quoted: c.event
    });

  }
};

