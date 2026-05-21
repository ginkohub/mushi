import { io, Socket } from 'socket.io-client';

export interface Bot {
	id: string;
	name: string;
	phone: string;
	method: 'qr' | 'otp';
	status: string;
	authenticated: boolean;
	uptime: number;
	createdAt: string | null;
	config: {
		prefixes: string[];
		plugins: string[];
		autostart: boolean;
	};
}

export interface SystemInfo {
	version: string;
	platform: string;
	os: string;
	kernel: string;
	uptime: number;
	cpu: string;
	cpuCores: number;
	gpu: string;
	memory: {
		used: number;
		free: number;
		total: number;
	};
	runtime: {
		name: string;
		version: string;
		running: number;
		rss: number;
		heapTotal: number;
		heapUsed: number;
		external: number;
	};
	activeBots: number;
	registeredBots: number;
}

export interface Plugin {
	name: string;
	cmd?: string | string[];
	desc?: string;
	cat?: string;
	roles?: string[];
	location?: string;
	estimate?: number;
	disabled?: boolean;
}

const API_BASE = '/api';
let socket: Socket | null = null;

export const api = {
	getSocket(): Socket {
		if (!socket) {
			const protocol = window.location.protocol;
			const host = window.location.host;
			// In development, Vite runs on a different port, so we need to point to the backend
			const socketUrl = import.meta.env.DEV ? 'http://localhost:3000' : `${protocol}//${host}`;
			socket = io(socketUrl);
		}
		return socket;
	},

	listenToLogs(callback: (log: any) => void) {
		const s = this.getSocket();
		s.on('log', callback);
		return () => s.off('log', callback);
	},

	async getBots(): Promise<Bot[]> {
		const res = await fetch(`${API_BASE}/bots`);
		return res.json();
	},

	async getBot(id: string): Promise<Bot> {
		const res = await fetch(`${API_BASE}/bots/${id}`);
		return res.json();
	},

	async startBot(id: string): Promise<{ status: string; qr?: string; code?: string; message?: string }> {
		const res = await fetch(`${API_BASE}/bots/${id}/start`, { method: 'POST' });
		return res.json();
	},

	async stopBot(id: string): Promise<{ message: string }> {
		const res = await fetch(`${API_BASE}/bots/${id}/stop`, { method: 'POST' });
		return res.json();
	},

	async getSystemInfo(): Promise<SystemInfo> {
		const res = await fetch(`${API_BASE}/system`);
		return res.json();
	},

	async getLogs(id?: string, limit = 100): Promise<any[]> {
		const url = id ? `${API_BASE}/bots/${id}/logs?limit=${limit}` : `${API_BASE}/logs?limit=${limit}`;
		const res = await fetch(url);
		return res.json();
	},

	async getPlugins(): Promise<Plugin[]> {
		const res = await fetch(`${API_BASE}/plugins`);
		return res.json();
	},

	async togglePluginGlobal(name: string, disabled: boolean): Promise<{ message: string }> {
		const res = await fetch(`${API_BASE}/plugins/${name}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ disabled })
		});
		return res.json();
	},

	async updateBot(id: string, config: Partial<Bot['config']>): Promise<{ message: string; data: Bot }> {
		const res = await fetch(`${API_BASE}/bots/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(config)
		});
		return res.json();
	},

	async deleteBot(id: string): Promise<{ message: string }> {
		const res = await fetch(`${API_BASE}/bots/${id}`, { method: 'DELETE' });
		return res.json();
	},

	async registerBot(config: { name: string; phone?: string; method: string; start?: boolean }): Promise<{ message: string; data: Bot }> {
		const res = await fetch(`${API_BASE}/bots`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(config)
		});
		return res.json();
	}
};
