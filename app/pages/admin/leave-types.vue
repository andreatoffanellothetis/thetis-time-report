<script setup lang="ts">
import { z } from 'zod'

import type { LeaveType } from '~~/server/db/schema'

definePageMeta({
  middleware: ['admin-only'],
  layout: 'admin',
})

useHead({ title: 'Tipi orario · Admin' })

const includeArchived = ref(false)

const { data, refresh, status } = await useFetch<LeaveType[]>('/api/admin/leave-types', {
  query: { includeArchived },
  default: () => [],
})

const leaveTypes = computed(() => data.value ?? [])

type FormState = {
  id: string | null
  code: string
  name: string
  paid: boolean
  countsTowardsHours: boolean
  requiresApproval: boolean
  color: string
  maxDaysPerYear: number | null
}

const emptyForm = (): FormState => ({
  id: null,
  code: '',
  name: '',
  paid: true,
  countsTowardsHours: false,
  requiresApproval: true,
  color: '#94a3b8',
  maxDaysPerYear: null,
})

const drawerOpen = ref(false)
const form = reactive<FormState>(emptyForm())
const submitting = ref(false)
const formError = ref<string | null>(null)

const formSchema = z.object({
  code: z.string().min(1).max(40).regex(/^[A-Z0-9_]+$/, 'MAIUSCOLO, numeri, _'),
  name: z.string().min(1).max(120),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  maxDaysPerYear: z.number().int().positive().nullable(),
})

function openCreate() {
  Object.assign(form, emptyForm())
  formError.value = null
  drawerOpen.value = true
}

function openEdit(lt: LeaveType) {
  Object.assign(form, {
    id: lt.id,
    code: lt.code,
    name: lt.name,
    paid: lt.paid,
    countsTowardsHours: lt.countsTowardsHours,
    requiresApproval: lt.requiresApproval,
    color: lt.color,
    maxDaysPerYear: lt.maxDaysPerYear,
  })
  formError.value = null
  drawerOpen.value = true
}

async function submit() {
  submitting.value = true
  formError.value = null
  try {
    const payload = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      paid: form.paid,
      countsTowardsHours: form.countsTowardsHours,
      requiresApproval: form.requiresApproval,
      color: form.color,
      maxDaysPerYear: form.maxDaysPerYear,
    }
    if (form.id) {
      await $fetch(`/api/admin/leave-types/${form.id}`, { method: 'PATCH', body: payload })
    }
    else {
      await $fetch('/api/admin/leave-types', { method: 'POST', body: payload })
    }
    drawerOpen.value = false
    await refresh()
  }
  catch (e) {
    const err = e as { data?: { statusMessage?: string, message?: string }, message?: string }
    formError.value = err.data?.statusMessage ?? err.data?.message ?? err.message ?? 'Errore'
  }
  finally {
    submitting.value = false
  }
}

async function toggleArchive(lt: LeaveType) {
  await $fetch(`/api/admin/leave-types/${lt.id}`, {
    method: 'PATCH',
    body: { archivedAt: lt.archivedAt ? null : new Date().toISOString() },
  })
  await refresh()
}

const flagDescriptions = {
  paid: 'Ore retribuite (impatta payroll, qui solo informativo)',
  countsTowardsHours: 'Le ore di questo tipo concorrono a saturare l\'orario giornaliero atteso',
  requiresApproval: 'Richiede approvazione di un manager prima di essere effettivo',
}
</script>

