<script lang="ts">
	import { onMount } from 'svelte';
	import { api, type Bot, type SystemInfo } from '$lib/api';

	let bots = $state<Bot[]>([]);
	let system = $state<SystemInfo | null>(null);
	let logs = $state<any[]>([]);
	let loading = $state(true);

	async function loadData() {
		try {
			const [botsData, systemData, logsData] = await Promise.all([
				api.getBots(),
				api.getSystemInfo(),
				api.getLogs(undefined, 10)
			]);
			bots = botsData;
			system = systemData;
			logs = logsData;
		} catch (e) {
			console.error('Failed to load data:', e);
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		loadData();
		const interval = setInterval(loadData, 5000);
		
		const unsubscribe = api.listenToLogs((log) => {
			logs = [log, ...logs].slice(0, 10);
		});

		return () => {
			clearInterval(interval);
			unsubscribe();
		};
	});

	function getStatusColor(status: string) {
		switch (status.toLowerCase()) {
			case 'connected':
				return 'text-green-400';
			case 'connecting':
				return 'text-yellow-400';
			case 'disconnected':
				return 'text-red-400';
			default:
				return 'text-gray-400';
		}
	}

	function formatBytes(bytes: number) {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}
</script>

<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
	<div class="bg-gray-900 p-4 border border-gray-800">
		<h2 class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Total Bots</h2>
		<p class="text-2xl font-bold mt-1 leading-none">{bots.length}</p>
	</div>
	<div class="bg-gray-900 p-4 border border-gray-800">
		<h2 class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Active Bots</h2>
		<p class="text-2xl font-bold mt-1 leading-none text-green-400">
			{bots.filter((b) => b.status === 'connected').length}
		</p>
	</div>
	<div class="bg-gray-900 p-4 border border-gray-800">
		<h2 class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Memory Usage</h2>
		<p class="text-2xl font-bold mt-1 leading-none text-blue-400">
			{system ? formatBytes(system.memory.used) : '...'}
		</p>
	</div>
</div>

