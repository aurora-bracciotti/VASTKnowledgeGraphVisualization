<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as d3 from 'd3'

import { computeArtistInfluenceNetwork, computeArtistProfile, computeTimeline, getGenreCandidates,} from '../data/metrics.js'

const props = defineProps({
  graph: {
    type: Object,
    required: true,
  },
  index: {
    type: Object,
    default: null,
  },
  artistId: {
    type: [String, Number],
    default: null,
  },
  filters: {
    type: Object,
    required: true,
  },
})
const focusGenre = ref(null)

const genreCandidates = computed(() =>
  props.graph && props.artistId ? getGenreCandidates(props.graph, props.artistId) : [],
)

watch(
  [genreCandidates, () => props.filters?.genre],
  ([candidates, globalGenre]) => {
    const labels = candidates.map((candidate) => candidate.label)

    if (globalGenre && labels.includes(globalGenre)) {
      focusGenre.value = globalGenre
      return
    }

    if (!focusGenre.value || !labels.includes(focusGenre.value)) {
      focusGenre.value = candidates[0]?.label ?? null
    }
  },
  { immediate: true },
)

// Metriche 
const profile = computed(() =>
  props.graph && props.artistId ? computeArtistProfile(props.graph, props.artistId) : null,
)

const timelineRows = computed(() =>
  props.graph && props.artistId
    ? computeTimeline(props.graph, props.artistId, focusGenre.value, props.index?.pathAdjacency ?? null)
    : [],
)

const influenceNetwork = computed(() =>
  props.graph && props.artistId
    ? computeArtistInfluenceNetwork(props.graph, props.artistId, focusGenre.value, props.index?.pathAdjacency ?? null)
    : null,
)

// Active period dell'artista, con un anno di margine per leggibilità.
const yearRange = computed(() => {
  const p = profile.value
  if (!p || !p.firstYear || !p.lastYear) return null
  return [p.firstYear - 1, p.lastYear + 1]
})

// Il filtro "Year range" globale restringe la finestra mostrata
const effectiveYearRange = computed(() => {
  if (!yearRange.value) return null

  const [artistMin, artistMax] = yearRange.value
  const filterMin = props.filters?.minYear
  const filterMax = props.filters?.maxYear

  if (filterMin == null && filterMax == null) return yearRange.value

  const lo = filterMin != null ? Math.max(artistMin, filterMin) : artistMin
  const hi = filterMax != null ? Math.min(artistMax, filterMax) : artistMax

  return lo <= hi ? [lo, hi] : null
})

const yearRangeExcludesArtist = computed(
  () =>
    Boolean(yearRange.value) &&
    (props.filters?.minYear != null || props.filters?.maxYear != null) &&
    !effectiveYearRange.value,
)

// Riempie gli anni mancanti nel range con righe a 0, per avere un asse  continuo invece di barre "sparse"
function fillYears(range, rows, keys) {
  if (!range) return []
  const [minYear, maxYear] = range
  const byYear = new Map(rows.map((row) => [row.year, row]))
  const out = []
  for (let year = minYear; year <= maxYear; year += 1) {
    const source = byYear.get(year)
    const filled = { year }
    for (const key of keys) filled[key] = source ? (source[key] ?? 0) : 0
    out.push(filled)
  }
  return out
}

const worksData = computed(() =>
  fillYears(effectiveYearRange.value, timelineRows.value, ['songs', 'albums', 'artistInfluences']),
)

const topInfluencers = computed(() => influenceNetwork.value?.receivedFrom.slice(0, 6) ?? [])
const topInfluenced = computed(() => influenceNetwork.value?.givenTo.slice(0, 6) ?? [])

const summary = computed(() => {
  const p = profile.value
  const net = influenceNetwork.value
  if (!p) return null
  return {
    label: p.node.label ?? p.node.name ?? p.node.id,
    period: p.firstYear && p.lastYear ? `${p.firstYear} – ${p.lastYear}` : 'N/D',
    works: p.workCount,
    influenceLinks: p.influenceLinks,
    received: net?.totalReceived ?? 0,
    given: net?.totalGiven ?? 0,
  }
})

