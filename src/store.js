/**
 * Copyright (C) 2025 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import pen from "./pen.js";
import fs from 'fs';


export class StoreJson {
  constructor({ saveName, autoSave, expiration }) {
    if (!saveName) throw Error('saveName required');

    this.data = {};

    this.autoSave = autoSave ?? false;
    this.saveName = saveName;

    /* Read json data from local storage */
    try {
      this.data = JSON.parse(fs.readFileSync(saveName, 'utf8'));
    } catch (e) {
      pen.Error(e);
    }
  }

  save() {
    try {
      fs.writeFileSync(this.saveName, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (e) {
      pen.Error(e);
    }
  }

  saveCheck() {
    if (this.autoSave) {
      this.save();
    }
  }

  set(key, value) {
    if (!key || !value) return;

    this.data[key] = value;
    this.saveCheck();
  }

  get(key) {
    return this.data[key];
  }

  delete(key) {
    this.data;
    this.saveCheck();
  }

  clear() {
    this.data = {};
    this.saveCheck();
  }

  keys() {
    return this.data.keys();
  }
}
