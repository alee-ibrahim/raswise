<script lang="ts">

  interface Props {
    value: string | number;
    placeholder?: string;
    options: {
    key: string | number;
    text: string;
  }[];
  }

  let { value = $bindable(), placeholder = "", options }: Props = $props();
</script>

<select {placeholder} bind:value class="bg-neutral-500 dark:bg-white bg-opacity-5 dark:bg-opacity-5 border border-tg px-3 py-2 rounded-xl outline-none">
  {#each options as option}
    <option value={option.key} selected={option.key === value}>{option.text}</option>
  {/each}
</select>
