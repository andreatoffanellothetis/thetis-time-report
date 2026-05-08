import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { DayLog, Employee, IsoDate } from '~/types/domain'
import { useDatasetStore } from '~/stores/dataset'

export const useFiltersStore = defineStore('filters', () => {
  const datasetStore = useDatasetStore()

  const dateRange = ref<[IsoDate, IsoDate] | null>(null)
  const visibleProjectIds = ref<Set<string>>(new Set())
  const onlyOutOfThreshold = ref(false)
  const includeWeekend = ref(false)
  const sortBy = ref<'variance' | 'name' | 'logged'>('variance')

  const allProjectsVisible = computed(() =>
    visibleProjectIds.value.size === 0
    || visibleProjectIds.value.size === (datasetStore.dataset?.projects.length ?? 0),
  )

  function isProjectVisible(projectId: string): boolean {
    if (visibleProjectIds.value.size === 0) return true
    return visibleProjectIds.value.has(projectId)
  }

  function toggleProject(projectId: string) {
    const set = new Set(visibleProjectIds.value)
    const all = datasetStore.dataset?.projects ?? []
    if (set.size === 0) {
      for (const p of all) set.add(p.id)
    }
    if (set.has(projectId)) set.delete(projectId)
    else set.add(projectId)
    if (set.size === all.length) set.clear()
    visibleProjectIds.value = set
  }

  function showAllProjects() {
    visibleProjectIds.value = new Set()
  }

  function showOnlyProject(projectId: string) {
    visibleProjectIds.value = new Set([projectId])
  }

  function setDateRange(range: [IsoDate, IsoDate] | null) {
    dateRange.value = range
  }

  function setSingleDay(iso: IsoDate) {
    dateRange.value = [iso, iso]
  }

  function clearDateRange() {
    dateRange.value = null
  }

  function isDayInRange(iso: IsoDate): boolean {
    if (!dateRange.value) return true
    return iso >= dateRange.value[0] && iso <= dateRange.value[1]
  }

  function filterEmployeeDaily(employee: Employee): DayLog[] {
    const out: DayLog[] = []
    for (const day of employee.daily.values()) {
      if (!isDayInRange(day.isoDate)) continue
      if (!includeWeekend.value && (day.isWeekend || day.isHoliday)) continue
      out.push(day)
    }
    out.sort((a, b) => a.isoDate.localeCompare(b.isoDate))
    return out
  }

  function isOutOfThreshold(day: DayLog): boolean {
    if (day.status === 'weekend' || day.status === 'holiday') return false
    return Math.abs(day.varianceMin) > datasetStore.thresholdMin
  }

  const visibleEmployees = computed<Employee[]>(() => {
    const ds = datasetStore.dataset
    if (!ds) return []
    let list = [...ds.employees]
    if (onlyOutOfThreshold.value) {
      list = list.filter((e) => {
        return Array.from(e.daily.values()).some(d => isOutOfThreshold(d))
      })
    }
    if (sortBy.value === 'name') list.sort((a, b) => a.name.localeCompare(b.name, 'it'))
    else if (sortBy.value === 'logged') list.sort((a, b) => b.monthlyLogged - a.monthlyLogged)
    else list.sort((a, b) => a.variancePctFull - b.variancePctFull)
    return list
  })

  return {
    dateRange,
    visibleProjectIds,
    onlyOutOfThreshold,
    includeWeekend,
    sortBy,
    allProjectsVisible,
    visibleEmployees,
    isProjectVisible,
    toggleProject,
    showAllProjects,
    showOnlyProject,
    setDateRange,
    setSingleDay,
    clearDateRange,
    isDayInRange,
    isOutOfThreshold,
    filterEmployeeDaily,
  }
})
