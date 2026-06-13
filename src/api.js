/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import os from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import QRCode from "qrcode";
import { isBun, isDeno } from "./tools.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(join(__dirname, "..", "package.json"), "utf-8"),
);
const API_KEY = process.env.MUSHI_API_KEY;

/**
 * @typedef {Object} ApiServerOpts
 * @property {number} [port]
 * @property {boolean} [autoLoadBots]
 * @property {import('./manager.js').BotManager} [manager]
 * @property {import('./logger.js').Logger} [logger]
 */

/**
 * @class ApiServer
 * @description Express-based API server for managing bot instances
 */
export class ApiServer {
  /** @param {ApiServerOpts} opts */
  constructor(opts = {}) {
    this.port = opts.port || process.env.PORT || 3000;
    this.autoLoadBots = opts.autoLoadBots !== false;

    this.manager = opts.manager;
    this.log = opts.logger;

    if (!this.manager) {
      throw new Error("ApiServer requires a BotManager instance");
    }
    if (!this.log) {
      throw new Error("ApiServer requires a Logger instance");
    }

    this.app = express();
    /** @type {import('node:http').Server | null} */
    this.server = null;

    this._setupMiddleware();
    this._setupRoutes();
  }

  _setupMiddleware() {
    this.app.use(express.json());
    this.app.use((req, res, next) => {
      if (!API_KEY) return next();
      if (req.path === "/api/health") return next();
      const auth = req.headers.authorization;
      if (!auth?.startsWith("Bearer ") || auth.slice(7) !== API_KEY) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      next();
    });
  }

