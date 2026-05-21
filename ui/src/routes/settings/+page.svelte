<script lang="ts">
	import { onMount } from 'svelte';
	import { api, type SystemInfo, type Plugin } from '$lib/api';

	let system = $state<SystemInfo | null>(null);
	let plugins = $state<Plugin[]>([]);
	let loading = $state(true);

	async function refresh() {
		try {
			system = await api.getSystemInfo();
			plugins = await api.getPlugins();
		} catch (e) {}
		finally { loading = false; }
	}

	async function toggleGlobal(name: string, currentStatus: boolean) {
		try {
			await api.togglePluginGlobal(name, !currentStatus);
			await refresh();
		} catch (e) {
			console.error('Failed to toggle plugin globally:', e);
		}
	}

	onMount(() => {
		refresh();
		const interval = setInterval(refresh, 10000);
		return () => clearInterval(interval);
	});

	function formatBytes(bytes: number) {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}

	function formatUptime(seconds: number) {
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		return `${h}H ${m}M`;
	}

	function formatCmd(cmd: any) {
		if (!cmd) return '-';
		if (Array.isArray(cmd)) return cmd.join(', ');
		return cmd;
	}
</script>

<div class="space-y-6">
	<div class="border-b border-gray-800 pb-2">
		<h1 class="text-xs font-bold uppercase tracking-widest">System Architecture</h1>
	</div>

	{#if loading && !system}
		<div class="text-center py-10 uppercase text-[10px] font-bold text-gray-600">Retrieving environment data...</div>
	{:else if system}
		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			<!-- Software Info -->
			<div class="bg-gray-900 border border-gray-800">
				<div class="px-3 py-1.5 border-b border-gray-800 bg-gray-800/50 text-[10px] font-bold uppercase tracking-wider text-gray-400">Software Environment</div>
				<div class="p-3 space-y-2">
					<div class="flex justify-between border-b border-gray-800/50 pb-1">
						<span class="text-[9px] font-bold text-gray-500 uppercase">Build Version</span>
						<span class="text-[10px] font-mono">{system.version}</span>
					</div>
					<div class="flex justify-between border-b border-gray-800/50 pb-1">
						<span class="text-[9px] font-bold text-gray-500 uppercase">Runtime Engine</span>
						<span class="text-[10px] font-mono uppercase">{system.runtime.name} {system.runtime.version}</span>
					</div>
					<div class="flex justify-between border-b border-gray-800/50 pb-1">
						<span class="text-[9px] font-bold text-gray-500 uppercase">OS Distribution</span>
						<span class="text-[10px] font-mono uppercase">{system.os}</span>
					</div>
					<div class="flex justify-between border-b border-gray-800/50 pb-1">
						<span class="text-[9px] font-bold text-gray-500 uppercase">Kernel Level</span>
						<span class="text-[9px] font-mono uppercase text-right truncate max-w-[150px]">{system.kernel}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-[9px] font-bold text-gray-500 uppercase">System Uptime</span>
						<span class="text-[10px] font-mono uppercase">{formatUptime(system.uptime)}</span>
					</div>
				</div>
			</div>

			<!-- Hardware Info -->
			<div class="bg-gray-900 border border-gray-800">
				<div class="px-3 py-1.5 border-b border-gray-800 bg-gray-800/50 text-[10px] font-bold uppercase tracking-wider text-gray-400">Resource Allocation</div>
				<div class="p-3 space-y-2">
					<div class="flex justify-between border-b border-gray-800/50 pb-1">
						<span class="text-[9px] font-bold text-gray-500 uppercase">CPU Model</span>
						<span class="text-[9px] font-mono text-right uppercase truncate max-w-[150px]">{system.cpu}</span>
					</div>
					<div class="flex justify-between border-b border-gray-800/50 pb-1">
						<span class="text-[9px] font-bold text-gray-500 uppercase">Logical Cores</span>
						<span class="text-[10px] font-mono">{system.cpuCores}</span>
					</div>
					<div class="flex justify-between border-b border-gray-800/50 pb-1">
						<span class="text-[9px] font-bold text-gray-500 uppercase">Physical RAM</span>
						<span class="text-[10px] font-mono">{formatBytes(system.memory.total)}</span>
					</div>
					<div class="flex justify-between border-b border-gray-800/50 pb-1">
						<span class="text-[9px] font-bold text-gray-500 uppercase">Used Memory</span>
						<span class="text-[10px] font-mono">{formatBytes(system.memory.used)}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-[9px] font-bold text-gray-500 uppercase">Graphics UNIT</span>
						<span class="text-[9px] font-mono uppercase">{system.gpu}</span>
					</div>
				</div>
			</div>
		</div>

		<!-- Plugins Detailed -->
		<div class="bg-gray-900 border border-gray-800">
			<div class="px-3 py-1.5 border-b border-gray-800 bg-gray-800/50 text-[10px] font-bold uppercase tracking-wider text-gray-400">Module Registry Detailed</div>
			
			<!-- Desktop View -->
			<div class="hidden md:block overflow-x-auto">
				<table class="w-full text-left border-collapse text-[10px]">
					<thead>
						<tr class="bg-black/50 border-b border-gray-800">
							<th class="py-2 px-3 text-gray-500 uppercase font-black border-r border-gray-800">Module ID</th>
							<th class="py-2 px-3 text-gray-500 uppercase font-black border-r border-gray-800 text-center">Global</th>
							<th class="py-2 px-3 text-gray-500 uppercase font-black border-r border-gray-800">Category</th>
							<th class="py-2 px-3 text-gray-500 uppercase font-black border-r border-gray-800">Commands</th>
							<th class="py-2 px-3 text-gray-500 uppercase font-black">Description</th>
						</tr>
					</thead>
					<tbody>
						{#each plugins as plugin}
							<tr class="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors {plugin.disabled ? 'opacity-40 grayscale' : ''}">
								<td class="py-1.5 px-3 font-bold text-blue-400 border-r border-gray-800 uppercase">{plugin.name}</td>
								<td class="py-1.5 px-3 border-r border-gray-800 text-center">
									<button 
										onclick={() => toggleGlobal(plugin.name, !!plugin.disabled)}
										class="w-8 h-4 bg-gray-800 rounded-full relative transition-colors {plugin.disabled ? 'bg-gray-700' : 'bg-green-600'}"
										aria-label="Toggle Plugin Globally"
									>
										<span class="absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all {plugin.disabled ? 'left-0.5' : 'left-4.5'}"></span>
									</button>
								</td>
								<td class="py-1.5 px-3 border-r border-gray-800">
									<span class="px-1.5 py-0.5 bg-gray-800 text-[9px] font-black uppercase text-gray-400 border border-gray-700">
										{plugin.cat || 'general'}
									</span>
								</td>
								<td class="py-1.5 px-3 border-r border-gray-800 font-mono text-gray-300">
									{formatCmd(plugin.cmd)}
								</td>
								<td class="py-1.5 px-3 text-gray-500 italic truncate max-w-xs">
									{plugin.desc || 'No documentation provided.'}
								</td>
							</tr>
						{/each}
						{#if plugins.length === 0}
							<tr>
								<td colspan="4" class="py-8 text-center text-gray-700 font-black uppercase tracking-widest italic">
									Registry empty. No modules identified.
								</td>
							</tr>
						{/if}
					</tbody>
				</table>
			</div>

			<!-- Mobile View -->
			<div class="md:hidden divide-y divide-gray-800">
				{#each plugins as plugin}
					<div class="p-3 space-y-2 {plugin.disabled ? 'opacity-40 grayscale' : ''}">
						<div class="flex justify-between items-center">
							<div class="flex flex-col">
								<span class="text-xs font-bold text-blue-400 uppercase">{plugin.name}</span>
								<span class="text-[8px] text-gray-600 font-bold uppercase mt-0.5">{plugin.disabled ? 'Disabled Globally' : 'Active'}</span>
							</div>
							<div class="flex items-center gap-3">
								<button 
									onclick={() => toggleGlobal(plugin.name, !!plugin.disabled)}
									class="w-8 h-4 bg-gray-800 rounded-full relative transition-colors {plugin.disabled ? 'bg-gray-700' : 'bg-green-600'}"
									aria-label="Toggle Plugin Globally"
								>
									<span class="absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all {plugin.disabled ? 'left-0.5' : 'left-4.5'}"></span>
								</button>
								<span class="px-1.5 py-0.5 bg-gray-800 text-[8px] font-black uppercase text-gray-400 border border-gray-700">
									{plugin.cat || 'general'}
								</span>
							</div>
						</div>
						<div class="bg-black/50 p-2 border border-gray-800">
							<span class="block text-[8px] text-gray-500 font-bold uppercase mb-1">Trigger Hooks</span>
							<span class="text-[9px] font-mono text-gray-300 break-all">{formatCmd(plugin.cmd)}</span>
						</div>
						<p class="text-[10px] text-gray-500 italic">
							{plugin.desc || 'No documentation provided.'}
						</p>
					</div>
				{/each}
				{#if plugins.length === 0}
					<div class="py-8 text-center text-gray-700 font-black uppercase tracking-widest italic text-[10px]">
						Registry empty. No modules identified.
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
