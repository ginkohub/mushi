/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { jidNormalizedUser } from 'baileys';
import { StoreJson } from './store.js';
import { RoleLevel, Role, nameToLevel, rolesEnough } from './roles.js';

/**
 * @typedef {Object} User
 * @property {string} [name]
 * @property {string} [bio]
 * @property {string} [jid]
 * @property {string} [lid]
 * @property {Role[]} roles
 * @property {number} xp
 * @property {number} level
 * @property {boolean} [banned]
 * @property {number} [bannedAt]
 * @property {number} addedAt
 */

export class UserManager {

  /**
   * @param {{saveName?: string, owners?: string[]}} options
   */
  constructor({ saveName = 'user.json', owners = [] }) {
    this.storage = new StoreJson({
      saveName: saveName,
      autoSave: true,
      autoLoad: true
    });

    /** @type {string[]} */
    this.owners = owners;
  }

  /**
   * Clear all user data
   */
  clear() {
    this.storage?.clear();
  }

  /**
   * Add owner id 
   * @param {...string} jids
   */
  addOwners(...jids) {
    if (jids) jids.forEach(jid => {
      jid = jidNormalizedUser(jid);
      if (!this.owners?.includes(jid)) this.owners?.push(jid);
      const user = this.getUser(jid);
      if (user) {
        if (!user.roles.includes(Role.OWNER)) {
          user.roles.push(Role.OWNER);
          this.updateUser(jid, user);
        }
      }
    });
  }

  /**
   * Check if jid are owner
   * @param {string} jid
   * @returns {boolean}
   */
  isOwner(jid) {
    jid = jidNormalizedUser(jid);
    const user = this.getUser(jid);
    if (user?.roles?.includes(Role.OWNER)) return true;
    return this.owners?.includes(jid);
  }

  /**
   * Get user data
   * @param {string} jid
   * @returns {User|undefined}
   */
  getUser(jid) {
    jid = jidNormalizedUser(jid);
    if (!jid || jid === '') return;
    /** @type {User} */
    let user = this.storage.get(jid);

    if (!user) {
      user = {
        name: undefined,
        xp: 0,
        level: 0,
        roles: [Role.GUEST],
        banned: false,
        addedAt: Date.now(),
      };

      if (jid?.includes('@lid')) {
        user.lid = jid;
      } else {
        user.jid = jid;
      }

      if (jid) if (this.owners?.includes(jid)) user.roles.push(Role.OWNER);
      this.storage.set(jid, user);
    }
    return user;
  }

  /**
   * @param {string} jid
   * @param {User} data
   * @returns {User}
   */
  updateUser(jid, data) {
    const id = jidNormalizedUser(jid);
    const user = this.getUser(id);
    const updated = { ...user, ...data };
    this.storage.set(id, updated);
    return updated;
  }

  /**
   * @param {string} jid
   * @returns {number}
   */
  getHighestRoleLevel(jid) {
    const user = this.getUser(jid);
    if (!user?.roles?.length) return RoleLevel.blocked;
    const levels = user?.roles.map(r => nameToLevel(r) ?? 0);
    return Math.max(...levels);
  }

  /**
   * Check if user has required roles
   * @param {string} jid
   * @param {(number|string)[]} requiredRoles
   * @returns {boolean}
   */
  rolesEnough(jid, requiredRoles) {
    if (!Array.isArray(requiredRoles)) return false;

    const user = this.getUser(jid);
    if (!user?.roles?.length) return false;

    return rolesEnough(user.roles, requiredRoles);
  }

}
