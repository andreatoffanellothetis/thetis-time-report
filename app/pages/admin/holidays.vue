<script setup lang="ts">
import { z } from 'zod'

import type { Holiday } from '~~/server/db/schema'

definePageMeta({
  middleware: ['admin-only'],
  layout: 'admin',
})

useHead({ title: 'Festività · Admin' })

const { data, refresh, status } = await useFetch<Holiday[]>('/api/admin/holidays', {
  default: () => [],
})

const holidays = computed(() => data.value ?? [])

type FormState = {
  id: string | null
  date: string
  name: string
  recurring: boolean
}

const emptyForm = (): FormState => ({
  id: null,
  date: new Date().toISOString().slice(0, 10),
  name: '',
  recurring: false,
})

const drawerOpen = ref(false)
const form = reactive<FormState>(emptyForm())
const submitting = ref(false)
const formError = ref<string | null>(null)

const formSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD'),
  name: z.string().min(1, 'Obbligatorio').max(120),
  recurring: z.boolean(),
})

function openCreate() {
  Object.assign(form, emptyForm())
  formError.value = null
  drawerOpen.value = true
}

function openEdit(h: Holiday) {
  Object.assign(form, {
    id: h.id,
    date: h.date,
    name: h.name,
    recurring: h.recurring,
  })
  formError.value = null
  drawerOpen.value = true
}

async function submit() {
  submitting.value = true
  formError.value = null
  try {
    const payload = {
      date: form.date,
      name: form.name.trim(),
      recurring: form.recurring,
    }
    if (form.id) {
      await $fetch(`/api/admin/holidays/${form.id}`, { method: 'PATCH', body: payload })
    }
    else {
      await $fetch('/api/admin/holidays', { method: 'POST', body: payload })
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

async function remove(h: Holiday) {
  if (!confirm(`Eliminare "${h.name}" del ${h.date}?`)) return
  await $fetch(`/api/admin/holidays/${h.id}`, { method: 'DELETE' })
  await refresh()
}

function formatDate(iso: string, recurring: boolean) {
  const [y, m, d] = iso.split('-')
  if (recurring) return `${d}/${m} (ogni anno)`
  return `${d}/${m}/${y}`
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
          Festività custom
        </h1>
        <p class="text-sm text-[var(--ui-text-muted)] max-w-xl leading-relaxed">
          Eccezioni rispetto al calendario nazionale italiano (già gestito automaticamente):
          chiusure aziendali, ponti, santo patrono, festività locali.
        </p>
      </div>
      <UButton icon="i-lucide-plus" color="primary" size="md" @click="openCreate">
        Aggiungi festività
      </UButton>
    </header>

    <div class="flex justify-end">
      <p class="text-xs text-[var(--ui-text-dimmed)] tabular-nums">
        {{ holidays.length }} {{ holidays.length === 1 ? 'festività' : 'festività' }}
      </p>
    </div>

    <div class="rounded-xl ring-1 ring-[var(--ui-border)] overflow-hidden bg-[var(--ui-bg)]">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left text-xs uppercase tracking-wider text-[var(--ui-text-muted)] bg-[var(--ui-bg-elevated)]">
            <th class="px-5 py-3 font-medium">
              Data
            </th>
            <th class="px-4 py-3 font-medium">
              Nome
            </th>
            <th class="px-4 py-3 font-medium">
              Tipo
            </th>
            <th class="px-4 py-3 font-medium text-right">
              Azioni
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="status === 'pending' && holidays.length === 0">
            <td colspan="4" class="px-5 py-12 text-center text-sm text-[var(--ui-text-muted)]">
              Caricamento…
            </td>
          </tr>
          <tr v-else-if="holidays.length === 0">
            <td colspan="4" class="px-5 py-16 text-center">
              <p class="text-sm text-[var(--ui-text-muted)] mb-3">
                Nessuna festività custom configurata.
              </p>
              <UButton variant="outline" size="sm" icon="i-lucide-plus" @click="openCreate">
                Aggiungi la prima
              </UButton>
            </td>
          </tr>
          <tr
            v-for="h in holidays"
            :key="h.id"
            class="border-t border-[var(--ui-border)] hover:bg-[var(--ui-bg-elevated)] transition-colors cursor-pointer group"
            @click="openEdit(h)"
          >
            <td class="px-5 py-3.5 font-mono text-xs tabular-nums text-[var(--ui-text-highlighted)]">
              {{ formatDate(h.date, h.recurring) }}
            </td>
            <td class="px-4 py-3.5 text-[var(--ui-text-highlighted)] font-medium">
              {{ h.name }}
            </td>
            <td class="px-4 py-3.5">
              <span
                class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wider"
                :class="h.recurring
                  ? 'bg-[var(--ui-color-info-50)] text-[var(--ui-color-info-700)] dark:bg-[var(--ui-color-info-950)] dark:text-[var(--ui-color-info-400)]'
                  : 'bg-[var(--ui-bg-elevated)] text-[var(--ui-text-muted)]'"
              >
                {{ h.recurring ? 'Ricorrente' : 'Una tantum' }}
              </span>
            </td>
            <td class="px-4 py-3.5 text-right" @click.stop>
              <UButton
                icon="i-lucide-trash-2"
                variant="ghost"
                color="error"
                size="xs"
                class="opacity-0 group-hover:opacity-100 transition-opacity"
                @click="remove(h)"
              >
                Elimina
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
                {{ form.id ? 'Modifica' : 'Nuova' }}
              </p>
              <h2 class="text-lg font-semibold text-[var(--ui-text-highlighted)] mt-0.5">
                {{ form.id ? 'Festività' : 'Nuova festività' }}
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
            <UFormField label="Data" name="date" required>
              <UInput v-model="form.date" type="date" class="w-full" />
            </UFormField>

            <UFormField label="Nome" name="name" required>
              <UInput v-model="form.name" placeholder="Santo Patrono / Ponte aziendale" class="w-full" />
            </UFormField>

            <UFormField name="recurring" hint="Vale ogni anno alla stessa data (l'anno indicato è ignorato)">
              <label class="flex items-center gap-3 cursor-pointer">
                <UCheckbox v-model="form.recurring" />
                <span class="text-sm">Ricorrente ogni anno</span>
              </label>
            </UFormField>

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
