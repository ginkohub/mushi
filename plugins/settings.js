/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { StoreJson, StoreSQLite } from '../src/store.js';
import { getFile } from '../src/data.js';
import { Reason } from '../src/reason.js';

export const storeMsg = new StoreSQLite({
  saveName: getFile('store_message.db'),
});


export const settings = new StoreJson({
  saveName: getFile('settings.json'),
  autoSave: true,
  autoLoad: true,
});

/**
 * Check if the sender is an owner of the bot
 *
 * @param {import('../src/context.js').Ctx} c
 */
export function fromOwner(c) {
  const res = new Reason({
    success: false,
    code: 'from-owner',
    author: import.meta.url,
    message: 'No owners configured',
    data: c.sender
  });

  const owners = settings.get('owners');
  if (!owners || !Array.isArray(owners)) {
    return res;
  }

  if (c.sender && owners.includes(c.sender)) {
    return res.setSuccess(true);
  }

  return res.setMessage('Sender are not an owner of the bot');
}

