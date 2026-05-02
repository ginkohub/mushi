/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import fs from "node:fs";
import path from "node:path";
import pen from "./pen.js";

const dataDir = "data";

/**
 * Ensures that a directory exists, creating it if it doesn't.
 * Ignores errors if the directory already exists.
 * @param {string} targetDir The path of the directory to check/create.
 */
function checkDataDir(targetDir) {
  try {
    fs.mkdirSync(targetDir);
  } catch (e) {
    /* Ignore error if the directory already exists (EEXIST) */
    if (e.code !== "EEXIST") {
      pen.Error(`Failed to create directory ${targetDir}:`, e);
    }
  }
}

/**
 * Ensures a subdirectory within the main 'data' directory exists and returns its path.
 * @param {string} name The name of the subdirectory.
 * @returns {string} The absolute path to the subdirectory.
 */
export function getDir(name) {
  checkDataDir(dataDir);
  const targetDir = path.join(dataDir, name);
  checkDataDir(targetDir);
  return targetDir;
}

/**
 * Returns a file path within the main 'data' directory.
 * It ensures the main 'data' directory exists.
 * @param {string} name The name of the file.
 * @returns {string} The absolute path to the file.
 */
export function getFile(name) {
  checkDataDir(dataDir);
  return path.join(dataDir, name);
}
