<script lang="ts">
	import { marked } from "marked";
	import privacy from "../../../PRIVACY.md?raw";
	import { env as envPublic } from "$env/dynamic/public";
</script>

<div class="overflow-auto p-6">
	<div class="prose mx-auto px-4 pb-24 pt-6 dark:prose-invert md:pt-12">
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html marked(privacy, { gfm: true })}
		{#if envPublic.PUBLIC_APP_ISSUE_URL || envPublic.PUBLIC_APP_PRIVACY_EMAIL}
			<p>
				To exercise privacy rights over your data (e.g. requesting deletion){#if envPublic.PUBLIC_APP_ISSUE_URL}, open
				an issue at <a href={envPublic.PUBLIC_APP_ISSUE_URL} target="_blank" rel="noreferrer"
					>{envPublic.PUBLIC_APP_ISSUE_URL}</a
				>{/if}{#if envPublic.PUBLIC_APP_PRIVACY_EMAIL} or email <a
					href="mailto:{envPublic.PUBLIC_APP_PRIVACY_EMAIL}">{envPublic.PUBLIC_APP_PRIVACY_EMAIL}</a
				>{/if}.
			</p>
		{/if}
	</div>
</div>
