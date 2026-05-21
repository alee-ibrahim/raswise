<script lang="ts">
  import { _ } from "$lib/i18n/i18n";
  import { createEventDispatcher } from "svelte";
  import ListCard from "$lib/components/ListCard.svelte";
  import { webAppStore, stateStore } from "$lib/webapp/store";
  import LoadingCard from "$lib/components/LoadingCard.svelte";
  import { fade } from "svelte/transition";
  import { updateBackButton } from "$lib/webapp/utils";
  import CurrencySelector from "$lib/components/CurrencySelector.svelte";
  import { ripple } from "svelte-ripple-action";
  import StatusTitle from "$lib/components/StatusTitle.svelte";

  const dispatch = createEventDispatcher();

  let loading = true;
  let pendingGroup: Group | null = null;
  let chosenCurrency = "";
  let saving = false;

  webAppStore.subscribe(async () => {
    updateBackButton();

    if ($stateStore.groups) return (loading = false);

    const response = await fetch("/webapp/api/groups?" + new URLSearchParams({ login: $webAppStore?.initData }));

    loading = false;

    if (response.status === 200) stateStore.set({ ...$stateStore, groups: (await response.json()).groups });
  });

  function selectGroup(group: Group) {
    if (!group.defaultCurrency) {
      pendingGroup = group;
      return;
    }
    proceed(group);
  }

  function proceed(group: Group) {
    stateStore.set({ ...$stateStore, group: group, phase: 1 });
    dispatch("next");
  }

  async function saveCurrency() {
    if (!pendingGroup || !chosenCurrency) return;

    saving = true;
    try {
      const response = await fetch(
        "/webapp/api/groups/" + pendingGroup.id + "?" + new URLSearchParams({ login: $webAppStore?.initData }),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ defaultCurrency: chosenCurrency }),
        }
      );

      if (response.status !== 200) {
        $webAppStore?.showAlert("Could not save currency");
        return;
      }

      const updated: Group = { ...pendingGroup, defaultCurrency: chosenCurrency };
      stateStore.set({
        ...$stateStore,
        groups: ($stateStore.groups || []).map((g) => (g.id === updated.id ? updated : g)),
      });
      proceed(updated);
    } finally {
      saving = false;
    }
  }

  function cancelCurrency() {
    pendingGroup = null;
    chosenCurrency = "";
  }
</script>

{#if pendingGroup}
  <div in:fade>
    <StatusTitle title={pendingGroup.title} icon="fluent-emoji:classical-building" />

    <p class="hint mb-3">Pick a default currency for this group. Past and future expenses without an explicit currency will use it.</p>

    <CurrencySelector bind:value={chosenCurrency} />

    <button class="mt-4 w-full" use:ripple on:click={saveCurrency} disabled={!chosenCurrency || saving}>
      {saving ? "Saving…" : $_("continue")}
    </button>
    <button class="mt-2 w-full delete" use:ripple on:click={cancelCurrency}>{$_("app.back") || "Back"}</button>
  </div>
{:else}
  <p class="mb-3 hint">{$_("app.select_group")}</p>

  {#if !loading}
    <div class="flex flex-col gap-2" in:fade>
      {#each $stateStore.groups || [] as group}
        <ListCard on:click={() => selectGroup(group)} icon="fluent-emoji:classical-building" name={group.title} />
      {/each}
    </div>
  {:else}
    <div in:fade>
      <LoadingCard />
    </div>
  {/if}
{/if}
