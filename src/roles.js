/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

/**
 * @readonly
 * @enum {string}
 */
export const Role = Object.freeze({
  BLOCKED: 'blocked',
  GUEST: 'guest',
  USER: 'user',
  PREMIUM: 'premium',
  MODERATOR: 'moderator',
  ADMIN: 'admin',
  SUPERADMIN: 'superadmin',
  OWNER: 'owner'
});

/**
 * @readonly
 * @enum {number}
 */
export const RoleLevel = Object.freeze({
  [Role.BLOCKED]: 0,
  [Role.GUEST]: 1,
  [Role.USER]: 10,
  [Role.PREMIUM]: 100,
  [Role.MODERATOR]: 1000,
  [Role.ADMIN]: 10000,
  [Role.SUPERADMIN]: 100000,
  [Role.OWNER]: 1000000
});

/**
 * @typedef {typeof Role[keyof typeof Role]} RoleName
 */


/**
 * Get role name from numeric role level
 * @param {number} role
 * @returns {string}
 */
export function levelToName(role) {
  const names = Object.entries(RoleLevel).find(([, value]) => value === role);
  return names ? names[0] : '';
}

/**
 * Get numeric role level from name
 * @param {string|any} roleName
 * @returns {number}
 */
export function nameToLevel(roleName) {
  return RoleLevel[/** @type {RoleName} */(roleName)];
}

/**
 * Get role level from single role or array of roles
 * @param {string|number|(string|number)[]} roles
 * @returns {number[]}
 */
export function rolesToLevel(roles) {
  if (!roles) return [];

  if (Array.isArray(roles)) {
    return roles.map(role => typeof role === 'string' ? nameToLevel(role) : role);
  }

  return [];
}

/**
 * Check if exist role is at least required role
 * @param {string|number} existRole
 * @param {string|number} requiredRole
 * @returns {boolean}
 */
export function isAtLeast(existRole, requiredRole) {
  const existLevel = typeof existRole === 'string' ? nameToLevel(existRole) : existRole;
  const requiredLevel = typeof requiredRole === 'string' ? nameToLevel(requiredRole) : requiredRole;

  if (!existLevel || !requiredLevel) return false;
  return existLevel >= requiredLevel;
}


/**
 * Check if the existing roles has required roles
 * @param {(string|number)[]} existRoles
 * @param {(number|string)[]} requiredRoles
 * @returns {boolean}
 */
export function rolesEnough(existRoles, requiredRoles) {
  if (!existRoles.length || !requiredRoles.length) return false;

  const requireLevels = rolesToLevel(requiredRoles);
  const existLevels = rolesToLevel(existRoles);

  if (!requireLevels.length || !existLevels.length) return false;

  return Math.max(...existLevels) >= Math.min(...requireLevels);
}
