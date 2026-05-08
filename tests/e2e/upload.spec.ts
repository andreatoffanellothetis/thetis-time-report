import { test, expect } from '@playwright/test'
import path from 'node:path'
import os from 'node:os'

const LOGS = path.join(os.homedir(), 'Downloads', 'employee_by_project_logs-2026-04-01_2026-04-30.xlsx')
const DAILY = path.join(os.homedir(), 'Downloads', 'daily_breakdown (2).xlsx')

test('carica entrambi i file e mostra dashboard', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Report presenze Thetis' })).toBeVisible()

  const inputs = page.locator('input[type="file"]')
  await inputs.nth(0).setInputFiles(DAILY)
  await inputs.nth(1).setInputFiles(LOGS)

  await expect(page.getByText('Mappa giornaliera scostamenti')).toBeVisible({ timeout: 15_000 })
  await page.screenshot({ path: 'tests/e2e/screenshots/01-overview.png', fullPage: true })

  await page.locator('aside button', { hasText: 'Andrea Toffanello' }).first().click()
  await expect(page.getByText('Ore per giorno e progetto')).toBeVisible()
  await page.screenshot({ path: 'tests/e2e/screenshots/02-detail-andrea.png', fullPage: true })

  // hover su una barra del DailyStackedBar per catturare il tooltip
  const firstBar = page.locator('.relative.h-\\[280px\\] > *').nth(8)
  await firstBar.hover()
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'tests/e2e/screenshots/02b-detail-andrea-tooltip.png', fullPage: true })

  // poi clicca per filtrare singolo giorno
  await firstBar.click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'tests/e2e/screenshots/02c-detail-andrea-singleday.png', fullPage: true })

  await page.locator('aside button', { hasText: 'Alessandro Busatto' }).first().click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'tests/e2e/screenshots/03-detail-busatto.png', fullPage: true })

  await page.locator('aside button', { hasText: 'Francesco Collini' }).first().click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'tests/e2e/screenshots/04-detail-collini.png', fullPage: true })
})
