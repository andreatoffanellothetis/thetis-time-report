<script setup lang="ts">
import { z } from 'zod'

import type { Project } from '~~/server/db/schema'

definePageMeta({
  middleware: ['admin-only'],
  layout: 'admin',
})

useHead({ title: 'Commesse · Admin' })

/* ----------------------------- Data ----------------------------- */

const includeArchived = ref(false)

const { data, refresh, status } = await useFetch<Project[]>('/api/admin/projects', {
  query: { includeArchived },
  default: () => [],
})

const projects = computed(() => data.value ?? [])

/* ----------------------------- Form ----------------------------- */

type FormState = {
  id: string | null
  code: string
  name: string
  client: string
  color: string
  archivedAt: string | null
}

const emptyForm = (): FormState => ({
  id: null,
  code: '',
  name: '',
  client: '',
  color: '#64748b',
  archivedAt: null,
})

const drawerOpen = ref(false)
const form = reactive<FormState>(emptyForm())
const submitting = ref(false)
const formError = ref<string | null>(null)

const formSchema = z.object({
  code: z.string().min(1, 'Obbligatorio').max(40),
  name: z.string().min(1, 'Obbligatorio').max(200),
  client: z.string().max(120).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Colore HEX (#rrggbb)'),
})

function openCreate() {
  Object.assign(form, emptyForm())
  formError.value = null
  drawerOpen.value = true
}

function openEdit(p: Project) {
  Object.assign(form, {
    id: p.id,
    code: p.code,
    name: p.name,
    client: p.client ?? '',
    color: p.color,
    archivedAt: p.archivedAt ? new Date(p.archivedAt).toISOString() : null,
  })
  formError.value = null
  drawerOpen.value = true
}

async function submit() {
  submitting.value = true
  formError.value = null
  try {
    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      client: form.client.trim() || null,
      color: form.color,
    }
    if (form.id) {
      await $fetch(`/api/admin/projects/${form.id}`, { method: 'PATCH', body: payload })
    }
    else {
      await $fetch('/api/admin/projects', { method: 'POST', body: payload })
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

async function toggleArchive(p: Project) {
  await $fetch(`/api/admin/projects/${p.id}`, {
    method: 'PATCH',
    body: { archivedAt: p.archivedAt ? null : new Date().toISOString() },
  })
  await refresh()
}
</script>

<template>
  <div class="px-8 py-8 space-y-8 max-w-6xl">
    <!-- Header -->
    <header class="flex items-end justify-between gap-6">
      <div class="space-y-1">
        <p class="text-[11px] uppercase tracking-[0.18em] text-[var(--ui-text-muted)]">
          Anagrafica
        </p>
        <h1 class="text-2xl font-semibold tracking-tight text-[var(--ui-text-highlighted)]">
          Commesse
        </h1>
        <p class="text-sm text-[var(--ui-text-muted)] max-w-xl leading-relaxed">
          Progetti / commesse su cui i dipendenti possono registrare ore. Le commesse
          archiviate non appaiono nei dropdown ma restano leggibili nei report storici.
        </p>
      </div>
      <UButton
        icon="i-lucide-plus"
        color="primary"
        size="md"
        @click="openCreate"
      >
        Nuova commessa
      </UButton>
    </header>

    <!-- Filter row -->
    <div class="flex items-center justify-between gap-4 text-sm">
      <label class="flex items-center gap-2 cursor-pointer select-none text-[var(--ui-text-muted)] hover:text-[var(--ui-text)] transition-colors">
        <UCheckbox v-model="includeArchived" />
        Mostra archiviate
      </label>
      <p class="text-xs text-[var(--ui-text-dimmed)] tabular-nums">
        {{ projects.length }} {{ projects.length === 1 ? 'commessa' : 'commesse' }}
      </p>
    </div>

    <!-- Table -->
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
              Cliente
            </th>
            <th class="px-4 py-3 font-medium text-right">
              Azioni
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="status === 'pending' && projects.length === 0">
            <td colspan="5" class="px-5 py-12 text-center text-sm text-[var(--ui-text-muted)]">
              Caricamento…
            </td>
          </tr>
          <tr v-else-if="projects.length === 0">
            <td colspan="5" class="px-5 py-16 text-center">
              <p class="text-sm text-[var(--ui-text-muted)] mb-3">
                Nessuna commessa{{ includeArchived ? '' : ' attiva' }}.
              </p>
              <UButton variant="outline" size="sm" icon="i-lucide-plus" @click="openCreate">
                Crea la prima
              </UButton>
            </td>
          </tr>
          <tr
            v-for="p in projects"
            :key="p.id"
            class="border-t border-[var(--ui-border)] hover:bg-[var(--ui-bg-elevated)] transition-colors cursor-pointer group"
            :class="{ 'opacity-50': p.archivedAt }"
            @click="openEdit(p)"
          >
            <td class="px-5 py-3.5">
              <span
                class="block size-3.5 rounded-full ring-1 ring-black/5 dark:ring-white/10"
                :style="{ background: p.color }"
                :title="p.color"
              />
            </td>
            <td class="px-2 py-3.5 font-mono text-xs tabular-nums text-[var(--ui-text-highlighted)]">
              {{ p.code }}
            </td>
            <td class="px-4 py-3.5 text-[var(--ui-text-highlighted)] font-medium">
              {{ p.name }}
            </td>
            <td class="px-4 py-3.5 text-[var(--ui-text-muted)]">
              {{ p.client || '—' }}
            </td>
            <td class="px-4 py-3.5 text-right" @click.stop>
              <UButton
                :icon="p.archivedAt ? 'i-lucide-archive-restore' : 'i-lucide-archive'"
                variant="ghost"
                color="neutral"
                size="xs"
                class="opacity-0 group-hover:opacity-100 transition-opacity"
                @click="toggleArchive(p)"
              >
                {{ p.archivedAt ? 'Riattiva' : 'Archivia' }}
              </UButton>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Drawer -->
    <USlideover v-model:open="drawerOpen" :ui="{ content: 'max-w-md' }">
      <template #content>
        <div class="flex flex-col h-full">
          <header class="px-6 py-5 border-b border-[var(--ui-border)] flex items-center justify-between">
            <div>
              <p class="text-[10px] uppercase tracking-[0.18em] text-[var(--ui-text-muted)]">
                {{ form.id ? 'Modifica' : 'Nuova' }}
              </p>
              <h2 class="text-lg font-semibold text-[var(--ui-text-highlighted)] mt-0.5">
                {{ form.id ? 'Commessa' : 'Nuova commessa' }}
              </h2>
            </div>
            <UButton
              icon="i-lucide-x"
              variant="ghost"
              color="neutral"
              size="sm"
              @click="drawerOpen = false"
            />
          </header>

          <UForm
            :schema="formSchema"
            :state="form"
            class="flex-1 overflow-y-auto px-6 py-6 space-y-5"
            @submit="submit"
          >
            <UFormField label="Codice" name="code" required hint="univoco — es. TH-2026-001">
              <UInput v-model="form.code" placeholder="TH-2026-001" class="w-full" />
            </UFormField>

            <UFormField label="Nome" name="name" required>
              <UInput v-model="form.name" placeholder="Nome commessa" class="w-full" />
            </UFormField>

            <UFormField label="Cliente" name="client" hint="opzionale">
              <UInput v-model="form.client" placeholder="Nome cliente" class="w-full" />
            </UFormField>

            <UFormField label="Colore" name="color" hint="usato nelle viste di sintesi">
              <div class="flex items-center gap-3">
                <input
                  v-model="form.color"
                  type="color"
                  class="size-10 rounded-lg cursor-pointer ring-1 ring-[var(--ui-border)] bg-transparent"
                >
                <UInput v-model="form.color" class="flex-1 font-mono text-xs" />
              </div>
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
