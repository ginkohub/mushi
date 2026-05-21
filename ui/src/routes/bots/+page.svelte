<script lang="ts">
	import { onMount } from 'svelte';
	import { api, type Bot } from '$lib/api';

	let bots = $state<Bot[]>([]);
	let showModal = $state(false);
	let newBot = $state({
		name: '',
		phone: '',
		method: 'qr' as 'qr' | 'otp',
		start: true,
		autostart: true
	});

	async function loadBots() {
		bots = await api.getBots();
	}

	async function registerBot() {
		try {
			await api.registerBot(newBot);
			showModal = false;
			newBot = { name: '', phone: '', method: 'qr', start: true, autostart: true };
			loadBots();
		} catch (e) {
			console.error('Failed to register bot:', e);
		}
	}

	async function deleteBot(id: string) {
		if (confirm(`Confirm decommissioning of ${id}?`)) {
			await api.deleteBot(id);
			loadBots();
		}
	}

	onMount(loadBots);
</script>

<div class="space-y-4">
	<div class="flex justify-between items-center border-b border-gray-800 pb-2">
		<h1 class="text-xs font-bold uppercase tracking-widest">Bot Registry</h1>
		<button
			onclick={() => (showModal = true)}
			class="bg-blue-600 hover:bg-blue-700 px-3 py-1 text-sm font-bold uppercase transition-colors"
			title="Register Bot"
		>
			➕
		</button>
	</div>

	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
		{#each bots as bot}
			<div class="bg-gray-900 border border-gray-800 flex flex-col">
				<div class="p-3 border-b border-gray-800 flex justify-between items-center bg-gray-800/30">
					<h3 class="text-xs font-bold truncate uppercase">{bot.name}</h3>
					<span class="w-2 h-2 {bot.status === 'connected' ? 'bg-green-500' : 'bg-red-500'}"></span>
				</div>
				<div class="p-3 flex-1 space-y-1">
					<p class="text-[10px] text-gray-500 font-bold uppercase">ID: {bot.id}</p>
					<p class="text-[10px] text-gray-500 font-bold uppercase">Mode: {bot.method}</p>
				</div>
				<div class="flex border-t border-gray-800">
					<a
						href="/bots/{bot.id}"
						class="flex-1 text-center bg-gray-800 hover:bg-gray-700 py-2 text-sm font-bold transition-colors border-r border-gray-700"
						title="Manage"
					>
						🛠️
					</a>
					<button
						onclick={() => deleteBot(bot.id)}
						class="px-3 bg-red-900/20 hover:bg-red-900/40 text-center py-2 text-sm font-bold transition-colors"
						title="Delete"
					>
						🗑️
					</button>
				</div>
			</div>
		{/each}
	</div>

	{#if showModal}
		<div class="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50">
			<div class="bg-gray-900 border border-gray-800 w-full max-w-sm">
				<div class="p-3 border-b border-gray-800 flex justify-between items-center bg-gray-800/50">
					<h2 class="text-[10px] font-bold uppercase tracking-widest">New Bot Registration</h2>
					<button onclick={() => (showModal = false)} class="text-gray-500 hover:text-white text-lg leading-none">&times;</button>
				</div>
				<form
					onsubmit={(e) => {
						e.preventDefault();
						registerBot();
					}}
					class="p-4 space-y-4"
				>
					<div>
						<label for="bot-name" class="block text-[9px] font-bold text-gray-500 uppercase mb-1">Identification Name</label>
						<input
							id="bot-name"
							bind:value={newBot.name}
							class="w-full bg-black border border-gray-800 p-2 text-xs text-white focus:outline-none focus:border-blue-600"
							required
						/>
					</div>
					<div>
						<label for="bot-method" class="block text-[9px] font-bold text-gray-500 uppercase mb-1">Handshake Method</label>
						<select
							id="bot-method"
							bind:value={newBot.method}
							class="w-full bg-black border border-gray-800 p-2 text-xs text-white focus:outline-none focus:border-blue-600"
						>
							<option value="qr">QR Code</option>
							<option value="otp">Pairing Code (OTP)</option>
						</select>
					</div>
					{#if newBot.method === 'otp'}
						<div>
							<label for="bot-phone" class="block text-[9px] font-bold text-gray-500 uppercase mb-1">Phone String</label>
							<input
								id="bot-phone"
								bind:value={newBot.phone}
								class="w-full bg-black border border-gray-800 p-2 text-xs text-white focus:outline-none focus:border-blue-600"
								required
							/>
						</div>
					{/if}
					<div class="flex items-center gap-2 py-1">
						<input type="checkbox" bind:checked={newBot.start} id="start" class="accent-blue-600" />
						<label for="start" class="text-[10px] text-gray-400 uppercase font-bold">Connect Immediately</label>
					</div>
					<div class="flex items-center gap-2 py-1">
						<input type="checkbox" bind:checked={newBot.autostart} id="autostart" class="accent-blue-600" />
						<label for="autostart" class="text-[10px] text-gray-400 uppercase font-bold">Autostart on Boot</label>
					</div>
					<div class="pt-2 flex gap-2">
						<button
							type="button"
							onclick={() => (showModal = false)}
							class="flex-1 bg-gray-800 hover:bg-gray-700 py-2 text-[10px] font-bold uppercase transition-colors"
						>
							Abort
						</button>
						<button
							type="submit"
							class="flex-1 bg-blue-600 hover:bg-blue-700 py-2 text-[10px] font-bold uppercase transition-colors"
						>
							Execute
						</button>
					</div>
				</form>
			</div>
		</div>
	{/if}
</div>
