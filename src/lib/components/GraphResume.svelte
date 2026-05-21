<script lang="ts">
  import { _ } from "$lib/i18n/i18n";
  import Icon from "@iconify/svelte";
  import { ripple } from "svelte-ripple-action";

  export let debts: Debt[];

  let expanded = false;

  // Group debts by currency so we can show one row per currency.
  $: byCurrency = (() => {
    const map = new Map<string, Debt[]>();
    for (const d of debts) {
      const c = d.currency || "";
      if (!map.has(c)) map.set(c, []);
      map.get(c)!.push(d);
    }
    return Array.from(map.entries()).map(([currency, ds]) => ({
      currency,
      debts: ds,
      sum: ds.reduce((s, d) => (s += d.amount), 0),
    }));
  })();

  // Card colour: green if every currency nets ≤ 0, red if any currency owes money.
  $: anyOwes = byCurrency.some((c) => c.sum > 0);
  $: allSettled = byCurrency.every((c) => c.sum === 0);
</script>

<div
  class={"p-3 flex flex-col text-white rounded-xl " + (allSettled ? "bg-neutral-500" : anyOwes ? "bg-red-500" : "bg-green-500")}
  use:ripple
  on:click={() => (expanded = !expanded)}
  role="button"
  on:keypress
  tabindex="0"
>
  {#if allSettled}
    <span class="text-sm">{$_("app.is_pair")}</span>
  {:else}
    <span class="text-sm">{anyOwes ? $_("app.must_give") : $_("app.must_receive")}</span>
    <div class="flex flex-col gap-1 mt-1">
      {#each byCurrency as bucket}
        {#if bucket.sum !== 0}
          <div class="flex items-baseline gap-2">
            <span class="font-bold text-2xl">{Math.abs(bucket.sum).toFixed(2)}</span>
            <span class="text-sm opacity-90">{bucket.currency}</span>
          </div>
        {/if}
      {/each}
    </div>

    <div class="flex justify-center text-xl">
      <Icon icon={expanded ? "ic:round-keyboard-arrow-up" : "ic:round-keyboard-arrow-down"} />
    </div>

    {#if expanded}
      <div class="flex flex-col mt-2 gap-1">
        {#each debts as debt}
          {#if debt.amount !== 0}
            <div class="text-xs flex items-center gap-2">
              <span class="font-bold">{Math.abs(debt.amount).toFixed(2)}</span>
              <span class="opacity-80">{debt.currency}</span>
              <Icon icon={debt.amount > 0 ? "fluent-emoji:right-arrow" : "fluent-emoji:left-arrow"} class="text-base" />
              <span>{debt.first_name} {debt.last_name || ""}</span>
            </div>
          {/if}
        {/each}
      </div>
    {/if}
  {/if}
</div>
