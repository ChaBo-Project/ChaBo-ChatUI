<script lang="ts">
	import { env as envPublic } from "$env/dynamic/public";
	import Logo from "$lib/components/icons/Logo.svelte";
	import { createEventDispatcher } from "svelte";
	import IconGear from "~icons/bi/gear-fill";
	import AnnouncementBanner from "../AnnouncementBanner.svelte";
	import type { Model } from "$lib/types/Model";
	import ModelCardMetadata from "../ModelCardMetadata.svelte";
	import { base } from "$app/paths";
	import JSON5 from "json5";

	export let currentModel: Model;

	const announcementBanners = envPublic.PUBLIC_ANNOUNCEMENT_BANNERS
		? JSON5.parse(envPublic.PUBLIC_ANNOUNCEMENT_BANNERS)
		: [];

	const dispatch = createEventDispatcher<{ message: string }>();
</script>

<div class="my-auto grid gap-8 lg:grid-cols-3">
	<div class="lg:col-span-1">
		<div>
			<div class="mb-3 flex items-center text-2xl font-semibold">
				<Logo classNames="mr-1 flex-none" />
				{envPublic.PUBLIC_APP_NAME}
				<div
					class="ml-3 flex h-6 items-center rounded-lg border border-gray-100 bg-gray-50 px-2 text-base text-gray-400 dark:border-gray-700/60 dark:bg-gray-800"
				>
					v{envPublic.PUBLIC_VERSION}
				</div>
			</div>
			<p class="text-base text-gray-600 dark:text-gray-400">
				{envPublic.PUBLIC_APP_DESCRIPTION ||
					"Making the community's best AI chat models available to everyone."}
			</p>
		</div>
	</div>
	<div class="lg:col-span-2 lg:pl-24">
		{#each announcementBanners as banner}
			<AnnouncementBanner classNames="mb-4" title={banner.title}>
				<a
					target="_blank"
					href={banner.linkHref}
					class="mr-2 flex items-center underline hover:no-underline">{banner.linkTitle}</a
				>
			</AnnouncementBanner>
		{/each}
		<div class="overflow-hidden rounded-xl border dark:border-gray-800">
			<div class="flex p-3">
				<div>
					<div class="text-sm text-gray-600 dark:text-gray-400">Current Assistant</div>
					<div class="flex items-center gap-1.5 font-semibold max-sm:text-smd">
						{#if currentModel.logoUrl}
							<img
								class=" overflown aspect-square size-4 rounded border dark:border-gray-700"
								src={currentModel.logoUrl}
								alt=""
							/>
						{:else}
							<div class="size-4 rounded border border-transparent bg-gray-300 dark:bg-gray-800" />
						{/if}
						{currentModel.displayName}
					</div>
				</div>
				<!-- <a
					href="{base}/settings/{currentModel.id}"
					class="btn ml-auto flex h-7 w-7 self-start rounded-full bg-gray-100 p-1 text-xs hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-600"
					><IconGear /></a
				> -->
			</div>
			<!-- <ModelCardMetadata variant="dark" model={currentModel} /> -->
		</div>
	</div>
	
	<!-- ADD MODEL-SPECIFIC INSTRUCTIONS HERE (after line 73) -->
	<!-- {#if currentModel.name === 'uganda_auditbot'}
		<div class="lg:col-span-2 lg:pl-24 mt-4">
			<div class="rounded-lg bg-blue-50 border border-blue-200 p-4 dark:bg-blue-900/20 dark:border-blue-700">
				<h3 class="font-semibold text-blue-800 dark:text-blue-200 mb-2">Uganda Auditbot Instructions</h3>
				<p class="text-blue-700 dark:text-blue-300 text-sm whitespace-pre-line">
					This assistant specializes in Uganda fiscal documents. Upload PDFs or Word documents, for analysis. Ask questions about budget allocations, financial reports, or audit findings.
				</p>
			</div>
		</div>
	{:else if currentModel.name === 'asistente_eudr'}
		<div class="lg:col-span-2 lg:pl-24 mt-4">
			<div class="rounded-lg bg-green-50 border border-green-200 p-4 dark:bg-green-900/20 dark:border-green-700">
				<h3 class="font-semibold text-green-800 dark:text-green-200 mb-2">EUDR Assistant Instructions</h3>
				<p class="text-green-700 dark:text-green-300 text-sm whitespace-pre-line">
					This assistant works with the EUDR vector store and Whisp API data. Query the vector store with natural language or upload a GeoJSON file for analysis by the Whisp API.

					<strong>Note:</strong> to initialize Geojson workflow: Upload the file, then write any word in the prompt (e.g. "test") and click submit.
				</p>
			</div>
		</div>
	{:else if currentModel.name === 'chatfed_poc'}
		<div class="lg:col-span-2 lg:pl-24 mt-4">
			<div class="rounded-lg bg-purple-50 border border-purple-200 p-4 dark:bg-purple-900/20 dark:border-purple-700">
				<h3 class="font-semibold text-purple-800 dark:text-purple-200 mb-2">ChatFed PoC Instructions</h3>
				<p class="text-purple-700 dark:text-purple-300 text-sm whitespace-pre-line">
					This is a proof-of-concept assistant with multi-resource workflows.
					- Natural language queries: Uganda audit assistance vector store
					- Document upload: Direct analysis or combine with a query for the Uganda audit assistance vector store
					- GeoJSON upload: Analysis via Whisp API

					<strong>Note:</strong> to initialize Geojson workflow: Upload the file, then write any word in the prompt (e.g. "test") and click submit.
				</p>
			</div>
		</div>
	{/if} -->

	{#if currentModel.instructions}
	<div class="lg:col-span-2 lg:pl-24 mt-4">
		<div class="rounded-lg bg-blue-50 border border-blue-200 p-4 dark:bg-blue-900/20 dark:border-blue-700">
			<h3 class="font-semibold text-blue-800 dark:text-blue-200 mb-2">{currentModel.instructions.title || 'Model Instructions'}</h3>
			<p class="text-blue-700 dark:text-blue-300 text-sm whitespace-pre-line">
				{currentModel.instructions.content}
			</p>
		</div>
	</div>
	{/if}
	
	{#if currentModel.promptExamples}
		<div class="lg:col-span-3 lg:mt-6">
			<p class="mb-3 text-gray-600 dark:text-gray-300">Examples</p>
			<div class="grid gap-3 lg:grid-cols-3 lg:gap-5">
				{#each currentModel.promptExamples as example}
					<button
						type="button"
						class="rounded-xl border bg-gray-50 p-3 text-gray-600 hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 max-xl:text-sm xl:p-3.5"
						on:click={() => dispatch("message", example.prompt)}
					>
						{example.title}
					</button>
				{/each}
			</div>
		</div>{/if}
	<div class="h-40 sm:h-24" />
</div>
