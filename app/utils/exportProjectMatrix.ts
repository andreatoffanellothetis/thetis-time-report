import ExcelJS from 'exceljs'
import type { Period, Project } from '~/types/domain'
import { toIsoDate, formatPeriod } from '~/utils/dateRange'
import { formatHoursIt } from '~/utils/minutes'

export interface MatrixModelRow {
  employeeId: string
  employeeName: string
  organization: string
  byDay: Map<string, number>
  total: number
}

export interface MatrixModel {
  project: Project
  period: Period
  days: Date[]
  rows: MatrixModelRow[]
  dayTotals: Map<string, number>
  grandTotal: number
}

const DOW_LETTERS = ['D', 'L', 'M', 'M', 'G', 'V', 'S']

function dowLetter(d: Date): string {
  return DOW_LETTERS[d.getUTCDay()]!
}

function isWeekendDate(d: Date): boolean {
  const dow = d.getUTCDay()
  return dow === 0 || dow === 6
}

function buildTsv(model: MatrixModel): string {
  const lines: string[] = []
  const header = ['Dipendente', ...model.days.map(d => `${dowLetter(d)} ${d.getUTCDate()}`), 'Totale']
  lines.push(header.join('\t'))
  for (const r of model.rows) {
    const cells = [
      r.employeeName,
      ...model.days.map(d => {
        const min = r.byDay.get(toIsoDate(d)) ?? 0
        return formatHoursIt(min, { emptyOnZero: true })
      }),
      formatHoursIt(r.total),
    ]
    lines.push(cells.join('\t'))
  }
  const totalsLine = [
    'Totale giorno',
    ...model.days.map(d => {
      const min = model.dayTotals.get(toIsoDate(d)) ?? 0
      return formatHoursIt(min, { emptyOnZero: true })
    }),
    formatHoursIt(model.grandTotal),
  ]
  lines.push(totalsLine.join('\t'))
  return lines.join('\n')
}

export async function copyMatrixToClipboard(model: MatrixModel): Promise<void> {
  const tsv = buildTsv(model)
  await navigator.clipboard.writeText(tsv)
}

function safeFileName(s: string): string {
  return s.replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim()
}

export async function exportMatrixXlsx(model: MatrixModel): Promise<void> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Thetis Time Report'
  wb.created = new Date()

  const sheetName = safeFileName(model.project.shortName).slice(0, 28) || 'Commessa'
  const sheet = wb.addWorksheet(sheetName, {
    views: [{ state: 'frozen', xSplit: 1, ySplit: 3 }],
  })

  sheet.mergeCells(1, 1, 1, model.days.length + 2)
  const titleCell = sheet.getCell(1, 1)
  titleCell.value = `${model.project.shortName}${model.project.code ? ` · ${model.project.code}` : ''} — ${formatPeriod(model.period.start, model.period.end)}`
  titleCell.font = { bold: true, size: 13 }
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' }
  sheet.getRow(1).height = 22

  const headerDow = ['', ...model.days.map(d => dowLetter(d)), '']
  const headerDay = ['Dipendente', ...model.days.map(d => d.getUTCDate()), 'Totale']

  const dowRow = sheet.getRow(2)
  dowRow.values = headerDow
  dowRow.font = { bold: true, color: { argb: 'FF6B7280' }, size: 9 }
  dowRow.alignment = { horizontal: 'center' }

  const dayRow = sheet.getRow(3)
  dayRow.values = headerDay
  dayRow.font = { bold: true, size: 11 }
  dayRow.alignment = { horizontal: 'center' }
  dayRow.getCell(1).alignment = { horizontal: 'left' }

  for (let i = 0; i < model.days.length; i++) {
    const d = model.days[i]!
    const colIdx = 2 + i
    if (isWeekendDate(d)) {
      for (const rowIdx of [2, 3]) {
        const c = sheet.getRow(rowIdx).getCell(colIdx)
        c.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF3F4F6' },
        }
      }
    }
  }

  let rowIdx = 4
  for (const r of model.rows) {
    const row = sheet.getRow(rowIdx)
    row.getCell(1).value = r.employeeName
    row.getCell(1).font = { bold: true }
    for (let i = 0; i < model.days.length; i++) {
      const d = model.days[i]!
      const min = r.byDay.get(toIsoDate(d)) ?? 0
      const cell = row.getCell(2 + i)
      if (min > 0) {
        cell.value = Number((min / 60).toFixed(2))
        cell.numFmt = '0.##'
      }
      cell.alignment = { horizontal: 'right' }
      if (isWeekendDate(d)) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF9FAFB' },
        }
      }
    }
    const totalCell = row.getCell(2 + model.days.length)
    totalCell.value = Number((r.total / 60).toFixed(2))
    totalCell.numFmt = '0.##'
    totalCell.font = { bold: true }
    totalCell.alignment = { horizontal: 'right' }
    totalCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF3F4F6' },
    }
    rowIdx++
  }

  const totalsRow = sheet.getRow(rowIdx)
  totalsRow.getCell(1).value = 'Totale giorno'
  totalsRow.getCell(1).font = { bold: true }
  for (let i = 0; i < model.days.length; i++) {
    const d = model.days[i]!
    const min = model.dayTotals.get(toIsoDate(d)) ?? 0
    const cell = totalsRow.getCell(2 + i)
    if (min > 0) {
      cell.value = Number((min / 60).toFixed(2))
      cell.numFmt = '0.##'
    }
    cell.alignment = { horizontal: 'right' }
    cell.font = { bold: true }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF3F4F6' },
    }
  }
  const grandCell = totalsRow.getCell(2 + model.days.length)
  grandCell.value = Number((model.grandTotal / 60).toFixed(2))
  grandCell.numFmt = '0.##'
  grandCell.font = { bold: true }
  grandCell.alignment = { horizontal: 'right' }
  grandCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE5E7EB' },
  }

  sheet.getColumn(1).width = 30
  for (let i = 0; i < model.days.length; i++) {
    sheet.getColumn(2 + i).width = 5
  }
  sheet.getColumn(2 + model.days.length).width = 9

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const periodLabel = `${toIsoDate(model.period.start)}_${toIsoDate(model.period.end)}`
  a.href = url
  a.download = `commessa_${safeFileName(model.project.shortName)}_${periodLabel}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
