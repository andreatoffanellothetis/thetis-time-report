<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDatasetStore } from '~/stores/dataset'

const datasetStore = useDatasetStore()
const dismissed = ref(false)

const warnings = computed(() => datasetStore.dataset?.warnings ?? [])
</script>

<template>
  <div
    v-if="warnings.length > 0 && !dismissed"
    class="border-b border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 px-6 py-2.5 flex items-center gap-3"
  >
    <UIcon name="i-lucide-alert-triangle" class="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
    <div class="text-sm text-amber-900 dark:text-amber-200 flex-1">
      <span class="font-medium">{{ warnings.length }} avvis{{ warnings.length === 1 ? 'o' : 'i' }}</span>:
      <span>{{ warnings[0]?.message }}</span>
      <span v-if="warnings.length > 1" class="text-amber-700 dark:text-amber-300/70">
        e altri {{ warnings.length - 1 }}
      </span>
    </div>
    <UButton
      size="xs"
      variant="ghost"
      color="neutral"
      icon="i-lucide-x"
      @click="dismissed = true"
    />
  </div>
</template>
