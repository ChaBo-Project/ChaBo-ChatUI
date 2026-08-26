<script lang="ts">
	import CarbonContinue from "~icons/carbon/continue";

	export let classNames = "";
</script>

<button
	type="button"
	on:click
	class="btn flex h-8 rounded-lg border bg-app-surface px-3 py-1 text-gray-500 shadow-sm transition-all hover:bg-app-surface/70 dark:border-gray-600 dark:text-gray-300 {classNames}"
>
	<CarbonContinue class="mr-2 text-xs " /> Continue
</button>
