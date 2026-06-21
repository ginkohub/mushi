/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

export const JidServer = {
  DefaultUser: "s.whatsapp.net",
  Group: "g.us",
  LegacyUser: "c.us",
  Broadcast: "broadcast",
  HiddenUser: "lid",
  Messenger: "msgr",
  Interop: "interop",
  Newsletter: "newsletter",
  Hosted: "hosted",
  HostedLID: "hosted.lid",
  Bot: "bot",
};

export const JidDomainType = {
  WhatsApp: 0,
  LID: 1,
  Hosted: 128,
  HostedLID: 129,
};

export function parseJid(jid) {
  if (!jid.includes("@")) {
    return new Jid({ server: jid });
  }
  const [userPart, server] = jid.split("@");
  let user = userPart || "";
  let device = 0;

  if (user.includes(":") || user.includes(".")) {
    const parts = user.split(/[:.]/);
    user = parts[0];
    device = parseInt(parts[parts.length - 1], 10) || 0;
  }

  return new Jid({ user, device, server });
}

export class Jid {
  /** @type {string} */
  user;
  /** @type {number} */
  device;
  /** @type {string} */
  server;

  /**
   * @param {string | {user?: string, device?: number, server?: string}} jid
   */
  constructor(jid) {
    if (typeof jid === "string" && jid.includes("@")) {
      const parsed = parseJid(jid);
      this.user = parsed.user;
      this.device = parsed.device;
      this.server = parsed.server;
    } else {
      this.user = jid.user ?? "";
      this.device = jid.device ?? 0;
      this.server = jid.server ?? "";
    }
  }

  /**
   * @returns {Jid}
   */
  toNonAD() {
    return new Jid({ user: this.user, server: this.server });
  }

  /**
   * @returns {string}
   */
  toString() {
    if (this.device > 0) {
      return `${this.user}:${this.device}@${this.server}`;
    }
    if (this.user) {
      return `${this.user}@${this.server}`;
    }
    return this.server;
  }
}

export const WellKnownJid = {
  Empty: new Jid({}),
  GroupServer: new Jid({ server: JidServer.Group }),
  Server: new Jid({ server: JidServer.DefaultUser }),
  BroadcastServer: new Jid({ server: JidServer.Broadcast }),
  StatusBroadcast: new Jid({ user: "status", server: JidServer.Broadcast }),
  LegacyPSA: new Jid({ user: "0", server: JidServer.LegacyUser }),
  PSA: new Jid({ user: "0", server: JidServer.DefaultUser }),
  OfficialBusiness: new Jid({
    user: "16505361212",
    server: JidServer.LegacyUser,
  }),
  MetaAI: new Jid({ user: "13135550002", server: JidServer.DefaultUser }),
  NewMetaAI: new Jid({ user: "867051314767696", server: JidServer.Bot }),
};
