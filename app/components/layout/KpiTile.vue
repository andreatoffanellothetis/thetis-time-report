<script setup lang="ts">
defineProps<{
  label: string
  value: string
  sub?: string
  icon?: string
  tone?: 'neutral' | 'positive' | 'negative' | 'warning'
}>()
</script>

<template>
  <div class="flex items-center gap-3">
    <div
      class="size-10 rounded-xl flex items-center justify-center shrink-0"
      :class="[
        tone === 'positive' && 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
        tone === 'negative' && 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
        tone === 'warning' && 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
        (!tone || tone === 'neutral') && 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400',
      ]"
    >
      <UIcon v-if="icon" :name="icon" class="size-5" />
    </div>
    <div class="min-w-0">
      <div class="text-[11px] uppercase tracking-wide font-medium text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
        {{ label }}
      </div>
      <div class="flex items-baseline gap-1.5 whitespace-nowrap">
        <span
          class="text-base font-semibold tabular-nums"
          :class="[
            tone === 'positive' && 'text-emerald-600 dark:text-emerald-400',
            tone === 'negative' && 'text-red-600 dark:text-red-400',
            tone === 'warning' && 'text-amber-600 dark:text-amber-400',
            (!tone || tone === 'neutral') && 'text-neutral-900 dark:text-neutral-100',
          ]"
        >
          {{ value }}
        </span>
        <span v-if="sub" class="text-xs text-neutral-500">{{ sub }}</span>
      </div>
    </div>
  </div>
</template>
