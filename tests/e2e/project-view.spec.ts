import { test, expect } from '@playwright/test'
import path from 'node:path'
import os from 'node:os'

const LOGS = path.join(os.homedir(), 'Downloads', 'employee_by_project_logs-2026-04-01_2026-04-30.xlsx')
const DAILY = path.join(os.homedir(), 'Downloads', 'daily_breakdown (2).xlsx')

test('vista per commessa: matrice ore', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Report presenze Thetis' })).toBeVisible()

  const inputs = page.locator('input[type="file"]')
  await inputs.nth(0).setInputFiles(DAILY)
  await inputs.nth(1).setInputFiles(LOGS)

  await expect(page.getByText('Mappa giornaliera scostamenti')).toBeVisible({ timeout: 15_000 })

  await page.getByRole('button', { name: 'Commesse' }).click()

  await expect(page.getByText('Seleziona una commessa')).toBeVisible()
  await page.screenshot({ path: 'tests/e2e/screenshots/10-projects-empty.png', fullPage: true })

  const firstProject = page.locator('aside button').nth(3)
  await firstProject.click()

  await expect(page.getByText('Ore per giorno e dipendente')).toBeVisible()
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'tests/e2e/screenshots/11-project-matrix.png', fullPage: true })

  const matrixCell = page.locator('table tbody td').filter({ hasText: /^\d+(?:,\d+)?$/ }).first()
  if (await matrixCell.count()) {
    await matrixCell.hover()
    await page.waitForTimeout(150)
    await page.screenshot({ path: 'tests/e2e/screenshots/12-project-matrix-hover.png', fullPage: true })
  }

  await page.getByRole('button', { name: 'Dipendenti' }).click()
  await expect(page.getByText('Mappa giornaliera scostamenti')).toBeVisible()
})
