<script setup lang="ts">
import { z } from 'zod'

import type { UserRole } from '~~/server/db/schema'

definePageMeta({ layout: false })

const route = useRoute()
const { fetch: refreshSession, loggedIn } = useUserSession()

// Se sei già loggato, vai alla destinazione (o home)
watchEffect(() => {
  if (loggedIn.value) {
    const next = typeof route.query.next === 'string' ? route.query.next : '/'
    navigateTo(next, { replace: true })
  }
})

const schema = z.object({
  email: z.string().email('Email non valida'),
  displayName: z.string().max(120).optional(),
  roles: z.array(z.string()).min(1, 'Seleziona almeno un ruolo'),
})

type FormState = {
  email: string
  displayName: string
  roles: UserRole[]
}

const state = reactive<FormState>({
  email: '',
  displayName: '',
  roles: ['employee'],
})

const roleOptions: { value: UserRole; label: string; hint: string }[] = [
  { value: 'employee', label: 'Employee', hint: 'inserisce le proprie ore' },
  { value: 'manager', label: 'Manager', hint: 'vede e modifica il team' },
  { value: 'admin', label: 'Admin', hint: 'accesso totale (anagrafiche, festività, tipi orario)' },
]

const loading = ref(false)
const errorMsg = ref<string | null>(null)

async function submit() {
  loading.value = true
  errorMsg.value = null
  try {
    await $fetch('/api/auth/dev-login', {
      method: 'POST',
      body: {
        email: state.email.trim().toLowerCase(),
        displayName: state.displayName.trim() || undefined,
        roles: state.roles,
      },
    })
    await refreshSession()
    const next = typeof route.query.next === 'string' ? route.query.next : '/'
    await navigateTo(next, { replace: true })
  }
  catch (e) {
    const err = e as { data?: { message?: string }, message?: string }
    errorMsg.value = err.data?.message ?? err.message ?? 'Login fallito'
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen grid place-items-center px-6 py-12 bg-[color-mix(in_oklch,var(--ui-bg)_70%,var(--ui-bg-elevated))]">
    <div class="w-full max-w-md">
      <header class="mb-8 space-y-2">
        <p class="text-xs uppercase tracking-[0.18em] text-[var(--ui-text-muted)]">
          Thetis · Time Report
        </p>
        <h1 class="text-2xl font-semibold tracking-tight text-[var(--ui-text-highlighted)]">
          Login (sviluppo)
        </h1>
        <p class="text-sm text-[var(--ui-text-muted)] leading-relaxed">
          Stub temporaneo: scegli email e ruoli, l'utente viene creato/aggiornato al volo.
          Sarà sostituito dal SSO Microsoft non appena il tenant Entra è pronto.
        </p>
      </header>

      <UCard
        :ui="{
          root: 'ring-1 ring-[var(--ui-border)] shadow-sm',
          body: 'p-6 sm:p-7',
        }"
      >
        <UForm
          :schema="schema"
          :state="state"
          class="space-y-5"
          @submit="submit"
        >
          <UFormField label="Email" name="email" required>
            <UInput
              v-model="state.email"
              type="email"
              autocomplete="email"
              placeholder="nome.cognome@thetisit.com"
              autofocus
              class="w-full"
            />
          </UFormField>

          <UFormField
            label="Nome visualizzato"
            name="displayName"
            hint="opzionale — derivato dall'email se vuoto"
          >
            <UInput
              v-model="state.displayName"
              placeholder="Mario Rossi"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Ruoli" name="roles" required>
            <div class="space-y-2.5">
              <label
                v-for="opt in roleOptions"
                :key="opt.value"
                class="flex items-start gap-3 cursor-pointer rounded-lg px-3 py-2.5 ring-1 ring-transparent hover:ring-[var(--ui-border)] hover:bg-[var(--ui-bg-elevated)] transition-colors"
              >
                <UCheckbox
                  :model-value="state.roles.includes(opt.value)"
                  @update:model-value="(checked: boolean | 'indeterminate') => {
                    const isChecked = checked === true
                    if (isChecked && !state.roles.includes(opt.value)) state.roles.push(opt.value)
                    else if (!isChecked) state.roles = state.roles.filter(r => r !== opt.value)
                  }"
                />
                <div class="-mt-0.5">
                  <p class="text-sm font-medium text-[var(--ui-text-highlighted)]">
                    {{ opt.label }}
                  </p>
                  <p class="text-xs text-[var(--ui-text-muted)] mt-0.5">
                    {{ opt.hint }}
                  </p>
                </div>
              </label>
            </div>
          </UFormField>

          <Transition
            enter-active-class="transition-all duration-200 ease-out"
            enter-from-class="opacity-0 -translate-y-1"
            leave-active-class="transition-all duration-150 ease-in"
            leave-to-class="opacity-0"
          >
            <UAlert
              v-if="errorMsg"
              color="error"
              variant="soft"
              :title="errorMsg"
            />
          </Transition>

          <UButton
            type="submit"
            block
            :loading="loading"
            color="primary"
            size="lg"
          >
            Entra
          </UButton>
        </UForm>
      </UCard>

      <p class="mt-6 text-xs text-[var(--ui-text-muted)] text-center leading-relaxed">
        Endpoint disabilitato in produzione (a meno di flag esplicita).
      </p>
    </div>
  </div>
</template>