<template>
  <div class="px-8 py-8 space-y-8 max-w-6xl">
    <header class="flex items-end justify-between gap-6">
      <div class="space-y-1">
        <p class="text-[11px] uppercase tracking-[0.18em] text-[var(--ui-text-muted)]">
          Anagrafica
        </p>
        <h1 class="text-2xl font-semibold tracking-tight text-[var(--ui-text-highlighted)]">
          Tipi orario
        </h1>
        <p class="text-sm text-[var(--ui-text-muted)] max-w-xl leading-relaxed">
          Categorie di ore non lavorative: ferie, permessi (retribuiti / non),
          malattia, congedi, 104, ecc. Configurano workflow di approvazione e
          conteggio ore.
        </p>
      </div>
      <UButton icon="i-lucide-plus" color="primary" size="md" @click="openCreate">
        Nuovo tipo
      </UButton>
    </header>

    <div class="flex items-center justify-between gap-4 text-sm">
      <label class="flex items-center gap-2 cursor-pointer select-none text-[var(--ui-text-muted)] hover:text-[var(--ui-text)] transition-colors">
        <UCheckbox v-model="includeArchived" />
        Mostra archiviati
      </label>
      <p class="text-xs text-[var(--ui-text-dimmed)] tabular-nums">
        {{ leaveTypes.length }} {{ leaveTypes.length === 1 ? 'tipo' : 'tipi' }}
      </p>
    </div>

    <div class="rounded-xl ring-1 ring-[var(--ui-border)] overflow-hidden bg-[var(--ui-bg)]">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left text-xs uppercase tracking-wider text-[var(--ui-text-muted)] bg-[var(--ui-bg-elevated)]">
            <th class="px-5 py-3 font-medium w-12" />
            <th class="px-2 py-3 font-medium">
              Codice
            </th>
            <th class="px-4 py-3 font-medium">
              Nome
            </th>
            <th class="px-4 py-3 font-medium">
              Flag
            </th>
            <th class="px-4 py-3 font-medium text-right">
              Max/anno
            </th>
            <th class="px-4 py-3 font-medium text-right">
              Azioni
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="status === 'pending' && leaveTypes.length === 0">
            <td colspan="6" class="px-5 py-12 text-center text-sm text-[var(--ui-text-muted)]">
              Caricamento…
            </td>
          </tr>
          <tr v-else-if="leaveTypes.length === 0">
            <td colspan="6" class="px-5 py-16 text-center">
              <p class="text-sm text-[var(--ui-text-muted)] mb-3">
                Nessun tipo orario{{ includeArchived ? '' : ' attivo' }}.
              </p>
              <UButton variant="outline" size="sm" icon="i-lucide-plus" @click="openCreate">
                Crea il primo
              </UButton>
            </td>
          </tr>
          <tr
            v-for="lt in leaveTypes"
            :key="lt.id"
            class="border-t border-[var(--ui-border)] hover:bg-[var(--ui-bg-elevated)] transition-colors cursor-pointer group"
            :class="{ 'opacity-50': lt.archivedAt }"
            @click="openEdit(lt)"
          >
            <td class="px-5 py-3.5">
              <span
                class="block size-3.5 rounded-full ring-1 ring-black/5 dark:ring-white/10"
                :style="{ background: lt.color }"
                :title="lt.color"
              />
            </td>
            <td class="px-2 py-3.5 font-mono text-xs tabular-nums text-[var(--ui-text-highlighted)]">
              {{ lt.code }}
            </td>
            <td class="px-4 py-3.5 text-[var(--ui-text-highlighted)] font-medium">
              {{ lt.name }}
            </td>
            <td class="px-4 py-3.5">
              <div class="flex flex-wrap gap-1.5">
                <span v-if="lt.paid" class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-[var(--ui-color-success-50)] text-[var(--ui-color-success-700)] dark:bg-[var(--ui-color-success-950)] dark:text-[var(--ui-color-success-400)]">
                  Retribuito
                </span>
                <span v-if="lt.countsTowardsHours" class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-[var(--ui-color-info-50)] text-[var(--ui-color-info-700)] dark:bg-[var(--ui-color-info-950)] dark:text-[var(--ui-color-info-400)]">
                  Conta ore
                </span>
                <span v-if="lt.requiresApproval" class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-[var(--ui-color-warning-50)] text-[var(--ui-color-warning-700)] dark:bg-[var(--ui-color-warning-950)] dark:text-[var(--ui-color-warning-400)]">
                  Richiede approvazione
                </span>
              </div>
            </td>
            <td class="px-4 py-3.5 text-right text-[var(--ui-text-muted)] tabular-nums">
              {{ lt.maxDaysPerYear ?? '—' }}
            </td>
            <td class="px-4 py-3.5 text-right" @click.stop>
              <UButton
                :icon="lt.archivedAt ? 'i-lucide-archive-restore' : 'i-lucide-archive'"
                variant="ghost"
                color="neutral"
                size="xs"
                class="opacity-0 group-hover:opacity-100 transition-opacity"
                @click="toggleArchive(lt)"
              >
                {{ lt.archivedAt ? 'Riattiva' : 'Archivia' }}
              </UButton>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <USlideover v-model:open="drawerOpen" :ui="{ content: 'max-w-md' }">
      <template #content>
        <div class="flex flex-col h-full">
          <header class="px-6 py-5 border-b border-[var(--ui-border)] flex items-center justify-between">
            <div>
              <p class="text-[10px] uppercase tracking-[0.18em] text-[var(--ui-text-muted)]">
                {{ form.id ? 'Modifica' : 'Nuovo' }}
              </p>
              <h2 class="text-lg font-semibold text-[var(--ui-text-highlighted)] mt-0.5">
                {{ form.id ? 'Tipo orario' : 'Nuovo tipo orario' }}
              </h2>
            </div>
            <UButton icon="i-lucide-x" variant="ghost" color="neutral" size="sm" @click="drawerOpen = false" />
          </header>

          <UForm
            :schema="formSchema"
            :state="form"
            class="flex-1 overflow-y-auto px-6 py-6 space-y-5"
            @submit="submit"
          >
            <UFormField label="Codice" name="code" required hint="MAIUSCOLO, es. FERIE, PERMESSO_R">
              <UInput v-model="form.code" placeholder="FERIE" class="w-full font-mono" />
            </UFormField>

            <UFormField label="Nome" name="name" required>
              <UInput v-model="form.name" placeholder="Ferie" class="w-full" />
            </UFormField>

            <UFormField label="Colore" name="color">
              <div class="flex items-center gap-3">
                <input
                  v-model="form.color"
                  type="color"
                  class="size-10 rounded-lg cursor-pointer ring-1 ring-[var(--ui-border)] bg-transparent"
                >
                <UInput v-model="form.color" class="flex-1 font-mono text-xs" />
              </div>
            </UFormField>

            <UFormField label="Max giorni / anno" name="maxDaysPerYear" hint="lascia vuoto se illimitato">
              <UInput
                v-model.number="form.maxDaysPerYear"
                type="number"
                min="1"
                placeholder="es. 26"
                class="w-full"
              />
            </UFormField>

            <div class="space-y-3 pt-2">
              <p class="text-xs uppercase tracking-[0.18em] text-[var(--ui-text-muted)]">
                Flag
              </p>
              <label class="flex items-start gap-3 cursor-pointer">
                <UCheckbox v-model="form.paid" class="mt-0.5" />
                <div class="-mt-0.5">
                  <p class="text-sm font-medium">
                    Retribuito
                  </p>
                  <p class="text-xs text-[var(--ui-text-muted)] mt-0.5">
                    {{ flagDescriptions.paid }}
                  </p>
                </div>
              </label>

              <label class="flex items-start gap-3 cursor-pointer">
                <UCheckbox v-model="form.countsTowardsHours" class="mt-0.5" />
                <div class="-mt-0.5">
                  <p class="text-sm font-medium">
                    Conta come ore
                  </p>
                  <p class="text-xs text-[var(--ui-text-muted)] mt-0.5">
                    {{ flagDescriptions.countsTowardsHours }}
                  </p>
                </div>
              </label>

              <label class="flex items-start gap-3 cursor-pointer">
                <UCheckbox v-model="form.requiresApproval" class="mt-0.5" />
                <div class="-mt-0.5">
                  <p class="text-sm font-medium">
                    Richiede approvazione
                  </p>
                  <p class="text-xs text-[var(--ui-text-muted)] mt-0.5">
                    {{ flagDescriptions.requiresApproval }}
                  </p>
                </div>
              </label>
            </div>

            <Transition
              enter-active-class="transition-all duration-200 ease-out"
              enter-from-class="opacity-0 -translate-y-1"
            >
              <UAlert v-if="formError" color="error" variant="soft" :title="formError" />
            </Transition>
          </UForm>

          <footer class="px-6 py-4 border-t border-[var(--ui-border)] flex items-center justify-end gap-2">
            <UButton variant="ghost" color="neutral" @click="drawerOpen = false">
              Annulla
            </UButton>
            <UButton :loading="submitting" color="primary" @click="submit">
              {{ form.id ? 'Salva' : 'Crea' }}
            </UButton>
          </footer>
        </div>
      </template>
    </USlideover>
  </div>
</template>