const hasData = computed(() => Boolean(props.graph && props.artistId && profile.value))

// --- SUMMARY ---
// Se anno selezionato mostra il nome dei lavori dell'anno e le influence 
const selectedYear = ref(null)

const selectedYearWorks = computed(() => {
  if (selectedYear.value === null) return []
  const row = timelineRows.value.find((r) => r.year === selectedYear.value)
  return row?.workItems ?? []
})

function toggleSelectedYear(year) {
  selectedYear.value = selectedYear.value === year ? null : year
}

// Canzone/Album selezionati nel pannello filtri: "salta" al lavoro prendo direttamente l'anno in cui è uscito
const focusWorkId = computed(() => props.filters?.songId || props.filters?.albumId || null)

// Cambio in caso di modfica filtri
watch(
  [() => props.artistId, focusGenre, focusWorkId],
  ([, , workId]) => {
    if (workId && props.graph) {
      const node = props.graph.nodeById.get(String(workId))
      selectedYear.value = node?.releaseYear ?? null
      return
    }

    selectedYear.value = null
  },
  { immediate: true },
)


const tooltip = ref({ visible: false, x: 0, y: 0, title: '', lines: [] })
const panelRoot = ref(null)

const TOOLTIP_APPROX_WIDTH = 180
const TOOLTIP_APPROX_HEIGHT = 60

function showTooltip(event, containerEl, title, lines) {
  const root = panelRoot.value ?? containerEl
  const bounds = root.getBoundingClientRect()

  const rawX = event.clientX - bounds.left + 12
  const rawY = event.clientY - bounds.top + 12

  const maxX = Math.max(0, bounds.width - TOOLTIP_APPROX_WIDTH)
  const maxY = Math.max(0, bounds.height - TOOLTIP_APPROX_HEIGHT)

  tooltip.value = {
    visible: true,
    x: Math.min(Math.max(rawX, 0), maxX),
    y: Math.min(Math.max(rawY, 0), maxY),
    title,
    lines,
  }
}

function hideTooltip() {
  tooltip.value.visible = false
}

// --- RENDER ---
const mainChartWrap = ref(null)
const mainChartSvg = ref(null)
const influencersWrap = ref(null)
const influencersSvg = ref(null)
const influencedWrap = ref(null)
const influencedSvg = ref(null)

const COLORS = {
  songs: '#2563eb',
  albums: '#93c5fd',
  influenceLine: '#f97316',
  received: '#16a34a',
  given: '#e11d48',
  axis: '#64748b',
  grid: '#e2e8f0',
}

function measure(el, fallback) {
  if (!el) return fallback
  const rect = el.getBoundingClientRect()
  return {
    width: rect.width > 0 ? rect.width : fallback.width,
    height: rect.height > 0 ? rect.height : fallback.height,
  }
}

function yearTickValues(years, maxTicks) {
  if (years.length <= maxTicks) return years
  const step = Math.ceil(years.length / maxTicks)
  return years.filter((_, i) => i % step === 0)
}

