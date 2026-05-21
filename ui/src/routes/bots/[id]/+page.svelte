<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { api, type Bot, type Plugin } from '$lib/api';

	const id = page.params.id as string;
	let bot = $state<Bot | null>(null);
	let allPlugins = $state<Plugin[]>([]);
	let logs = $state<any[]>([]);
	let authData = $state<{ status: string; qr?: string; code?: string } | null>(null);
	let loading = $state(true);
	let saving = $state(false);

	let editPrefixes = $state('');

	async function loadBot() {
		try {
			const [botData, pluginsData] = await Promise.all([
				api.getBot(id).catch(() => null),
				api.getPlugins().catch(() => [])
			]);
			
			if (botData) {
				bot = botData;
				editPrefixes = bot.config.prefixes.join(' ');
			}
			allPlugins = pluginsData;
			
			const recentLogs = await api.getLogs(id, 50).catch(() => []);
			logs = recentLogs;
		} catch (e) {
			console.error('Failed to load bot details:', e);
		} finally {
			loading = false;
		}
	}

	async function saveConfig() {
		if (!bot) return;
		saving = true;
		try {
			const prefixes = editPrefixes.split(/\s+/).filter(p => p.length > 0);
			await api.updateBot(id, {
				prefixes,
				plugins: bot.config.plugins,
				autostart: bot.config.autostart
			});
			await loadBot();
		} catch (e) {
			console.error('Failed to save config:', e);
		} finally {
			saving = false;
		}
	}

	function togglePlugin(pluginName: string) {
		if (!bot) return;
		const plugins = [...bot.config.plugins];
		const index = plugins.indexOf(pluginName);
		if (index === -1) {
			plugins.push(pluginName);
		} else {
			plugins.splice(index, 1);
		}
		bot.config.plugins = plugins;
	}

	async function toggleBot() {
		if (!bot) return;
		if (bot.status === 'connected' || bot.status === 'connecting') {
			await api.stopBot(id);
			authData = null; // Clear any pending auth UI
		} else {
			const res = await api.startBot(id);
			if (res.status === 'waiting_qr' || res.status === 'waiting_code') {
				authData = res;
			}
		}
		loadBot();
	}

	onMount(() => {
		loadBot();
		const interval = setInterval(() => {
			loadBot();
		}, 10000); // Polling slower since logs are real-time

		const unsubscribe = api.listenToLogs((log) => {
			if (log.source.includes(id)) {
				logs = [log, ...logs].slice(0, 50);
			}
		});

		return () => {
			clearInterval(interval);
			unsubscribe();
		};
	});

	function formatUptime(ms: number) {
		const seconds = Math.floor((ms / 1000) % 60);
		const minutes = Math.floor((ms / (1000 * 60)) % 60);
		const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
		const days = Math.floor(ms / (1000 * 60 * 60 * 24));
		return `${days}D ${hours}H ${minutes}M ${seconds}S`;
	}
</script>

