<script lang="ts">
	import { env as envPublic } from "$env/dynamic/public";
	import CarbonWarningAlt from "~icons/carbon/warning-alt";

	/** Where to send the user so the app runs as a first-party, top-level page. */
	$: href = envPublic.PUBLIC_ORIGIN || (typeof window !== "undefined" ? window.location.href : "");
</script>

<!--
	Deliberately not dismissible and not on a timer: without a session cookie the app cannot keep a
	conversation, so this is a standing condition rather than a transient error. Opening the app as a
	top-level page makes the cookie first-party, which is the only fix available in browsers that do
	not implement partitioned cookies (Safari).
-->
<div
	class="pointer-events-auto z-30 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-b border-amber-300 bg-amber-100 px-4 py-2 text-center text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200"
	role="alert"
>
	<CarbonWarningAlt class="flex-none text-base" />
	<span>This chat needs cookies to keep your session, and your browser is blocking them here.</span>
	<a {href} target="_blank" rel="noreferrer" class="font-semibold underline hover:no-underline">
		Open it in a new tab →
	</a>
</div>