// --- Grafico ---
function drawMainChart() {
  const el = mainChartSvg.value
  if (!el) return
  const { width, height } = measure(mainChartWrap.value, { width: 360, height: 220 })
  const margin = { top: 12, right: 34, bottom: 26, left: 30 }
  const innerW = Math.max(10, width - margin.left - margin.right)
  const innerH = Math.max(10, height - margin.top - margin.bottom)

  const svg = d3.select(el).attr('width', width).attr('height', height)
  svg.selectAll('*').remove()

  const data = worksData.value
  if (!data.length) return

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

  const years = data.map((d) => d.year)
  const x = d3.scaleBand().domain(years).range([0, innerW]).padding(0.3)

  const maxWorks = d3.max(data, (d) => d.songs + d.albums) || 1
  const y = d3.scaleLinear().domain([0, maxWorks]).nice().range([innerH, 0])

  const maxInfluence = d3.max(data, (d) => d.artistInfluences) || 1
  const y2 = d3.scaleLinear().domain([0, maxInfluence]).nice().range([innerH, 0])

  // Griglia orizzontale
  g.append('g')
    .attr('stroke', COLORS.grid)
    .selectAll('line')
    .data(y.ticks(4))
    .join('line')
    .attr('x1', 0)
    .attr('x2', innerW)
    .attr('y1', (d) => y(d))
    .attr('y2', (d) => y(d))

  // Barre impilate
  const stacked = d3.stack().keys(['songs', 'albums'])(data)
  const stackColor = { songs: COLORS.songs, albums: COLORS.albums }

  g.selectAll('.stack-layer')
    .data(stacked)
    .join('g')
    .attr('fill', (d) => stackColor[d.key])
    .selectAll('rect')
    .data((d) => d.map((point) => ({ ...point, key: d.key })))
    .join('rect')
    .attr('x', (d) => x(d.data.year))
    .attr('y', (d) => y(d[1]))
    .attr('width', x.bandwidth())
    .attr('height', (d) => Math.max(0, y(d[0]) - y(d[1])))
    .attr('stroke', (d) => (d.data.year === selectedYear.value ? '#1e293b' : 'none'))
    .attr('stroke-width', (d) => (d.data.year === selectedYear.value ? 2 : 0))
    .style('cursor', 'pointer')
    .on('mousemove', (event, d) => {
      showTooltip(event, mainChartWrap.value, `${d.data.year}`, [
        `Songs: ${d.data.songs}`,
        `Albums: ${d.data.albums}`,
        `Influence links: ${d.data.artistInfluences}`,
        'Click for details',
      ])
    })
    .on('mouseleave', hideTooltip)
    .on('click', (event, d) => {
      toggleSelectedYear(d.data.year)
    })

  // Linea delle influence
  const line = d3
    .line()
    .x((d) => x(d.year) + x.bandwidth() / 2)
    .y((d) => y2(d.artistInfluences))
    .curve(d3.curveMonotoneX)

  g.append('path')
    .datum(data)
    .attr('fill', 'none')
    .attr('stroke', COLORS.influenceLine)
    .attr('stroke-width', 2)
    .attr('d', line)

  g.selectAll('.influence-dot')
    .data(data)
    .join('circle')
    .attr('cx', (d) => x(d.year) + x.bandwidth() / 2)
    .attr('cy', (d) => y2(d.artistInfluences))
    .attr('r', 3)
    .attr('fill', COLORS.influenceLine)
    .on('mousemove', (event, d) => {
      showTooltip(event, mainChartWrap.value, `${d.year}`, [
        `Influence links: ${d.artistInfluences}`,
      ])
    })
    .on('mouseleave', hideTooltip)

  // Assi
  g.append('g')
    .attr('transform', `translate(0,${innerH})`)
    .call(d3.axisBottom(x).tickValues(yearTickValues(years, Math.floor(innerW / 34))))
    .call((axis) => axis.selectAll('text').attr('font-size', 10).attr('fill', COLORS.axis))
    .call((axis) => axis.selectAll('path,line').attr('stroke', COLORS.grid))

  g.append('g')
    .call(d3.axisLeft(y).ticks(4))
    .call((axis) => axis.selectAll('text').attr('font-size', 10).attr('fill', COLORS.axis))
    .call((axis) => axis.selectAll('path,line').attr('stroke', COLORS.grid))

  g.append('g')
    .attr('transform', `translate(${innerW},0)`)
    .call(d3.axisRight(y2).ticks(4))
    .call((axis) => axis.selectAll('text').attr('font-size', 10).attr('fill', COLORS.influenceLine))
    .call((axis) => axis.selectAll('path,line').attr('stroke', COLORS.grid))
}

