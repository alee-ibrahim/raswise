<script lang="ts">
  import { _ } from "$lib/i18n/i18n";
  import Icon from "@iconify/svelte";

  interface Props {
    title: string | undefined;
    subtitle?: string | null;
    icon: string;
  }

  let { title, subtitle = null, icon }: Props = $props();
</script>

{#if title}
  <div class="bg-second flex items-center gap-2 border-b border-tg py-2 px-3 mb-3 -mt-3 -mx-3">
    <Icon {icon} class="text-lg" />
    <div class="flex items-center gap-3">
      <span class="text-sm font-semibold">{title}</span>
      {#if subtitle}
        <span class="text-xs opacity-70">~ {subtitle}</span>
      {/if}
    </div>
  </div>
{/if}