<div class="mt-8">
	<div class="flex justify-between items-center mb-4">
		<h2 class="text-sm font-bold uppercase tracking-widest">Connected Bots</h2>
		<button
			onclick={loadData}
			class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-[10px] font-bold uppercase transition-colors"
		>
			Refresh
		</button>
	</div>

	{#if loading && bots.length === 0}
		<div class="text-center py-8 text-gray-600 italic text-xs uppercase font-bold">Loading...</div>
	{:else}
		<!-- Desktop Table View -->
		<div class="hidden md:block overflow-x-auto border border-gray-800">
			<table class="w-full text-left border-collapse bg-gray-900">
				<thead>
					<tr class="bg-gray-800">
						<th class="py-2 px-3 text-gray-400 text-[10px] font-bold uppercase tracking-wider border-r border-gray-700">Name</th>
						<th class="py-2 px-3 text-gray-400 text-[10px] font-bold uppercase tracking-wider border-r border-gray-700">Method</th>
						<th class="py-2 px-3 text-gray-400 text-[10px] font-bold uppercase tracking-wider border-r border-gray-700">Status</th>
						<th class="py-2 px-3 text-gray-400 text-[10px] font-bold uppercase tracking-wider text-right">Actions</th>
					</tr>
				</thead>
				<tbody class="text-xs">
					{#each bots as bot}
						<tr class="border-b border-gray-800 hover:bg-gray-800 transition-colors">
							<td class="py-2 px-3 font-bold border-r border-gray-800">
								{bot.name}
								{#if bot.phone}
									<span class="block text-[9px] text-gray-500 font-normal">{bot.phone}</span>
								{/if}
							</td>
							<td class="py-2 px-3 text-gray-300 uppercase text-[10px] border-r border-gray-800">{bot.method}</td>
							<td class="py-2 px-3 border-r border-gray-800">
								<span class="inline-flex items-center gap-2 uppercase text-[10px] font-bold">
									<span class="w-2 h-2 bg-current {getStatusColor(bot.status)}"></span>
									{bot.status}
								</span>
							</td>
							<td class="py-2 px-3 text-right space-x-3">
								<a href="/bots/{bot.id}" title="Manage" class="text-blue-400 hover:scale-110 inline-block transition-transform text-xs">⚙️</a>
								{#if bot.status === 'connected' || bot.status === 'connecting'}
									<button
										onclick={() => api.stopBot(bot.id).then(loadData)}
										title="Stop"
										class="text-red-400 hover:scale-110 transition-transform text-xs">🛑</button
									>
								{:else}
									<button
										onclick={() => api.startBot(bot.id).then(loadData)}
										title="Start"
										class="text-green-400 hover:scale-110 transition-transform text-xs">🚀</button
									>
								{/if}
							</td>
						</tr>
					{/each}
					{#if bots.length === 0}
						<tr>
							<td colspan="4" class="py-8 text-center text-gray-600 uppercase text-[10px] font-bold">No bots detected.</td>
						</tr>
					{/if}
				</tbody>
			</table>
		</div>

		<!-- Mobile Card View -->
		<div class="md:hidden space-y-4">
			{#each bots as bot}
				<div class="bg-gray-900 border border-gray-800 p-4">
					<div class="flex justify-between items-start mb-3">
						<div>
							<h3 class="text-sm font-bold uppercase">{bot.name}</h3>
							<p class="text-[9px] text-gray-500 font-bold uppercase mt-0.5">{bot.phone || 'NO PHONE'}</p>
						</div>
						<span class="inline-flex items-center gap-1.5 uppercase text-[9px] font-bold px-2 py-0.5 bg-black/50 border border-gray-800">
							<span class="w-1.5 h-1.5 bg-current {getStatusColor(bot.status)}"></span>
							{bot.status}
						</span>
					</div>
					
					<div class="grid grid-cols-2 gap-2 mb-4">
						<div class="bg-black/30 p-2 border border-gray-800/50">
							<span class="block text-[8px] text-gray-500 font-bold uppercase">Method</span>
							<span class="text-[10px] font-bold uppercase">{bot.method}</span>
						</div>
						<div class="bg-black/30 p-2 border border-gray-800/50">
							<span class="block text-[8px] text-gray-500 font-bold uppercase">Auth</span>
							<span class="text-[10px] font-bold uppercase {bot.authenticated ? 'text-blue-500' : 'text-yellow-500'}">
								{bot.authenticated ? 'YES' : 'NO'}
							</span>
						</div>
					</div>

					<div class="flex gap-2">
						<a href="/bots/{bot.id}" class="flex-1 bg-gray-800 hover:bg-gray-700 text-center py-2 text-sm transition-colors" title="Manage">
							⚙️
						</a>
						{#if bot.status === 'connected' || bot.status === 'connecting'}
							<button
								onclick={() => api.stopBot(bot.id).then(loadData)}
								class="flex-1 bg-red-900/20 hover:bg-red-900/30 text-center py-2 text-sm transition-colors"
								title="Stop"
							>
								🛑
							</button>
						{:else}
							<button
								onclick={() => api.startBot(bot.id).then(loadData)}
								class="flex-1 bg-green-900/20 hover:bg-green-900/30 text-center py-2 text-sm transition-colors"
								title="Start"
							>
								🚀
							</button>
						{/if}
					</div>
				</div>
			{/each}
			{#if bots.length === 0}
				<div class="py-8 text-center text-gray-600 uppercase text-[10px] font-bold border border-dashed border-gray-800">
					No bots detected.
				</div>
			{/if}
		</div>
	{/if}

	<div class="mt-8 bg-gray-900 border border-gray-800">
		<div class="px-3 py-2 border-b border-gray-800 bg-gray-800/50 flex justify-between items-center">
			<h3 class="text-[10px] font-bold uppercase tracking-widest">Recent System Activity</h3>
			<span class="text-[9px] text-gray-500 font-bold uppercase">Global Feed</span>
		</div>
		<div class="p-3 font-mono text-[10px] space-y-1 bg-black">
			{#each logs as log}
				<div class="flex gap-2 md:gap-3 leading-tight">
					<span class="text-gray-700 shrink-0 uppercase">[{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}]</span>
					<span class="text-blue-500 shrink-0 uppercase w-10 md:w-12">[{log.source || 'SYS'}]</span>
					<span class="break-words {log.level === 'ERROR' ? 'text-red-500' : log.level === 'WARN' ? 'text-yellow-500' : 'text-gray-400'}">
						{log.message}
					</span>
				</div>
			{/each}
			{#if logs.length === 0}
				<div class="text-gray-700 italic uppercase">No activity recorded.</div>
			{/if}
		</div>
	</div>
</div>
