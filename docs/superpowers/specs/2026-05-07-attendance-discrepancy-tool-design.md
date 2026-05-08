# Attendance Discrepancy Tool — Design Doc

**Data**: 2026-05-07
**Stato**: in review
**Autore**: brainstorming session con Andrea

## Obiettivo

Strumento web autoconsistente per l'amministratrice del personale che, dato un export mensile dal gestionale presenze (due file Excel), mostra in un colpo d'occhio:

1. **Discrepanze tra ore lavorate previste e ore registrate**, per dipendente, sull'intero periodo.
2. **Ripartizione giornaliera per progetto** di ogni dipendente, con scostamenti dall'orario giornaliero atteso evidenziati visivamente.

L'utente carica i due file via drag & drop, l'app li elabora interamente client-side e produce una dashboard interattiva con filtri e toggle. Nessun backend, nessun account, nessuna persistenza dei dati al di fuori della sessione.

## Non-obiettivi

- Storicizzazione/confronto multi-mese (per ora un mese alla volta).
- Riconoscimento automatico delle ferie/malattia per giorno specifico (i file non lo permettono).
- Editing delle registrazioni (è solo un visualizzatore).
- Multi-utente, ruoli, autenticazione.
- Export PDF, stampa o file scaricabili (la condivisione dei dati avviene a video, eventualmente via screenshot del browser).

## Input — formato dei file

### File 1 — `attendance-report-total-YYYY-MM-DD.xlsx`

Aggregato mensile per dipendente. Una riga per dipendente. Colonne rilevanti:

| Colonna | Uso |
| --- | --- |
| `Numero ID dipendente` | chiave primaria |
| `Dipendente` | display name |
| `Organizzazioni del dipendente` | filtro/raggruppamento |
| `Ore programmate - Totale` | ore mensili attese (formato `HH:MM`) |
| `Ore registrate - Totale` | timbratura totale (formato `HH:MM`) |
| `Ore non giustificate - Totale` | per warning |
| `Giorni - Previsti` | denominatore per ore/giorno attese |
| `Giorni - Con registrazione` | per indicatori |
| `Giorni - Con anomalie` | per indicatori |
| `Assenze - Giorni`, `Giorni - Vacanze` | totali aggregati, mostrati ma non distribuiti per giorno |

Il nome del file contiene la data di esportazione, **non** il periodo dei dati. Il periodo effettivo va desunto dal File 2.

### File 2 — `employee_by_project_logs-YYYY-MM-DD_YYYY-MM-DD.xlsx`

Log dettagliato per giorno e progetto. Una riga per segmento di lavoro (un dipendente può avere più righe nello stesso giorno se ha cambiato progetto).

| Colonna | Uso |
| --- | --- |
| `Numero ID dipendente` | join con File 1 |
| `Data` | data del segmento (datetime) |
| `Entrata` | ora inizio (time) |
| `Uscita` | ora fine (time) |
| `Durata` | durata segmento (time HH:MM) |
| `ID progetto`, `Progetto` | identificazione progetto |

Il nome del file contiene il range di date dei dati: usato per validare la coerenza con la data di export del File 1 (warning se discrepanza).

### Validazione all'upload

