<script setup lang="ts">
import { useDatasetStore } from '~/stores/dataset'

const datasetStore = useDatasetStore()
</script>

<template>
  <ClientOnly>
    <div class="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 antialiased">
      <DropZone v-if="!datasetStore.isReady" variant="fullscreen" />

      <template v-else>
        <AppHeader />
        <WarningsBanner />

        <div class="flex" :style="{ minHeight: 'calc(100vh - 80px)' }">
          <EmployeeSidebar v-if="datasetStore.viewMode === 'employee'" />
          <ProjectSidebar v-else />

          <main class="flex-1 overflow-x-hidden">
            <template v-if="datasetStore.viewMode === 'employee'">
              <DetailHeader v-if="datasetStore.selectedEmployee" />

              <div v-if="!datasetStore.selectedEmployee" class="p-6 space-y-6">
                <EmployeeMatrixHeatmap />
                <EmployeeBarRanking />
              </div>

              <div v-else class="p-6 space-y-6">
                <DailyStackedBar />
                <TimeOfDayGantt />
                <div class="grid grid-cols-3 gap-6">
                  <ProjectDonut />
                  <MonthCalendarHeatmap />
                  <TopVariancesList />
                </div>
              </div>
            </template>

            <template v-else>
              <ProjectHeader v-if="datasetStore.selectedProject" />

              <div v-if="!datasetStore.selectedProject" class="p-12 flex items-center justify-center">
                <div class="text-center max-w-md">
                  <div class="size-12 rounded-2xl bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center mx-auto mb-4">
                    <UIcon name="i-lucide-folder-kanban" class="size-6 text-neutral-400" />
                  </div>
                  <div class="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                    Seleziona una commessa
                  </div>
                  <div class="text-sm text-neutral-500 mt-1">
                    Scegli una commessa dalla barra laterale per vedere la matrice ore × dipendente × giorno.
                  </div>
                </div>
              </div>

              <div v-else class="p-6">
                <ProjectMatrix />
              </div>
            </template>
          </main>
        </div>
      </template>
    </div>
    <template #fallback>
      <div class="min-h-screen flex items-center justify-center text-neutral-500">
        Caricamento…
      </div>
    </template>
  </ClientOnly>
</template>
