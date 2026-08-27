<script lang="ts">
	export let title = "";
	export let classNames = "";
</script>

<div class="flex items-center rounded-xl bg-app-surface py-1 pl-3 pr-1 text-sm {classNames}">
	{title}
	<div class="ml-auto shrink-0">
		<slot />
	</div>
</div>