// --- Grafici classifiche orizzontali (chi influenza / chi è influenzato) ---
function drawRankedBars(svgEl, wrapEl, rows, color, emptyLabel) {
  if (!svgEl) return
  const { width, height } = measure(wrapEl, { width: 260, height: 160 })
  const margin = { top: 4, right: 34, bottom: 4, left: 8 }
  const innerW = Math.max(10, width - margin.left - margin.right)
  const innerH = Math.max(10, height - margin.top - margin.bottom)

  const svg = d3.select(svgEl).attr('width', width).attr('height', height)
  svg.selectAll('*').remove()

  if (!rows.length) {
    svg
      .append('text')
      .attr('x', width / 2)
      .attr('y', height / 2)
      .attr('text-anchor', 'middle')
      .attr('font-size', 11)
      .attr('fill', COLORS.axis)
      .text(emptyLabel)
    return
  }

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

  const y = d3
    .scaleBand()
    .domain(rows.map((d) => d.label))
    .range([0, innerH])
    .padding(0.28)

  // Spazio tra la fine dell'etichetta e l'inizio della barra.
  const LABEL_GAP = 10

  const bars = g
    .selectAll('.rank-row')
    .data(rows)
    .join('g')
    .attr('transform', (d) => `translate(0,${y(d.label)})`)

  const labels = bars
    .append('text')
    .attr('x', 0)
    .attr('y', y.bandwidth() / 2)
    .attr('dy', '0.35em')
    .attr('font-size', 11)
    .attr('fill', '#1e293b')
    .text((d) => d.label)

  // Nomi 
  let maxLabelWidth = 0
  labels.each(function () {
    maxLabelWidth = Math.max(maxLabelWidth, this.getComputedTextLength())
  })

  const barX = maxLabelWidth + LABEL_GAP

  const x = d3
    .scaleLinear()
    .domain([0, d3.max(rows, (d) => d.value) || 1])
    .nice()
    .range([0, Math.max(10, innerW - barX)])

  bars
    .append('rect')
    .attr('x', barX)
    .attr('y', 2)
    .attr('height', Math.max(4, y.bandwidth() - 4))
    .attr('width', (d) => x(d.value))
    .attr('fill', color)
    .attr('rx', 2)
    .on('mousemove', (event, d) => {
      showTooltip(event, wrapEl, d.label, [`Influence links: ${d.value}`])
    })
    .on('mouseleave', hideTooltip)

  bars
    .append('text')
    .attr('x', (d) => barX + x(d.value) + 4)
    .attr('y', y.bandwidth() / 2)
    .attr('dy', '0.35em')
    .attr('font-size', 10)
    .attr('fill', COLORS.axis)
    .text((d) => d.value)
}

function drawAll() {
  drawMainChart()
  drawRankedBars(influencersSvg.value, influencersWrap.value, topInfluencers.value, COLORS.received, 'No influence received')
  drawRankedBars(influencedSvg.value, influencedWrap.value, topInfluenced.value, COLORS.given, 'No influence given in this genre')
}

async function redraw() {
  await nextTick()
  drawAll()
}

// selectedYear è incluso per ridisegnare l'evidenziazione della barra cliccata (il resto del grafico resta identico)
watch([worksData, topInfluencers, topInfluenced, selectedYear], redraw)

let resizeObserver = null
let scheduledRedraw = null

function scheduleRedraw() {
  if (scheduledRedraw !== null) return

  scheduledRedraw = requestAnimationFrame(() => {
    scheduledRedraw = null
    redraw()
  })
}

onMounted(() => {
  resizeObserver = new ResizeObserver(() => scheduleRedraw())
  ;[mainChartWrap, influencersWrap, influencedWrap].forEach((wrap) => {
    if (wrap.value) resizeObserver.observe(wrap.value)
  })
  redraw()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  if (scheduledRedraw !== null) cancelAnimationFrame(scheduledRedraw)
})
</script>

