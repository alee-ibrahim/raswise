<script lang="ts">
  import Icon from "@iconify/svelte";
  import { CURRENCIES, getCurrency, type Currency } from "$lib/data/currencies";

  export let value: string = "";
  export let placeholder: string = "Search currency…";

  let open = false;
  let query = "";

  $: selected = getCurrency(value);
  $: filtered = filterCurrencies(query);

  function filterCurrencies(q: string): Currency[] {
    const norm = q.trim().toLowerCase();
    if (!norm) return CURRENCIES;
    return CURRENCIES.filter(
      (c) =>
        c.code.toLowerCase().includes(norm) ||
        c.name.toLowerCase().includes(norm) ||
        c.symbol.toLowerCase().includes(norm)
    );
  }

  function pick(c: Currency) {
    value = c.code;
    open = false;
    query = "";
  }

  function toggle() {
    open = !open;
    if (open) {
      // focus search shortly after the element is rendered
      setTimeout(() => {
        const el = document.getElementById("currency-search");
        el?.focus();
      }, 0);
    }
  }
</script>

<div class="relative">
  <button
    type="button"
    class="w-full flex items-center justify-between gap-3 bg-neutral-500 dark:bg-white bg-opacity-5 dark:bg-opacity-5 border border-tg px-3 py-2 rounded-xl outline-none"
    on:click={toggle}
  >
    <span class="flex items-center gap-2">
      <Icon icon="tabler:currency" class="text-xl opacity-80" />
      {#if selected}
        <span class="font-medium">{selected.code}</span>
        <span class="opacity-70 text-sm">— {selected.name}</span>
      {:else}
        <span class="opacity-60">{placeholder}</span>
      {/if}
    </span>
    <Icon icon={open ? "tabler:chevron-up" : "tabler:chevron-down"} class="text-xl opacity-70" />
  </button>

  {#if open}
    <div class="absolute z-10 mt-1 w-full bg-tg-bg border border-tg rounded-xl shadow-lg overflow-hidden">
      <input
        id="currency-search"
        type="text"
        bind:value={query}
        {placeholder}
        class="w-full bg-neutral-500 dark:bg-white bg-opacity-5 dark:bg-opacity-5 border-b border-tg px-3 py-2 outline-none"
      />
      <div class="max-h-64 overflow-y-auto">
        {#each filtered as c (c.code)}
          <button
            type="button"
            class="w-full text-left px-3 py-2 flex items-center justify-between hover:bg-neutral-500 hover:bg-opacity-10 dark:hover:bg-white dark:hover:bg-opacity-5"
            class:bg-active={c.code === value}
            on:click={() => pick(c)}
          >
            <span class="flex items-center gap-2">
              <span class="font-medium w-12">{c.code}</span>
              <span class="opacity-80 text-sm">{c.name}</span>
            </span>
            <span class="opacity-60 text-sm">{c.symbol}</span>
          </button>
        {:else}
          <div class="px-3 py-4 text-center opacity-60 text-sm">No matches</div>
        {/each}
      </div>
    </div>
  {/if}
</div>