  _setupRoutes() {
    const api = express.Router();

    // [GET] /api/bots - List all bots
    api.get("/bots", (_req, res) => {
      try {
        const registeredKeys = this.manager.store.keys();
        const bots = registeredKeys.map((id) => {
          const config = this.manager.store.get(id);
          return this._formatBotResponse(id, config);
        });
        res.json(bots);
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });

    // [GET] /api/qrcode - Generate QR code locally
    api.get("/qrcode", async (req, res) => {
      const { data } = req.query;
      if (!data) return res.status(400).send("No data provided");
      try {
        const buffer = await QRCode.toBuffer(data, {
          margin: 2,
          scale: 10,
          color: { dark: "#000000", light: "#ffffff" },
        });
        res.type("image/png").send(buffer);
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });

    // [GET] /api/bots/:id - Get specific bot details
    api.get("/bots/:id", (req, res) => {
      const id = req.params.id;
      const config = this.manager.store.get(id);
      if (!config) {
        return res.status(404).json({ error: "Bot not found in registry" });
      }
      res.json(this._formatBotResponse(id, config));
    });

    // [GET] /api/bots/:id/logs - Get logs for specific bot
    api.get("/bots/:id/logs", (req, res) => {
      const id = req.params.id;
      const bot = this.manager.getBot(id);
      if (!bot?.log) {
        return res
          .status(404)
          .json({ error: "Bot not found or no logs available" });
      }
      const limit = parseInt(req.query.limit, 10) || 100;
      const level = req.query.level;
      let logs = bot.log.getRecent(limit);
      if (level) {
        logs = logs.filter((l) => l.level === level.toUpperCase());
      }
      res.json(logs);
    });

    // [POST] /api/bots/:id/restart - Restart bot
    api.post("/bots/:id/restart", async (req, res) => {
      const id = req.params.id;
      const bot = this.manager.getBot(id);
      if (!bot) {
        return res.status(404).json({ error: "Bot not found" });
      }
      try {
        await bot.disconnect?.();
        await bot.connect();
        res.json({ message: "Bot restarted" });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });

    // [GET] /api/bots/:id/stats - Get bot statistics
    api.get("/bots/:id/stats", (req, res) => {
      const id = req.params.id;
      const bot = this.manager.getBot(id);
      if (!bot) {
        return res.status(404).json({ error: "Bot not found" });
      }
      res.json({
        uptime: bot.startedAt ? Date.now() - bot.startedAt : 0,
        messagesReceived: bot.messageReceived || 0,
        messagesSent: bot.messageSent || 0,
        lastSeen: bot.lastSeen || null,
      });
    });

    // [PATCH] /api/bots/:id - Update bot configuration
    api.patch("/bots/:id", (req, res) => {
      const id = req.params.id;
      const existingConfig = this.manager.store.get(id);
      if (!existingConfig) {
        return res.status(404).json({ error: "Bot not found" });
      }
      const updates = req.body;
      const newConfig = { ...existingConfig, ...updates };
      if (newConfig.method === "otp" && !newConfig.phone) {
        return res
          .status(400)
          .json({ error: "Phone number is required for 'otp' method" });
      }
      this.manager.store.set(id, newConfig);
      res.json({
        message: "Configuration updated",
        data: this._formatBotResponse(id, newConfig),
      });
    });

    // [POST] /api/bots - Register a new bot
    api.post("/bots", async (req, res) => {
      const config = req.body;
      if (!config.name) {
        return res.status(400).json({ error: "Bot 'name' is required" });
      }
      try {
        if (config.method === "otp" && !config.phone) {
          return res
            .status(400)
            .json({ error: "Phone number is required for 'otp' method" });
        }
        const bot = this.manager.addBot(config);
        if (req.body.start) {
          await this._initiateBotConnection(bot, res);
        } else {
          res.status(201).json({
            message: "Bot registered successfully",
            data: this._formatBotResponse(config.name, config),
          });
        }
      } catch (e) {
        this.log.error(`Failed to register bot: ${e.message}`);
        res.status(500).json({ error: e.message });
      }
    });

    // [DELETE] /api/bots/:id - Unregister and stop bot
    api.delete("/bots/:id", async (req, res) => {
      const id = req.params.id;
      if (!this.manager.store.has(id)) {
        return res.status(404).json({ error: "Bot not found" });
      }
      try {
        await this.manager.removeBot(id);
        res
          .status(200)
          .json({ message: `Bot '${id}' has been decommissioned` });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });

    // [POST] /api/bots/start-all - Start all registered bots
    api.post("/bots/start-all", async (_req, res) => {
      try {
        await this.manager.loadAll();
        res.json({ message: "All bots connection sequence started" });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });

    // [POST] /api/bots/stop-all - Stop all active bots
    api.post("/bots/stop-all", async (_req, res) => {
      try {
        await this.manager.stopAll();
        res.json({ message: "All bots disconnected" });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });

    // [POST] /api/bots/:id/start - Start/Connect bot
    api.post("/bots/:id/start", async (req, res) => {
      const id = req.params.id;
      const bot = this.manager.getBot(id);

      if (!bot) {
        const config = this.manager.store.get(id);
        if (!config) return res.status(404).json({ error: "Bot not found" });
        if (config.method === "otp" && !config.phone) {
          return res.status(400).json({
            error:
              "Phone number is required for 'otp' method. Please update configuration first.",
          });
        }
        const newBot = this.manager.addBot(config);
        return this._initiateBotConnection(newBot, res);
      }

      if (bot.method === "otp" && !bot.phone) {
        return res.status(400).json({
          error:
            "Phone number is required for 'otp' method. Please update configuration first.",
        });
      }

      await this._initiateBotConnection(bot, res);
    });

    // [POST] /api/bots/:id/stop - Stop/Disconnect bot
    api.post("/bots/:id/stop", async (req, res) => {
      const id = req.params.id;
      if (!this.manager.bots.has(id)) {
        return res.status(400).json({ error: "Bot is not currently active" });
      }
      try {
        await this.manager.disconnectBot(id);
        res.json({ message: "Bot disconnected" });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });

    // [GET] /api/bots/:id/blocklist - Get bot blocklist
    api.get("/bots/:id/blocklist", (req, res) => {
      const id = req.params.id;
      const bot = this.manager.getBot(id);
      if (!bot) {
        return res.status(404).json({ error: "Bot not found" });
      }
      res.json(Array.from(bot.blockList));
    });

    // [POST] /api/bots/:id/blocklist - Block/Unblock user
    api.post("/bots/:id/blocklist", async (req, res) => {
      const id = req.params.id;
      const bot = this.manager.getBot(id);
      if (!bot) {
        return res.status(404).json({ error: "Bot not found" });
      }
      const { jid, action } = req.body;
      if (!jid || !["block", "unblock"].includes(action)) {
        return res
          .status(400)
          .json({ error: "JID and action (block/unblock) are required" });
      }
      try {
        await bot.updateBlock(jid, action);
        res.json({
          message: `User ${action === "block" ? "blocked" : "unblocked"} successfully`,
        });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });

    // [GET] /api/plugins - List available plugins
    api.get("/plugins", (_req, res) => {
      const plugins = Array.from(this.manager.registry.plugins.keys());
      res.json(plugins);
    });

    // [GET] /api/health - Health check
    api.get("/health", (_req, res) => {
      res.json({ status: "ok", timestamp: new Date().toISOString() });
    });

    // [GET] /api/logs - Get recent logs
    api.get("/logs", (_req, res) => {
      const limit = parseInt(_req.query.limit, 10) || 100;
      const source = _req.query.source;
      let logs = this.log.getRecent(limit);
      if (source) {
        logs = logs.filter((l) => l.source === source);
      }
      res.json(logs);
    });

    // [GET] /api/sources - Get available log sources
    api.get("/sources", (_req, res) => {
      const logs = this.log.getRecent(500);
      const sources = [...new Set(logs.map((l) => l.source))];
      res.json(sources);
    });

    // [GET] /api/system - System info
    api.get("/system", (_req, res) => {
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const memoryUsage = process.memoryUsage();
      const cpus = os.cpus();

      const runtime = isBun
        ? { name: "Bun", version: Bun.version }
        : isDeno
          ? { name: "Deno", version: Deno.version.deno }
          : { name: "NodeJS", version: process.version };

      let distro = os.platform();
      if (os.platform() === "linux") {
        try {
          const osRelease = readFileSync("/etc/os-release", "utf8");
          const match = osRelease.match(/^PRETTY_NAME="(.+)"$/m);
          distro = match ? match[1] : os.release();
        } catch {
          distro = os.release();
        }
      }

      let gpu = "N/A";
      try {
        if (os.platform() === "linux") {
          const gpuInfo = execSync('lspci | grep -i "vga\\|3d\\|2d"')
            .toString()
            .trim();
          const gpuModel = gpuInfo.split(":").pop().trim();
          gpu = gpuModel.split("[")[1]?.split("]")[0] || "N/A";
        }
      } catch {
        gpu = "N/A";
      }

      res.json({
        version: pkg.version,
        platform: os.platform(),
        os: distro,
        kernel: `${os.release()} ${os.machine()}`,
        uptime: os.uptime(),
        cpu: cpus[0]?.model || "N/A",
        cpuCores: cpus?.length || 0,
        gpu,
        memory: {
          used: usedMem,
          free: freeMem,
          total: totalMem,
        },
        runtime: {
          name: runtime.name,
          version: runtime.version,
          running: process.uptime(),
          rss: memoryUsage.rss,
          heapTotal: memoryUsage.heapTotal,
          heapUsed: memoryUsage.heapUsed,
          external: memoryUsage.external,
        },
        activeBots: this.manager.bots.size,
        registeredBots: this.manager.store.keys().length,
      });
    });

    this.app.use("/api", api);
  }

  /**
   * Standardizes bot object for response
   */
  _formatBotResponse(id, config) {
    const liveBot = this.manager.getBot(id);
    return {
      id,
      name: config.name || id,
      phone: config.phone || "",
      method: config.method || "qr",
      status: liveBot?.isConnected ? "connected" : "disconnected",
      uptime: liveBot?.startedAt ? Date.now() - liveBot.startedAt : 0,
      createdAt: liveBot?.createdAt || config.createdAt || null,
      config: {
        prefixes: config.prefixes || [".", "/"],
        plugins: config.plugins || [],
      },
    };
  }

  /**
   * Shared logic for starting a bot and waiting for initial auth events
   */
  async _initiateBotConnection(bot, res) {
    if (bot.isConnected) {
      return res.json({ status: "connected", message: "Already connected" });
    }

    let sent = false;
    const sendResponse = (data) => {
      if (!sent) {
        sent = true;
        res.json(data);
      }
    };

    const qrHandler = (data) => {
      sendResponse({ status: "waiting_qr", qr: data.qr });
      cleanup();
    };

    const codeHandler = (data) => {
      sendResponse({ status: "waiting_code", code: data.code });
      cleanup();
    };

    const cleanup = () => {
      bot.off("qr", qrHandler);
      bot.off("code", codeHandler);
    };

    bot.on("qr", qrHandler);
    bot.on("code", codeHandler);

    try {
      await bot.connect();
      setTimeout(() => {
        sendResponse({
          status: "connecting",
          message: "Connection sequence started",
        });
        cleanup();
      }, 1500);
    } catch (e) {
      cleanup();
      if (!sent) {
        res.status(500).json({ error: e.message });
      }
    }
  }

  /**
   * Start the API server
   * @returns {Promise<void>}
   */
  async start() {
    if (this.server) {
      this.log.warn("API server is already running");
      return;
    }

    if (this.autoLoadBots) {
      try {
        await this.manager.loadAll();
        this.log.info("Service initialized: all bots loaded from registry");
      } catch (e) {
        this.log.error(`Initialization failure: ${e.message}`);
      }
    }

    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        this.log.info(`API server listening on port ${this.port}`);
        resolve();
      });
    });
  }

  /**
   * Stop the API server
   * @returns {Promise<void>}
   */
  async stop() {
    if (!this.server) {
      this.log.warn("API server is not running");
      return;
    }

    return new Promise((resolve, reject) => {
      this.server.close((err) => {
        if (err) {
          this.log.error("Error stopping API server:", err);
          reject(err);
        } else {
          this.server = null;
          this.log.info("API server stopped");
          resolve();
        }
      });
    });
  }
}

export default ApiServer;
