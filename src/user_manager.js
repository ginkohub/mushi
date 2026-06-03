/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { jidNormalizedUser } from "baileys";
import { nameToLevel, Role, RoleLevel, rolesEnough } from "./roles.js";
import { StoreJson } from "./store.js";

/**
 * @typedef {Object} UserManagerOpts
 * @property {string} [saveName]
 * @property {Store} store
 * @property {string[]} owners
 */

export class User {
  /** @type {string|undefined} */
  name;
  /** @type {string|undefined} */
  bio;
  /** @type {string|undefined} */
  jid;
  /** @type {string|undefined} */
  lid;
  /** @type {Role[]} */
  roles;
  /** @type {number} */
  xp;
  /** @type {number} */
  level;
  /** @type {Record<string, number>} */
  stats;
  /** @type {string|undefined} */
  lang;
  /** @type {string|undefined} */
  tz;
  /** @type {boolean} */
  banned;
  /** @type {number|undefined} */
  bannedAt;
  /** @type {number} */
  addedAt;

  /**
   * @param {Partial<User>} data
   * @param {string} [jid]
   * @param {string[]} [owners]
   */
  constructor(data = {}, jid, owners) {
    this.name = data.name;
    this.bio = data.bio;
    this.xp = data.xp ?? 0;
    this.level = data.level ?? 0;
    this.stats = data.stats ?? {};
    this.lang = data.lang;
    this.tz = data.tz;
    this.roles = data.roles ? [...data.roles] : [Role.GUEST];
    this.banned = data.banned ?? false;
    this.bannedAt = data.bannedAt;
    this.addedAt = data.addedAt ?? Date.now();

    if (jid?.includes("@lid")) {
      this.lid = jid;
    } else {
      this.jid = jid ?? data.jid;
    }

    if (owners?.includes(this.jid ?? this.lid)) {
      if (!this.roles.includes(Role.OWNER)) this.roles.push(Role.OWNER);
    }
  }

  /**
   * @param {string|number} role
   * @returns {boolean}
   */
  hasRole(role) {
    if (!this.roles?.length) return false;
    return rolesEnough(this.roles, [role]);
  }

  /**
   * @param {string} role
   */
  addRole(role) {
    if (!this.roles.includes(role)) {
      this.roles.push(role);
    }
  }

  /**
   * @param {string} role
   */
  removeRole(role) {
    this.roles = this.roles.filter((r) => r !== role);
    if (this.roles.length === 0) this.roles.push(Role.GUEST);
  }

  /**
   * @returns {number}
   */
  getHighestRoleLevel() {
    if (!this.roles?.length) return RoleLevel.blocked;
    const levels = this.roles.map((r) => nameToLevel(r) ?? 0);
    return Math.max(...levels);
  }

  /**
   * @returns {object}
   */
  toJSON() {
    return Object.fromEntries(
      Object.entries(this).filter(([_, v]) => v !== undefined),
    );
  }
}

export class UserManager {
  /**
   * @param {UserManagerOpts} opts
   */
  constructor(opts) {
    this.storage =
      opts?.store ||
      new StoreJson({
        saveName: opts?.saveName,
        autoSave: true,
        autoLoad: true,
      });

    /** @type {string[]} */
    this.owners = opts?.owners || [];
  }

  /**
   * Clear all user data
   * @returns {void}
   */
  clear() {
    this.storage?.clear();
  }

  /**
   * Add owner id
   * @param {...string} jids
   */
  addOwners(...jids) {
    if (jids?.length)
      jids.forEach((jid) => {
        jid = jidNormalizedUser(jid);
        if (!this.owners?.includes(jid)) this.owners?.push(jid);
        const user = this.getUser(jid);
        if (user) {
          if (!user.hasRole(Role.OWNER)) {
            user.addRole(Role.OWNER);
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
    if (user?.hasRole(Role.OWNER)) return true;
    return this.owners?.includes(jid);
  }

  /**
   * Get user data
   * @param {string} jid
   * @returns {User|undefined}
   */
  getUser(jid) {
    jid = jidNormalizedUser(jid);
    if (!jid || jid === "") return;

    const stored = this.storage.get(jid);
    if (stored) return new User(stored);

    const user = new User({}, jid, this.owners);
    this.storage.set(jid, user.toJSON());
    return user;
  }

  /**
   * @param {string} jid
   * @param {Partial<User>} data
   * @returns {User}
   */
  updateUser(jid, data) {
    const id = jidNormalizedUser(jid);
    const user = this.getUser(id);
    const updated = new User({ ...user, ...data });
    this.storage.set(id, updated.toJSON());
    return updated;
  }

  /**
   * @param {string} jid
   * @returns {number}
   */
  getHighestRoleLevel(jid) {
    const user = this.getUser(jid);
    if (!user) return RoleLevel.blocked;
    return user.getHighestRoleLevel();
  }

  /**
   * Check if user has at least a role
   * @param {string} jid
   * @param {string|number} role
   * @returns {boolean}
   */
  hasRole(jid, role) {
    const user = this.getUser(jid);
    return !!user?.hasRole(role);
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
