/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { Events } from "../../src/const.js";
import pen from "../../src/pen.js";
import { Role } from "../../src/roles.js";
import { settings, translate } from "../settings.js";
import { allowed } from "./detector.js";

const KEY_DEFENSE_ALLOW_STATUS = "defense_allow_status";

const t = translate({
  en: {
    status: "🛡️ *Defense status* : *{val}*",
    active: "Active ✅",
    inactive: "Inactive ⚠️",
    nb: "NB :",
    deactivating: "  *{pattern}-* _to deactivating_",
    activating: "  *{pattern}+* _to activating_",
    success_add: "Success add to setting",
    success_remove: "Success remove from setting",
    skip_setting: "*# Skip from setting* :",
    skip_default: "*# Default skip types* :",
    remove_hint: "  *{pattern}-* _to remove_",
    add_hint: "  *{pattern}+* _to add_",
    example: "Example :",
  },
  id: {
    status: "🛡️ *Status pertahanan* : *{val}*",
    active: "Aktif ✅",
    inactive: "Tidak Aktif ⚠️",
    nb: "Catatan :",
    deactivating: "  *{pattern}-* _untuk menonaktifkan_",
    activating: "  *{pattern}+* _untuk mengaktifkan_",
    success_add: "Berhasil menambahkan ke pengaturan",
    success_remove: "Berhasil menghapus dari pengaturan",
    skip_setting: "*# Dilewati dari pengaturan* :",
    skip_default: "*# Tipe bawaan yang dilewati* :",
    remove_hint: "  *{pattern}-* _untuk menghapus_",
    add_hint: "  *{pattern}+* _untuk menambah_",
    example: "Contoh :",
  },
});

/* filter duplicate types and defaults */
try {
  let setTypes = settings.get(KEY_DEFENSE_ALLOW_STATUS);
  if (!setTypes || !Array.isArray(setTypes)) setTypes = [];
  setTypes = setTypes.filter((v, i, a) => a.indexOf(v) === i);
  setTypes = setTypes.filter((v) => !allowed?.includes(v));
  settings.set(KEY_DEFENSE_ALLOW_STATUS, setTypes);
} catch (e) {
  pen.Error("defender-filter-types", e);
}

/** @type {import('../../src/plugin.js').Plugin[]} */
export default [
  {
    cmd: ["smp"],
    cat: "defense",
    desc: "Create and send sample message as json.",
    events: [Events.MESSAGES_UPSERT],
    roles: [Role.ADMIN],

    exec: async (c) => {
      c.reply({
        document: Buffer.from(JSON.stringify(c)),
        fileName: `${c.chat}_${c.sender}_${c.timestamp}.json`,
        mimetype: "application/json",
      });
    },
  },
  {
    cmd: ["defense", "defense+", "defense-"],
    cat: "defense",
    desc: "Manage defense status",
    events: [Events.MESSAGES_UPSERT],
    roles: [Role.ADMIN],

    exec: async (c) => {
      const key = "defense";
      let pattern = c.pattern;
      const tail = pattern.slice(-1);
      switch (tail) {
        case "+": {
          settings.set(key, true);
          pattern = c.pattern.slice(0, -1);
          pen.Warn(`Activating defense for ${c.me}`);
          break;
        }

        case "-": {
          settings.set(key, false);
          pattern = c.pattern.slice(0, -1);
          pen.Warn(`Deactivating defense for ${c.me}`);
          break;
        }
      }
      const set = settings.get(key);

      const texts = [
        t("status", { val: set === true ? t("active") : t("inactive") }),
        "",
        "",
        t("nb"),
        t("deactivating", { pattern }),
        t("activating", { pattern }),
      ];

      c.reply({ text: texts.join("\n") }, { quoted: c.event });
    },
  },
  {
    cmd: ["skip", "skip+", "skip-"],
    cat: "defense",
    desc: "Manage skip message type on status.",
    events: [Events.MESSAGES_UPSERT],
    roles: [Role.ADMIN],

    exec: async (c) => {
      let newAllowed = c.argv?._;
      if (!newAllowed || !Array.isArray(newAllowed)) newAllowed = [];
      newAllowed = newAllowed.filter((v, i, a) => a.indexOf(v) === i);

      let setAllows = settings.get(KEY_DEFENSE_ALLOW_STATUS);
      if (!setAllows || !Array.isArray(setAllows)) setAllows = [];

      const tail = c.pattern.slice(-1);
      const pattern = ["-", "+"].includes(tail)
        ? c.pattern.slice(0, -1)
        : c.pattern;
      let status = "";

      const texts = [];

      switch (tail) {
        case "+": {
          setAllows.push(
            ...newAllowed.filter(
              (v) => !setAllows?.includes(v) && !allowed?.includes(v),
            ),
          );
          status = "add";
          break;
        }

        case "-": {
          setAllows = setAllows.filter((v) => !newAllowed.includes(v));
          status = "remove";
          break;
        }
      }

      if (status?.length > 0) {
        settings.set(KEY_DEFENSE_ALLOW_STATUS, setAllows);
        texts.push(
          status === "add" ? t("success_add") : t("success_remove"),
          "",
        );
      }

      texts.push(
        t("skip_setting"),
        ...(setAllows?.map((v) => `- \`${v}\``) ?? []),
      );

      texts.push(
        "",
        t("skip_default"),
        ...(allowed?.map((v) => `- \`${v}\``) ?? []),
      );

      texts.push(
        "",
        t("nb"),
        t("remove_hint", { pattern }),
        t("add_hint", { pattern }),
        "",
        t("example"),
        "",
        `  *${pattern}+ audioMessage imageMessage*`,
      );
      c.reply({ text: texts.join("\n")?.trim() }, { quoted: c.event });
    },
  },
];