{#if loading && !bot}
	<div class="flex justify-center items-center h-64 border border-gray-800 bg-gray-900 font-bold text-xs uppercase">
		Processing...
	</div>
{:else if bot}
	<div class="space-y-4">
		<div class="flex justify-between items-start border-b border-gray-800 pb-2 bg-gray-900 p-3">
			<div>
				<h1 class="text-xs font-bold uppercase tracking-widest">{bot.name}</h1>
				<p class="text-[9px] text-gray-500 font-bold mt-1">ID: {bot.id} | METHOD: {bot.method.toUpperCase()}</p>
			</div>
			<button
				onclick={toggleBot}
				class="px-4 py-1 text-sm font-bold uppercase transition-colors {bot.status === 'connected' || bot.status === 'connecting'
					? 'bg-red-900/30 text-red-500 border border-red-900'
					: 'bg-green-900/30 text-green-500 border border-green-900'}"
				title={bot.status === 'connected' || bot.status === 'connecting' ? 'Terminate' : 'Initialize'}
			>
				{bot.status === 'connected' || bot.status === 'connecting' ? '💀' : '🔌'}
			</button>
		</div>

		{#if authData}
			<div class="bg-white text-black p-4 border border-gray-800 flex flex-col items-center gap-2">
				<h3 class="text-[10px] font-bold uppercase tracking-widest border-b border-gray-200 w-full text-center pb-2">Auth Required</h3>
				{#if authData.qr}
					<img src="/api/qrcode?data={encodeURIComponent(authData.qr)}" alt="QR Code" class="w-48 h-48" />
					<p class="text-[9px] font-bold uppercase text-gray-500">Scan QR via WhatsApp</p>
				{:else if authData.code}
					<div class="text-3xl font-mono tracking-tighter font-black p-2 bg-gray-100 border border-gray-300">
						{authData.code}
					</div>
					<p class="text-[9px] font-bold uppercase text-gray-500">Enter code in Link Device</p>
				{/if}
				<button onclick={() => (authData = null)} class="text-[9px] font-bold uppercase underline mt-2">Dismiss</button>
			</div>
		{/if}

		<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
			<div class="bg-gray-900 p-3 border border-gray-800">
				<h3 class="text-[9px] font-bold text-gray-500 uppercase tracking-widest">State</h3>
				<p class="text-sm font-bold mt-1 uppercase {bot.status === 'connected' ? 'text-green-500' : 'text-red-500'}">
					{bot.status}
				</p>
			</div>
			<div class="bg-gray-900 p-3 border border-gray-800">
				<h3 class="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Uptime</h3>
				<p class="text-sm font-bold mt-1 uppercase">{formatUptime(bot.uptime)}</p>
			</div>
			<div class="bg-gray-900 p-3 border border-gray-800">
				<h3 class="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Auth</h3>
				<p class="text-sm font-bold mt-1 uppercase {bot.authenticated ? 'text-blue-500' : 'text-yellow-500'}">
					{bot.authenticated ? 'Verified' : 'Pending'}
				</p>
			</div>
		</div>

		<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
			<!-- Configuration -->
			<div class="bg-gray-900 border border-gray-800 flex flex-col">
				<div class="px-3 py-2 border-b border-gray-800 bg-gray-800/50 flex justify-between items-center">
					<h3 class="text-[10px] font-bold uppercase tracking-widest">Configuration</h3>
					<button
						onclick={saveConfig}
						disabled={saving}
						class="text-xs font-bold uppercase text-blue-400 hover:text-blue-300 disabled:text-gray-600 transition-transform hover:scale-110"
						title={saving ? 'Saving...' : 'Save Changes'}
					>
						{saving ? '⌛' : '💾'}
					</button>
				</div>
				<div class="p-3 space-y-4">
					<div>
						<label for="prefixes" class="block text-[9px] font-bold text-gray-500 uppercase mb-1">Command Prefixes (Space separated)</label>
						<input
							id="prefixes"
							bind:value={editPrefixes}
							class="w-full bg-black border border-gray-800 p-2 text-xs text-white focus:outline-none focus:border-blue-600 font-mono"
							placeholder=". / !"
							/>
							</div>
							<div class="flex items-center gap-2 p-2 bg-black/50 border border-gray-800 cursor-pointer hover:border-gray-700 transition-colors">
							<input
							type="checkbox"
							id="autostart-toggle"
							bind:checked={bot.config.autostart}
							class="accent-blue-600"
							/>
							<label for="autostart-toggle" class="text-[10px] font-bold uppercase cursor-pointer flex-1">Autostart on Boot</label>
							</div>
							<div>
								<label for="plugins-list" class="block text-[9px] font-bold text-gray-500 uppercase mb-2">Active Modules</label>
								<div id="plugins-list" class="grid grid-cols-2 sm:grid-cols-3 gap-1 max-h-40 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-800">
									{#each allPlugins as plugin}
										<label class="flex items-center gap-1.5 p-1 bg-black/50 border border-gray-800 cursor-pointer hover:border-gray-700 transition-colors">
											<input
												type="checkbox"
												checked={bot.config.plugins.includes(plugin.name)}
												onchange={() => togglePlugin(plugin.name)}
												class="w-3 h-3 accent-blue-600"
											/>
											<span class="text-[9px] font-bold uppercase truncate leading-none">{plugin.name}</span>
										</label>
									{/each}
								</div>
							</div>
				</div>
			</div>

			<!-- Logs -->
			<div class="bg-gray-900 border border-gray-800 flex flex-col">
				<div class="px-3 py-2 border-b border-gray-800 bg-gray-800/50 flex justify-between items-center">
					<h3 class="text-[10px] font-bold uppercase tracking-widest">System Logs</h3>
					<span class="text-[9px] text-gray-500 font-bold uppercase">Buffer: 50L</span>
				</div>
				<div class="p-3 h-full max-h-72 overflow-y-auto font-mono text-[10px] space-y-0.5 bg-black scrollbar-thin scrollbar-thumb-gray-800">
					{#each logs as log}
						<div class="flex gap-2 md:gap-3 leading-tight border-b border-gray-900 pb-0.5">
							<span class="text-gray-700 shrink-0 uppercase">[{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}]</span>
							<span class="break-words {log.level === 'ERROR' ? 'text-red-500' : log.level === 'WARN' ? 'text-yellow-500' : 'text-gray-400'}">
								{log.message}
							</span>
						</div>
					{/each}
					{#if logs.length === 0}
						<div class="text-gray-700 italic uppercase">No diagnostic data...</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
{:else}
	<div class="text-center py-10 border border-gray-800 bg-gray-900">
		<h2 class="text-xs font-bold uppercase text-gray-500">Reference Error: Bot Identity Not Found</h2>
		<a href="/" class="text-blue-500 mt-2 inline-block text-[10px] font-bold uppercase underline">Return to System</a>
	</div>
{/if}
