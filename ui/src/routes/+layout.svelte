<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { api, type SystemInfo } from '$lib/api';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
	let system = $state<SystemInfo | null>(null);
	let mobileMenuOpen = $state(false);

	const navItems = [
		{ name: 'Dashboard', href: '/' },
		{ name: 'Bots', href: '/bots' },
		{ name: 'Settings', href: '/settings' }
	];

	function isActive(href: string) {
		if (href === '/') return page.url.pathname === '/';
		return page.url.pathname.startsWith(href);
	}

	function closeMenu() {
		mobileMenuOpen = false;
	}

	onMount(async () => {
		try {
			system = await api.getSystemInfo();
		} catch (e) {}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Mushi API Bot Manager</title>
</svelte:head>

<div class="min-h-screen bg-gray-950 text-white font-mono selection:bg-blue-500/30">
	<!-- Navbar -->
	<nav class="sticky top-0 z-50 bg-gray-900 border-b border-gray-800">
		<div class="container mx-auto px-4 h-12 flex justify-between items-center">
			<div class="flex items-center gap-2">
				<div class="w-6 h-6 bg-blue-600 flex items-center justify-center font-bold text-sm">M</div>
				<h1 class="text-sm font-bold tracking-tight uppercase">
					Mushi Manager
				</h1>
			</div>
			
			<!-- Desktop Nav -->
			<div class="hidden md:flex items-center h-full">
				{#each navItems as item}
					<a
						href={item.href}
						class="px-4 h-12 flex items-center text-xs font-bold transition-all duration-200 border-b-2 {isActive(item.href)
							? 'border-blue-600 bg-gray-800 text-white'
							: 'border-transparent text-gray-400 hover:text-white hover:bg-gray-800'}"
					>
						{item.name}
					</a>
				{/each}
			</div>

			<div class="flex items-center gap-4">
				<div class="hidden sm:flex items-center gap-2">
					<span class="w-2 h-2 bg-green-500"></span>
					<span class="text-[10px] text-gray-500 font-bold uppercase">v{system?.version || '...' }</span>
				</div>
				
				<!-- Mobile Menu Toggle -->
				<button 
					onclick={() => mobileMenuOpen = !mobileMenuOpen}
					class="md:hidden w-8 h-8 flex flex-col items-center justify-center gap-1.5"
					aria-label="Toggle Menu"
				>
					<span class="w-5 h-0.5 bg-white transition-transform {mobileMenuOpen ? 'rotate-45 translate-y-2' : ''}"></span>
					<span class="w-5 h-0.5 bg-white transition-opacity {mobileMenuOpen ? 'opacity-0' : ''}"></span>
					<span class="w-5 h-0.5 bg-white transition-transform {mobileMenuOpen ? '-rotate-45 -translate-y-2' : ''}"></span>
				</button>
			</div>
		</div>

		<!-- Mobile Nav Overlay -->
		{#if mobileMenuOpen}
			<div class="md:hidden absolute top-12 left-0 w-full bg-gray-900 border-b border-gray-800 animate-in fade-in slide-in-from-top duration-200">
				<div class="flex flex-col">
					{#each navItems as item}
						<a
							href={item.href}
							onclick={closeMenu}
							class="px-6 py-4 text-xs font-bold border-l-4 {isActive(item.href)
								? 'border-blue-600 bg-gray-800 text-white'
								: 'border-transparent text-gray-400 hover:text-white hover:bg-gray-800'}"
						>
							{item.name}
						</a>
					{/each}
					<div class="px-6 py-4 border-t border-gray-800 flex items-center gap-2">
						<span class="w-2 h-2 bg-green-500"></span>
						<span class="text-[10px] text-gray-500 font-bold uppercase">System Active v{system?.version || '...' }</span>
					</div>
				</div>
			</div>
		{/if}
	</nav>

	<!-- Main Content -->
	<main class="container mx-auto px-4 py-4 min-h-[calc(100vh-80px)]">
		{@render children()}
	</main>

	<!-- Footer -->
	<footer class="border-t border-gray-900 py-4 bg-gray-900/30">
		<div class="container mx-auto px-4 text-left text-gray-600 text-[10px] uppercase font-bold tracking-widest">
			<p>© 2026 Ginko. Distributed under MPL-2.0 License.</p>
		</div>
	</footer>
</div>