- Riconoscimento del file in base alle colonne presenti, non al nome (l'utente potrebbe droppare i file in qualunque ordine).
- Errori bloccanti: colonne mancanti, file non Excel, foglio vuoto.
- Warning non bloccanti: dipendenti presenti in un file ma non nell'altro, range temporali non sovrapposti, periodo del File 2 non incluso nel mese desunto dal File 1.

## Modello dati

Strutture derivate, costruite una sola volta dopo il parsing e immutabili.

```ts
type Minutes = number  // sempre minuti, mai stringhe HH:MM nel modello

type Period = {
  start: Date  // primo giorno del File 2
  end: Date    // ultimo giorno del File 2
  workingDays: number  // giorni feriali nel range, weekend esclusi
}

type Project = {
  id: string
  name: string         // es. "250144 - Sistema AVM Roma lotto 2 (E-BUS Roma)"
  code: string         // es. "250144" estratto dal name
  shortName: string    // es. "Sistema AVM Roma lotto 2"
  color: string        // assegnato deterministicamente da hash(id)
}

type DayEntry = {
  project: Project
  startMin: number     // minuti dall'inizio del giorno
  endMin: number
  durationMin: Minutes
}

type DayLog = {
  date: Date
  isWeekend: boolean
  isHoliday: boolean              // calcolo festività italiane fisse
  entries: DayEntry[]
  totalMin: Minutes
  expectedMin: Minutes            // 0 se weekend/festivo, altrimenti expectedPerDay
  varianceMin: Minutes            // totalMin - expectedMin
  status: 'ok' | 'under' | 'over' | 'absent' | 'weekend' | 'holiday'
  // 'absent' = giorno feriale senza registrazioni
}

type Employee = {
  id: string
  name: string
  organization: string
  monthlyExpected: Minutes        // dal File 1
  expectedDays: number            // dal File 1, "Giorni - Previsti"
  expectedPerDay: Minutes         // monthlyExpected / expectedDays, arrotondato
  monthlyRegisteredAttendance: Minutes  // dal File 1, per coerenza
  monthlyLogged: Minutes          // somma da File 2
  variance: Minutes               // monthlyLogged - monthlyExpected
  variancePct: number             // variance / monthlyExpected
  daysAnomaly: number             // dal File 1
  daysWithLog: number             // calcolato
  daily: Map<isoDate, DayLog>     // popolato per ogni giorno feriale del periodo
  projectBreakdown: Array<{ project: Project; totalMin: Minutes; pct: number }>
}

type Dataset = {
  period: Period
  employees: Employee[]
  projects: Project[]
  totals: {
    expected: Minutes
    logged: Minutes
    variance: Minutes
    employeesOutOfThreshold: number
  }
  warnings: Warning[]   // mostrati come banner non bloccante
}
```

### Calcolo `expectedPerDay`

Default: `Math.round(monthlyExpected / expectedDays)` dal File 1. Cattura nativamente i part-time (es. Alex Polesel ha `80:00 / 10` = 8h, Daniele Pluchino `152:00 / 19` = 8h, dipendente full-time `160:00 / 20` = 8h).

Se `expectedDays === 0` (es. nuovo assunto, dipendente in congedo l'intero mese): `expectedPerDay = 0`, tutti i giorni saranno `status: 'ok'` con barra grigia, e mostrato badge "Nessuna ore prevista nel periodo".

### Sorgente di verità — il file `daily_breakdown`

Dopo iterazioni, è emerso che **né `Ore programmate - Totale` né `Ore contrattuali - Massime effettive`** del file `attendance-report-total` sono affidabili come baseline:
- `Ore programmate - Totale` decurta i permessi parziali a giorno intero (es. 4h di permesso → -8h dalle programmate)
- `Ore contrattuali - Massime effettive` ipotizza tutti i giorni feriali a ore tipo piene (es. 21 × 8h = 168h), sovrastimando per i giorni con permesso parziale

**Soluzione definitiva**: usare il **terzo file** del gestionale, `daily_breakdown.xlsx`, che contiene per ogni giorno di ogni dipendente:

| Colonna | Uso |
| --- | --- |
| `Data` | giorno specifico |
| `Numero ID dipendente`, `Dipendente` | join |
| `Orario - Previsto` | etichetta tipologia: "1 flessibile", "Festivo", "Giorno libero", "Permesso Retribuito", "Donazione del sangue", combinazioni come "1 flessibile, Permesso Retribuito" |
| `Orario - Registrato` | range orari della giornata (es. "09:30 - 13:30, 14:30 - 18:30") |
| `Anomalie` | "no_time_logged", "undertime", ecc. — direttamente dal gestionale |
| `Bilancio - Programmato` | **ore previste per QUEL giorno specifico** (8:00, 4:00 per permesso parziale, 0:00 festivo) |
| `Stato patrimoniale - Registrato` | timbratura del giorno |
| `Bilancio - Saldo` | saldo cumulativo a quella data |

Il file ha 1 riga per (dipendente, giorno) per tutti i giorni del periodo, inclusi sabati/domeniche/festivi.

**Architettura del nuovo flusso:**

1. `daily_breakdown` è la **fonte primaria** per `expectedMin` di ogni giorno (= `Bilancio - Programmato`)
2. `Orario - Previsto` viene classificato in `DayKind`: `workday`, `workday-with-leave`, `day-off`, `holiday`, `leave-full`, `unknown`
3. `Anomalie` viene riportato direttamente nel `DayLog`
4. `monthlyExpected` per dipendente = somma di `Bilancio - Programmato` daily (= **valore vero**, considera permessi parziali)
5. `monthlyLogged` resta dal File 2 (`employee_by_project_logs`)
6. `attendance-report-total` diventa **opzionale** (usato solo per dati anagrafici come organizzazione)

**Verifica sui dati di aprile 2026:**

| Dipendente | Pieno teorico (vecchio) | Pieno teorico (nuovo, daily) | Registrate | Scostamento corretto |
| --- | --- | --- | --- | --- |
| Andrea Toffanello | 168:00 (21×8) | **164:00** (20×8 + 1×4 permesso) | 164:00 | **0:00** ✓ |
| Francesco Collini | 143:00 | **157:00** | 158:30 | **+1:30** |
| Daniele Pluchino | 160:00 | (verificare nei dati) | (idem) | (più stabile) |

Per Andrea, il 23 aprile è marcato come `1 flessibile, Permesso Retribuito` con previsto 4:00 invece di 8:00. Il sistema lo riconosce come `workday-with-leave` e usa il valore corretto, eliminando lo scostamento spurio.

### Layout dei due file in upload

La drop-zone fullscreen presenta **due caselle** affiancate (grid `grid-cols-2`):

1. **Daily breakdown** (richiesto, step 1)
2. **Foglio progetti** (richiesto, step 2)

L'auto-detect del tipo di file via columns set funziona per entrambi. Se l'utente trascina per sbaglio il vecchio `attendance-report-total`, il parser lo riconosce e mostra un hint "Il riepilogo presenze non serve a questo strumento, l'ho ignorato": il file è supportato dal modello dati come opzionale (per arricchire con l'organizzazione anagrafica), ma non ha più una zona di drop dedicata né blocca il flusso.

**Perché basta 2 file**: il `daily_breakdown` contiene già tutti i totali aggregati (sommando `Bilancio - Programmato` per dipendente otteniamo il monthly previsto, sommando le ore loggate sui progetti dal File 2 otteniamo il registrato), quindi `attendance-report-total` è ridondante. L'unica perdita è il campo `Organizzazioni del dipendente` (es. "Software", "Sistemi ITS") che mostravamo come badge accanto al nome.

### Status del giorno

Il `DayLog.status` viene calcolato come prima ma con i nuovi `DayKind`:

```
if kind == 'holiday'        → 'holiday'
if kind == 'day-off'        → 'weekend'
if kind == 'leave-full'     → 'leave'
if expected==0 && total==0  → 'weekend'
if total==0 && expected>0   → 'absent'
if |variance| <= threshold  → 'ok'
if variance < 0             → 'under'
else                        → 'over'
```

I colori distintivi:
- `holiday` → blu chiaro (era grigio chiaro)
- `leave` → ambra (NUOVO)
- `weekend`/`day-off` → grigio chiaro
- `absent` → grigio scuro
- `ok` → verde
- `under` → rosso
- `over` → blu

### Calcolo `status` di un giorno

```
if isWeekend → 'weekend'
elif isHoliday → 'holiday'
elif totalMin == 0 → 'absent'
elif |varianceMin| <= threshold → 'ok'
elif varianceMin < 0 → 'under'
else → 'over'
```

`threshold` è in minuti, configurabile via slider (default 15, range 0–60).

### Festività italiane

Set fisso lato client: 1 gen, 6 gen, 25 apr, 1 mag, 2 giu, 15 ago, 1 nov, 8 dic, 25 dic, 26 dic + Pasquetta calcolata. Sufficiente per uso italiano. Documentato come "festività nazionali, non considera patrono locale".

## Architettura tecnica

### Stack

- **Nuxt 4** con `srcDir: 'app/'` (default Nuxt 4)
- **Vue 3 Composition API**
- **`@nuxt/ui`** per chrome (cards, buttons, popover, slideover, USlider, USelectMenu)
- **Pinia composition store** (`ref`/`computed`, niente `state`/`getters`/`actions`)
- **Unovis** (`@unovis/vue`, `@unovis/ts`) per heatmap, stacked bar, donut, timeline-Gantt
- **xlsx** (SheetJS) per parsing Excel client-side
- **Tailwind CSS** (incluso da `@nuxt/ui`)

### Layout fisico

- Single Page Application, una sola route `/`
- 3 stati di pagina, gestiti da un componente di livello superiore in base alla presenza dei dati nello store:
  - **Stato A — Empty**: drop-zone fullscreen di benvenuto
  - **Stato B — Overview**: dashboard aziendale + sidebar con elenco dipendenti
  - **Stato C — Detail**: dashboard del singolo dipendente
- Stato B e C condividono header (KPI azienda + filtri globali) e sidebar; cambia solo il contenuto del main panel. Niente client-side routing tra B e C: è un toggle reattivo basato su `selectedEmployeeId`.

### Struttura cartelle (app/)

```
app/
  components/
    upload/
      DropZone.vue                # drag&drop fullscreen, gestisce 1 o 2 file
      FileBadge.vue               # badge file caricato con bottone reset
    overview/
      OverviewKpis.vue            # 5 KPI tiles azienda
      EmployeeMatrixHeatmap.vue   # heatmap dipendenti × giorni (Unovis Heatmap)
      EmployeeBarRanking.vue      # bar chart orizzontale ordinato per scostamento
    detail/
      DetailHeader.vue            # nome + 6 KPI inline sticky
      DailyStackedBar.vue         # barra giornaliera per progetto + linea attesa
      TimeOfDayGantt.vue          # Gantt orario (Unovis Timeline o SVG nativo)
      ProjectDonut.vue            # ripartizione progetti
      MonthCalendarHeatmap.vue    # mini calendario 5×7 del singolo dipendente
      TopVariancesList.vue        # top 5 giorni con scostamento maggiore
    layout/
      AppHeader.vue               # filtri globali + KPI azienda
      EmployeeSidebar.vue         # lista dipendenti con barrette
      WarningsBanner.vue          # avvisi parsing/validazione
  stores/
    dataset.ts                    # Pinia store principale (defineStore composition)
    filters.ts                    # Pinia store filtri (date range, progetti, soglia, toggle)
  composables/
    useExcelParser.ts             # incapsula xlsx + WebWorker
    useProjectColors.ts           # palette deterministica
    useItalianHolidays.ts         # festività
  pages/
    index.vue                     # entrypoint, switch sui 3 stati
  workers/
    excelParser.worker.ts         # parsing xlsx fuori dal main thread
  utils/
    minutes.ts                    # parse 'HH:MM' ↔ minuti, format
    dateRange.ts                  # workingDays, weekend, ecc.
    statistics.ts                 # variance, percentili
  app.vue
nuxt.config.ts
package.json
```

### Parsing client-side

`xlsx` gira dentro un WebWorker dedicato. Il main thread invia `ArrayBuffer`, il worker risponde con un payload JSON-serializzabile (date come ISO string, durate come minuti). Limite pratico stimato: file fino a ~10 MB / 50.000 righe entro 2 s su MacBook moderno. Per i sample (28 KB e 10 KB) è istantaneo, ma il worker isola comunque l'UI.

Il riconoscimento del file (attendance vs project_logs) avviene controllando il set di colonne dell'header del primo foglio, indipendente dal nome.

### Store Pinia (composition style)

```ts
// stores/dataset.ts
export const useDatasetStore = defineStore('dataset', () => {
  const attendanceFile = ref<File | null>(null)
  const projectLogsFile = ref<File | null>(null)
  const isParsing = ref(false)
  const parseError = ref<string | null>(null)
  const dataset = ref<Dataset | null>(null)
  const selectedEmployeeId = ref<string | null>(null)

  const isReady = computed(() => dataset.value !== null)
  const selectedEmployee = computed(() =>
    dataset.value?.employees.find(e => e.id === selectedEmployeeId.value) ?? null
  )

  async function loadFile(file: File) { /* … */ }
  function reset() { /* … */ }
  function selectEmployee(id: string | null) { /* … */ }

  return { /* refs + computed + actions */ }
})
```

`useFiltersStore` (in `stores/filters.ts`) separato perché i filtri agiscono trasversalmente sulle viste e devono essere memo-cached:

```ts
const dateRange = ref<[Date, Date] | null>(null)  // null = tutto il periodo
const visibleProjectIds = ref<Set<string>>(new Set())  // vuoto = tutti
const onlyOutOfThreshold = ref(false)
const thresholdMin = ref(15)
const includeWeekend = ref(false)

const filteredEmployees = computed(() => /* applica filtri */)
const filteredDailyOf = (employeeId: string) => computed(() => /* … */)
```

## Viste in dettaglio

### Overview aziendale (Stato B)

Layout a tre zone:

**Top bar (sticky, condivisa con Detail)**:
- KPI tiles: ore previste tot, ore loggate tot, scostamento azienda %, # dipendenti fuori soglia, ore/giorno medie reali
- Filtri globali a destra: date range picker, multi-select progetti, slider soglia, toggle solo-scostamenti, toggle weekend

**Sidebar sinistra (condivisa con Detail, ~280px)**:
- Lista dipendenti, per ognuno: nome, organizzazione, micro-bar orizzontale che mostra registrate/previste, badge scostamento %. Click → diventa `selectedEmployeeId` (apre Detail).
- Ordinabile per: scostamento (default), nome, ore registrate.

**Main**:
- **Heatmap matrice dipendenti × giorni** (Unovis `Heatmap` o `XYContainer` con `Heatmap`):
  - Asse Y = dipendenti (ordine = sidebar)
  - Asse X = giorni del mese
  - Cella colorata in base a `status`: scala diverging rosso→bianco→blu per under→ok→over, grigio chiaro per weekend, grigio scuro tratteggiato per festività, grigio medio per absent
  - Hover → tooltip: ore attese, ore loggate, scostamento, lista progetti
  - Click su una cella → seleziona il dipendente E imposta `dateRange` su quel singolo giorno (drill-down implicito senza navigazione)
- Sotto la heatmap, **bar chart orizzontale ordinato**: ogni dipendente con barra registrate + marker `expected`. Etichetta a destra con scostamento `±H:MM (±X%)`. Stesso ordinamento della sidebar.

### Detail dipendente (Stato C)

Sostituisce solo il main panel. Sidebar e top-bar restano. Layout:

**Riga 1 — Header dipendente (sticky sotto la top bar)**:
nome grande, organizzazione, e 6 KPI inline:
- Previste mese (`H:MM`)
- Registrate mese (`H:MM`)
- Scostamento (`±H:MM` + `±%` con colore)
- Giorni con anomalia (badge)
- # progetti distinti
- Ore medie/giorno effettive

**Riga 2 — Stacked bar giornaliera (full-width, ~340px alta)**:
- X = giorni feriali del periodo
- Stack = ore per progetto, ordine progetti deterministico
- Linea tratteggiata orizzontale = `expectedPerDay`
- Bordo rosso 2px sulle barre `under`/`over` fuori soglia
- Banda colorata sotto ogni barra (4px) per status, leggibile anche con palette progetti complessa
- Click su un segmento progetto → toggle visibilità di quel progetto (e syncato in `useFiltersStore`)
- Hover → tooltip con breakdown completo del giorno

**Riga 3 — Time-of-day Gantt (full-width, ~280px alta)**:
- X = giorni del mese, Y = ore del giorno (range dinamico in base ai dati, tipicamente 7:00–20:00)
- Per ogni giorno, blocchi rettangolari posizionati su `startMin`–`endMin` di ogni `DayEntry`, colorati per progetto
- Linea orizzontale tratteggiata sull'orario teorico cumulato di 8h (es. se attesa è 8h, evidenzia che il dipendente "dovrebbe" aver lavorato 8 ore, indipendentemente dalla fascia)
- I "buchi" tra blocchi nella stessa giornata sono visivamente evidenti e raccontano pause/interruzioni
- Implementazione: SVG nativo dentro il componente `TimeOfDayGantt.vue`, perché Unovis Timeline è pensato più per "rows of events" che per griglia tempo-su-tempo. Costo basso: rect posizionati linearmente. Se in fase di implementazione si verifica che `Timeline` di Unovis funziona, usiamo quello.

**Riga 4 — Pannello inferiore a 3 colonne**:
- **Donut progetti** (sx, ~340px): % allocazione mensile, label con `H:MM`. Click su slice → toggle filtro progetto (sync con stacked bar e Gantt)
- **Mini-calendar heatmap 5×7** (centro): dello stesso dipendente, ridondante con la matrice aziendale ma centrata e con tooltip dettagliato. Marca week-end e festività in modo distinto.
- **Top scostamenti** (dx): lista dei 5 giorni con `|varianceMin|` maggiore, ognuno con data, totale, atteso, delta, e mini-breakdown progetti. Click → imposta `dateRange` su quel giorno.

## Filtri — comportamento

Tutti i filtri sono globali e si applicano a entrambe le viste. La modifica di un filtro ricalcola `filteredEmployees` e `filteredDailyOf` via `computed`, quindi tutti i grafici si aggiornano in sync.

| Filtro | Comportamento |
| --- | --- |
| Date range | Restringe Gantt, stacked bar, calendar; KPI vengono ricalcolati sull'intervallo selezionato |
| Progetti visibili | Nasconde i segmenti dei progetti deselezionati ovunque (le barre si "abbassano"); i totali esclusi vengono comunque mostrati come "ore nascoste" in tooltip per onestà |
| Soglia minuti | Ridefinisce `status` di ogni `DayLog` al volo; cambia colorazione e # fuori soglia |
| Solo scostamenti | Filtra dipendenti e giorni con `|variance| > threshold` |
| Includi weekend | Quando off (default), le colonne sabato/domenica sono compresse o nascoste; quando on, mostrate ma marcate come `weekend` (atteso = 0) |

## Drag & drop

- Drop-zone copre l'intera viewport quando vuota (Stato A).
- Quando uno dei due file è già caricato, la drop-zone si comprime in una banda in alto. L'altro file può essere droppato lì.
- Un solo file può essere droppato alla volta? **No**: l'utente può droppare entrambi insieme. Il riconoscimento per colonne distingue automaticamente quale è quale.
- Reset: bottone "Carica nuovi file" sostituisce entrambi.
- Non viene fatto nulla in localStorage/IndexedDB. Refresh = stato pulito. (Possibile estensione futura, fuori scope.)

## Accessibilità e responsiveness

- Target primario: desktop 1440×900+. È uno strumento da scrivania.
- Responsive fino a 1024px funzionante: la sidebar collassa in drawer aperto da bottone. Sotto 1024px il Gantt diventa scroll-orizzontale.
- Mobile non supportato per la dashboard, ma l'upload sì (per chi vuole iniziare il flusso).
- Contrasto colori: palette dello status diverging certificata WCAG AA per i toni principali. Pattern aggiuntivo (tratteggio) sulle celle festività per leggibilità daltonici.
- `prefers-reduced-motion`: disabilita le transizioni di mount dei grafici, mantiene solo gli stati di hover.

## Performance

- Stimato: 17 dipendenti × ~22 giorni × ~4 segmenti = ~1.500 cell render. Banalmente entro budget Unovis (testato su 100k punti).
- Memoization aggressiva su `filteredEmployees` e `filteredDailyOf` via `computed`.
- I colori dei progetti sono assegnati una sola volta al parsing e cachati in store.

## Errori e edge case

| Caso | Comportamento |
| --- | --- |
| Solo File 1 caricato | Drop-zone resta aperta per il File 2 con messaggio chiaro; nessun calcolo parziale. |
| Solo File 2 caricato | Idem ma per File 1. Richiediamo entrambi. |
| Dipendente in File 2 ma non in File 1 | Warning banner, dipendente mostrato con `monthlyExpected = 0` e badge "Non in attendance report". |
| Dipendente in File 1 ma non in File 2 | Mostrato con tutte le ore loggate a 0, scostamento = `-monthlyExpected`. |
| `expectedDays = 0` | Mostrato, ma badge "Nessuna ora prevista" e niente colorazione status. |
| Periodo File 2 fuori da mese previsto | Warning banner "Periodi disallineati", l'app comunque funziona usando il range del File 2. |
| File non Excel / corrotto | Errore in toast, drop-zone resta aperta. |
| File con colonne mancanti | Errore specifico che dice quali colonne mancano. |

## Testing — definition of done

- [ ] `pnpm typecheck` e `pnpm lint` puliti
- [ ] Build dev/prod senza warning nuovi
- [ ] Test E2E Playwright in `tests/e2e/`:
  - upload entrambi i file di sample → atteso: numero esatto di dipendenti e KPI corretti
  - upload solo uno dei due → atteso: drop-zone resta aperta
  - upload file con colonne mancanti → atteso: errore specifico
  - filtro per progetto → atteso: barre si aggiornano e KPI scendono coerentemente
  - selezione dipendente da heatmap → atteso: vista detail con dati corretti
- [ ] Screenshot Playwright "prima" (empty) e "dopo" (con dati di sample) allegati
- [ ] Contrasto WCAG AA verificato per colori status
- [ ] `prefers-reduced-motion` testato disabilitando le transizioni
- [ ] Test unitario sul parser per: HH:MM ↔ minuti, distinzione dei due file per colonne, calcolo `expectedPerDay` con `expectedDays = 0`
- [ ] Test unitario sul calcolo status (ok/under/over/absent/weekend/holiday)

## Apertura per estensioni future

Esplicitamente fuori scope ma il design lo permette:
- IndexedDB per ricaricare l'ultimo upload
- Confronto multi-mese se l'utente carica più coppie di file
- Annotazioni manuali su giorni anomali (es. "ferie", "trasferta")
- Export PDF/Excel del report (al momento non richiesto)

## Decisioni esplicite

1. **Tutto client-side** — privacy + zero deploy backend.
2. **Unovis vs Nuxt Chart** — Unovis per heatmap nativa e maggiore controllo, Nuxt Chart è solo wrapping di Chart.js, più povero per le viste matrice/Gantt che ci servono.
3. **Niente export** — la condivisione dei dati avviene a video. Se serve mandare un report, l'utente fa screenshot.
4. **Niente client-side routing tra Overview e Detail** — un solo route, switch reattivo. Mantiene lo stato della top bar e della sidebar senza glitch.
5. **`expectedPerDay` derivato dal File 1** — gestisce part-time automaticamente, niente input manuale per dipendente.
6. **Festività italiane fisse** — sufficiente per uso italiano, no librerie esterne.
