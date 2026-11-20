<script lang="ts">

  import Icon from "@iconify/svelte";

  interface Props {
    type?: string;
    value: string;
    name: string;
    icon?: string | null;
    onclick?: (e: MouseEvent) => void;
    onkeypress?: (e: KeyboardEvent) => void;
  }

  let {
    type = "text",
    value = $bindable(),
    name,
    icon = null,
    onclick,
    onkeypress
  }: Props = $props();

  function typeAction(node: HTMLInputElement) {
    node.type = type;
  }
</script>

<div class="flex items-center gap-3" {onclick} role="textbox" tabindex="0" {onkeypress}>
  {#if icon}
    <Icon {icon} class="text-2xl opacity-80" />
  {/if}
  <input class="flex-1 bg-neutral-500 dark:bg-white bg-opacity-5 dark:bg-opacity-5 border border-tg px-3 py-2 rounded-lg border-active-primary" use:typeAction bind:value {name} placeholder={name} />
</div>