<template>
  <div ref="panelRoot" class="relative flex flex-col gap-3 text-slate-900">
    <!-- STATO VUOTO -->
    <div v-if="!hasData" class="flex items-center justify-center py-10 text-sm text-slate-500">
      Select an artist to view their timeline.
    </div>

    <template v-else>
      <!-- HEADER -->
      <div class="flex shrink-0 flex-wrap items-center justify-between gap-2">
      <div>
        <div class="mb-3">
          <div class="flex items-center gap-1.5">
              <h4 class="text-sm font-semibold text-slate-900">{{ summary.label }} timeline</h4>

              <div class="group relative shrink-0">
                <button
                  type="button"
                  class="flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 bg-white text-[10px] font-semibold text-slate-600"
                  aria-label="Information about this panel"
                >
                  ?
                </button>
                <div
                  class="pointer-events-none absolute left-0 top-6 z-30 hidden w-72 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs leading-5 text-white shadow-xl group-hover:block group-focus-within:block"
                >
                  <strong>What does this panel show?</strong>
                  <br />
                  <p> The chart plots songs, albums and influence links per year for the selected artist and reference genre. Click a bar to see that year's works, contributors and influences below. The two rankings at the bottom show who influenced this artist most and who they influenced in turn. </p>
                </div>
              </div>
          </div>
        </div>

        <!-- STATO FILTRI ATTIVI -->
        <div
          v-if="yearRangeExcludesArtist || (effectiveYearRange && (props.filters?.minYear != null || props.filters?.maxYear != null)) || focusWorkId"
          class="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500"
        >
          <span class="font-medium text-slate-600"> Active from filters: </span>

          <span
            v-if="effectiveYearRange && (props.filters?.minYear != null || props.filters?.maxYear != null)"
            class="rounded-full border border-slate-300 bg-white px-2 py-0.5"
          >
            Years {{ effectiveYearRange[0] }}–{{ effectiveYearRange[1] }}
          </span>

          <span
            v-if="yearRangeExcludesArtist"
            class="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700"
          >
            Year range outside {{ summary.label }}'s active period
          </span>

          <span
            v-if="focusWorkId"
            class="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-blue-700"
          >
            Jumped to selected work
          </span>
        </div>
      </div>
    </div>

      <!-- SUMMARY -->
      <div class="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
        <div class="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
          <div class="text-[10px] uppercase tracking-wide text-slate-500">Active period</div>
          <div class="text-sm font-semibold">{{ summary.period }}</div>
        </div>
        <div class="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
          <div class="text-[10px] uppercase tracking-wide text-slate-500">Works</div>
          <div class="text-sm font-semibold">{{ summary.works }}</div>
        </div>
        <div class="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
          <div class="text-[10px] uppercase tracking-wide text-slate-500">Influence link</div>
          <div class="text-sm font-semibold">{{ summary.influenceLinks }}</div>
        </div>
        <div class="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
          <div class="text-[10px] uppercase tracking-wide text-slate-500">Received / Given</div>
          <div class="text-sm font-semibold">{{ summary.received }} / {{ summary.given }}</div>
        </div>
      </div>

      <!-- GRAFICO PRINCIPALE: lavori vs influence -->
      <div class="mb-10">
        <div class="mb-1 flex items-center gap-3 text-[10px] text-slate-500">
          <span class="flex items-center gap-1"><i class="h-2 w-2 rounded-sm" :style="{ background: '#2563eb' }" />Songs</span>
          <span class="flex items-center gap-1"><i class="h-2 w-2 rounded-sm" :style="{ background: '#93c5fd' }" />Albums</span>
          <span class="flex items-center gap-1"><i class="h-2 w-2 rounded-full" :style="{ background: '#f97316' }" />Influence links (asse dx)</span>
          <span class="ml-auto italic text-slate-400"></span>
        </div>

        <div
          v-if="yearRangeExcludesArtist"
          class="flex h-40 w-full items-center justify-center rounded-lg border border-dashed border-amber-200 bg-amber-50 px-4 text-center text-xs text-amber-700"
        >
          No data for {{ summary.label }} in the selected Year range filter. Widen or clear it in the filters panel to see this chart again.
        </div>

        <div v-else ref="mainChartWrap" class="relative h-40 w-full">
          <svg ref="mainChartSvg" class="h-full w-full"></svg>
        </div>
      </div>

      <!-- DETTAGLIO ANNO SELEZIONATO (click su una barra dei lavori) -->
        <div
          v-if="selectedYear !== null"
          class="min-h-0 shrink-0 max-h-44 overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
        >
      <!-- HEADER FISSO -->
      <div
        class="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 px-2 py-1.5"
      >
        <div class="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Works {{ selectedYear }}
        </div>

        <button
          type="button"
          class="flex h-5 w-5 items-center justify-center rounded-full border-slate-300 bg-white text-xs font-semibold leading-none text-slate-500 shadow-sm hover:bg-slate-100 hover:text-slate-900"
          @click="selectedYear = null"
          aria-label="Close selected year details"
          title="Close"
        >
          ×
        </button>
      </div>

      <!-- CONTENUTO SCORREVOLE -->
      <div class="min-h-0 max-h-36 overflow-y-auto p-2">
        <div
          v-if="!selectedYearWorks.length"
          class="text-xs text-slate-500"
        >
          No works in this year.
        </div>

        <div
          v-else
          class="flex flex-col gap-2"
        >
          <div
            v-for="work in selectedYearWorks"
            :key="work.id"
            class="rounded-md border bg-white p-2"
            :class="
              String(work.id) === String(focusWorkId)
                ? 'border-blue-400 ring-1 ring-blue-200'
                : 'border-slate-200'
            "
          >
            <div class="flex items-center justify-between gap-2">
              <div class="text-xs font-semibold text-slate-900">
                {{ work.label }}
              </div>

              <span
                class="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-slate-500"
              >
                {{ work.nodeType }}
              </span>
            </div>

            <div
              v-if="work.genre && work.genre !== 'Unknown'"
              class="mt-0.5 text-[10px] text-slate-500"
            >
              Genre: {{ work.genre }}
            </div>

            <div
              v-if="work.contributors.length"
              class="mt-1.5"
            >
              <div class="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                Name & role
              </div>

              <div class="mt-0.5 flex flex-wrap gap-1">
                <span
                  v-for="c in work.contributors"
                  :key="`${work.id}-c-${c.id}-${c.role}`"
                  class="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-700"
                >
                  {{ c.name }} · {{ c.role }}
                </span>
              </div>
            </div>

            <div
              v-if="work.influences.received.length"
              class="mt-1.5"
            >
              <div
                class="text-[9px] font-semibold uppercase tracking-wide"
                :style="{ color: COLORS.received }"
              >
                Influence received
              </div>

              <ul class="mt-0.5 list-disc pl-4">
                <li
                  v-for="inf in work.influences.received"
                  :key="`${work.id}-r-${inf.id}`"
                  class="text-[10px] text-slate-600"
                >
                  {{ inf.name }}
                  <span class="text-slate-400">
                    ({{ inf.role }})
                  </span>
                </li>
              </ul>
            </div>

            <div
              v-if="work.influences.given.length"
              class="mt-1.5"
            >
              <div
                class="text-[9px] font-semibold uppercase tracking-wide"
                :style="{ color: COLORS.given }"
              >
                Influence given
              </div>

              <ul class="mt-0.5 list-disc pl-4">
                <li
                  v-for="inf in work.influences.given"
                  :key="`${work.id}-g-${inf.id}`"
                  class="text-[10px] text-slate-600"
                >
                  {{ inf.name }}
                  <span class="text-slate-400">
                    ({{ inf.role }})
                  </span>
                </li>
              </ul>
            </div>

            <div
              v-if="
                !work.contributors.length &&
                !work.influences.received.length &&
                !work.influences.given.length
              "
              class="mt-1 text-[10px] text-slate-400"
            >
              No additional information available.
            </div>
          </div>
        </div>
      </div>
    </div>


      <!-- CLASSIFICHE -->
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <div class="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Top influences on {{ summary.label }}
          </div>
          <div ref="influencersWrap" class="relative h-32 w-full">
            <svg ref="influencersSvg" class="h-full w-full"></svg>
          </div>
        </div>
        <div>
          <div class="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Influenced collaborators in «{{ focusGenre ?? '—' }}»
          </div>
          <div ref="influencedWrap" class="relative h-32 w-full">
            <svg ref="influencedSvg" class="h-full w-full"></svg>
          </div>
        </div>
      </div>
    </template>

    <!-- TOOLTIP CONDIVISO -->
    <div
      v-if="tooltip.visible"
      class="pointer-events-none absolute z-10 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] shadow-md"
      :style="{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }"
    >
      <div class="font-semibold text-slate-900">{{ tooltip.title }}</div>
      <div v-for="line in tooltip.lines" :key="line" class="text-slate-600">{{ line }}</div>
    </div>
  </div>
</template>
