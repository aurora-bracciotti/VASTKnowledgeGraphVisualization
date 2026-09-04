<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as d3 from 'd3'

import { buildEgoNetwork } from '../data/metrics.js'
import { countBy, isArtist } from '../data/graphTransforms.js'
import {isInfluenceLink, relationshipDash, RELATIONSHIP_CATEGORY_ORDER, RELATIONSHIP_CATEGORIES,} from '../data/relationship.js'

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

const emit = defineEmits([
  'select-artist',
])

const chartContainer = ref(null)

// --- HELPER: debounce ---
function debounce(fn, delay = 150) {
  let timeoutId = null
  return (...args) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}

// --- CENTRO DELL'EGO NETWORK ---

// Se l'utente ha scelto una canzone o un album nel pannello filtri, quello diventa il centro di default  altrimenti si torna al comportamento originale, cioè l'artista attivo della dashboard
const defaultCenterId = computed(() => props.filters?.songId || props.filters?.albumId || props.artistId)

// Di norma coincide con defaultCenterId, ma l'utente può ricentrare la vista su un qualsiasi "alter" per navigare il grafo facendo click sul nodo
const centerId = ref(defaultCenterId.value)
const navigationHistory = ref([])

watch(
  defaultCenterId,
  (value) => {
    navigationHistory.value = []
    centerId.value = value
  },
)

// Controlli utente
const depth = ref(1)

const nodeLimitDraft = ref(60)
const nodeLimit = ref(60)
const commitNodeLimit = debounce((value) => {
  nodeLimit.value = value
}, 150)
watch(nodeLimitDraft, (value) => commitNodeLimit(value))

let simulation = null
let zoomBehavior = null
let svgSelection = null
let nodeSelectionRef = null
let linkSelectionRef = null
let labelSelectionRef = null

const centerNode = computed(() => {
  if (!props.graph || centerId.value === null || centerId.value === undefined) {
    return null
  }
  return props.graph.nodeById.get(String(centerId.value)) ?? null
})

// Filtro "Relationship" 
const relationshipFilter = computed(() => props.filters?.relationship || null)

// Filtro "Genre": evidenzia soltanto i nodi con quel genere 
const highlightGenre = computed(() => props.filters?.genre || null)

// --- EGO NETWORK ---
const egoData = computed(() => {
  if (!props.graph || !centerNode.value) {
    return { nodes: [], links: [] }
  }

  return buildEgoNetwork(
    props.graph,
    centerNode.value.id,
    depth.value,
    nodeLimit.value,
    props.index?.degreeById ?? null,
    props.index?.adjacency ?? null,
    {
      relationshipType: relationshipFilter.value,
      pathAdjacency: props.index?.pathAdjacency ?? null,
    },
  )
})

const alterCount = computed(() => Math.max(0, egoData.value.nodes.length - 1))
const linkCount = computed(() => egoData.value.links.length)

const localMaxDegree = computed(() => {
  return egoData.value.nodes.reduce((max, node) => Math.max(max, node.degree ?? 0), 0)
})

const allNodeTypes = computed(() => {
  if (!props.graph?.nodes) return []
  return [...new Set(props.graph.nodes.map((node) => node.nodeType))].sort()
})

const color = computed(() =>
  d3
    .scaleOrdinal()
    .domain(allNodeTypes.value)
    .range(d3.schemeTableau10),
)

const typesInView = computed(() => {
  return [...new Set(
    egoData.value.nodes
      .filter((node) => node.id !== centerNode.value?.id)
      .map((node) => node.nodeType),
  )].sort()
})

const categoriesInView = computed(() => {
  return RELATIONSHIP_CATEGORY_ORDER.filter((key) =>
    egoData.value.links.some((link) => relationshipCategoryOf(link) === key),
  )
})

function relationshipCategoryOf(link) {
  const type = String(link?.edgeTypeKey ?? link?.edgeType ?? '').toLowerCase()
  return (
    RELATIONSHIP_CATEGORY_ORDER.find(
      (category) =>
        category !== 'other' &&
        RELATIONSHIP_CATEGORIES[category].tokens.some((token) => type.includes(token)),
    ) ?? 'other'
  )
}

// --- SUMMARY ---

// Alter con il grado piu alto nella vista corrente
const topConnected = computed(() => {
  return egoData.value.nodes
    .filter((node) => node.id !== centerNode.value?.id)
    .slice()
    .sort((a, b) => (b.degree ?? 0) - (a.degree ?? 0))
    .slice(0, 5)
})

// Generi tra gli alter attualmente visibili
const genreBreakdown = computed(() => {
  const relevant = egoData.value.nodes.filter(
    (node) => node.id !== centerNode.value?.id && node.genre && node.genre !== 'Unknown',)

  return countBy(relevant, (node) => node.genre).slice(0, 5)
})

// Link diretti e indiretti (più hop)
const directLinks = computed(() => {
  if (!centerNode.value) return []

  return egoData.value.links.filter(
    (link) => link.source === centerNode.value.id || link.target === centerNode.value.id,)
})

const directAlterCount = computed(() => {
  return egoData.value.nodes.filter((node) => node.distance === 1).length
})

const indirectAlterCount = computed(() => {
  return Math.max(0, alterCount.value - directAlterCount.value)
})

const directRelationshipBreakdown = computed(() => {
  const counts = new Map()

  for (const link of directLinks.value) {
    const category = relationshipCategoryOf(link)
    counts.set(category, (counts.get(category) ?? 0) + 1)
  }

  return RELATIONSHIP_CATEGORY_ORDER.filter((key) => counts.has(key))
    .map((key) => ({
      key,
      label: RELATIONSHIP_CATEGORIES[key].label,
      count: counts.get(key),
    }))
    .sort((a, b) => b.count - a.count)
})

// Quante delle relazioni dirette sono nello specifico "influenze", per leggere subito il ruolo dell'ego come influenza/influenzato
const directInfluenceCount = computed(() => {
  return directLinks.value.filter(isInfluenceLink).length
})

let radiusScale = d3.scaleSqrt().domain([0, 1]).range([5, 15]).clamp(true)

function alterRadius(degree) {
  return radiusScale(degree ?? 0)
}

const CENTER_RADIUS = 22

// --- NAVIGAZIONE ---
const breadcrumbs = computed(() => {
  const ids = [...navigationHistory.value, centerId.value].filter(
    (id) => id !== null && id !== undefined,
  )

  return ids.map((id) => ({
    id,
    label: props.graph?.nodeById.get(String(id))?.label ?? 'Unknown',
  }))
})

function recenter(newId) {
  if (String(newId) === String(centerId.value)) return
  navigationHistory.value.push(centerId.value)
  centerId.value = newId
}

function jumpTo(id) {
  const historyIndex = navigationHistory.value.findIndex(
    (item) => String(item) === String(id),
  )

  if (historyIndex === -1) return

  navigationHistory.value = navigationHistory.value.slice(0, historyIndex)
  centerId.value = id
}

function resetToActiveArtist() {
  navigationHistory.value = []
  centerId.value = defaultCenterId.value
}

const isOffArtist = computed(
  () => String(centerId.value) !== String(defaultCenterId.value),
)

const canSetAsArtist = computed(
  () => centerNode.value && isArtist(centerNode.value) && isOffArtist.value,
)

function setAsActiveArtist() {
  if (centerNode.value) emit('select-artist', centerNode.value.id)
}

// --- RENDER ---

function dragBehavior(activeSimulation) {
  function started(event, d) {
    if (d.isCenter) return
    if (!event.active) activeSimulation.alphaTarget(0.3).restart()
    d.fx = d.x
    d.fy = d.y
  }

  function dragged(event, d) {
    if (d.isCenter) return
    d.fx = event.x
    d.fy = event.y
  }

  function ended(event, d) {
    if (d.isCenter) return
    if (!event.active) activeSimulation.alphaTarget(0)
    d.fx = null
    d.fy = null
  }

  return d3.drag().on('start', started).on('drag', dragged).on('end', ended)
}


function isGenreMatch(d) {
  return Boolean(highlightGenre.value) && d.genre === highlightGenre.value
}

function baseOpacity(d) {
  if (d.isCenter || !highlightGenre.value) return 1
  return isGenreMatch(d) ? 1 : 0.35
}

function renderEgo() {
  if (!chartContainer.value) return

  const container = chartContainer.value
  d3.select(container).selectAll('*').remove()

  if (simulation) {
    simulation.stop()
    simulation = null
  }

  nodeSelectionRef = null
  linkSelectionRef = null
  labelSelectionRef = null

  if (!centerNode.value) {
    d3.select(container)
      .append('div')
      .attr(
        'class',
        'flex h-[420px] items-center justify-center text-sm text-slate-400',
      )
      .text('Select an artist to explore its ego network.')
    return
  }

  const { nodes: rawNodes, links: rawLinks } = egoData.value

  const width = container.clientWidth || 700
  const height = 520
  const cx = width / 2
  const cy = height / 2

  const maxDistance = rawNodes.reduce((max, node) => Math.max(max, node.distance ?? 0), 0)
  const ringGap = Math.max(70, Math.min(140, (Math.min(width, height) / 2 - 40) / Math.max(1, maxDistance)))
  const ringRadius = (distance) => distance * ringGap

  // Cloniamo nodi e link per non alterare il grafo condiviso
  const simNodes = rawNodes.map((node) => ({
    ...node,
    isCenter: node.id === centerNode.value.id,
  }))
  const nodeById = new Map(simNodes.map((node) => [node.id, node]))
  const simLinks = rawLinks
    .map((link) => ({
      ...link,
      source: nodeById.get(link.source),
      target: nodeById.get(link.target),
    }))
    .filter((link) => link.source && link.target)

  const centerSimNode = nodeById.get(centerNode.value.id)
  if (centerSimNode) {
    centerSimNode.x = cx
    centerSimNode.y = cy
    centerSimNode.fx = cx
    centerSimNode.fy = cy
  }

  radiusScale = d3
    .scaleSqrt()
    .domain([0, Math.max(1, localMaxDegree.value)])
    .range([5, 15])
    .clamp(true)

  const svg = d3
    .select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('width', '100%')
    .attr('height', height)
    .style('cursor', 'grab')

  svgSelection = svg

  const zoomLayer = svg.append('g').attr('class', 'zoom-layer')

  zoomBehavior = d3
    .zoom()
    .scaleExtent([0.3, 6])
    .on('zoom', (event) => {
      zoomLayer.attr('transform', event.transform)
    })

  svg.call(zoomBehavior)

  const ringsGroup = zoomLayer.append('g')

  for (let distance = 1; distance <= maxDistance; distance += 1) {
    ringsGroup
      .append('circle')
      .attr('cx', cx)
      .attr('cy', cy)
      .attr('r', ringRadius(distance))
      .attr('fill', 'none')
      .attr('stroke', '#e2e8f0')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4 4')

    ringsGroup
      .append('text')
      .attr('x', cx + ringRadius(distance) + 4)
      .attr('y', cy - 4)
      .attr('class', 'fill-slate-400 text-[9px]')
      .text(`${distance} hop${distance > 1 ? 's' : ''}`)
  }

  const tooltip = d3
    .select(container)
    .append('div')
    .style('position', 'absolute')
    .style('pointer-events', 'none')
    .style('opacity', 0)
    .style('background', '#0f172a')
    .style('color', 'white')
    .style('padding', '8px 10px')
    .style('border-radius', '6px')
    .style('font-size', '12px')
    .style('line-height', '1.4')
    .style('z-index', 20)

  const linkSelection = zoomLayer
    .append('g')
    .selectAll('line')
    .data(simLinks)
    .join('line')
    .attr('stroke', '#94a3b8')
    .attr('stroke-width', 1.2)
    .attr('stroke-dasharray', (d) => relationshipDash(d) || null)
    .attr('opacity', 0.55)

  const nodeSelection = zoomLayer
    .append('g')
    .selectAll('circle')
    .data(simNodes)
    .join('circle')
    .attr('r', (d) => (d.isCenter ? CENTER_RADIUS : alterRadius(d.degree)))
    .attr('fill', (d) => (d.isCenter ? '#0f172a' : color.value(d.nodeType)))
    .attr('stroke', (d) => (isGenreMatch(d) ? '#f59e0b' : 'white'))
    .attr('stroke-width', (d) => (d.isCenter ? 3 : isGenreMatch(d) ? 3 : 1.2))
    .attr('opacity', baseOpacity)
    .style('cursor', (d) => (d.isCenter ? 'default' : 'pointer'))
    .call(dragBehavior(null))

  // Etichette sempre visibili: il centro e gli alter a distanza 1 (poi hover)
  const labelSelection = zoomLayer
    .append('g')
    .selectAll('text')
    .data(simNodes.filter((d) => d.isCenter || d.distance === 1))
    .join('text')
    .attr('class', (d) =>
      d.isCenter
        ? 'fill-slate-900 text-[10px] font-semibold'
        : 'fill-slate-700 text-[9px] font-medium',
    )
    .attr('text-anchor', 'middle')
    .style('pointer-events', 'none')
    .text((d) => d.label)

  const neighborsOf = new Map(simNodes.map((node) => [node.id, new Set()]))
  simLinks.forEach((link) => {
    neighborsOf.get(link.source.id)?.add(link.target.id)
    neighborsOf.get(link.target.id)?.add(link.source.id)
  })

  nodeSelection
    .on('mouseenter', function (event, d) {
      const connected = neighborsOf.get(d.id) ?? new Set()

      nodeSelection.attr('opacity', (n) =>
        n.id === d.id || connected.has(n.id) ? 1 : 0.15,
      )
      linkSelection.attr('opacity', (l) =>
        l.source.id === d.id || l.target.id === d.id ? 0.9 : 0.05,
      )
      labelSelection.attr('opacity', (n) =>
        n.id === d.id || connected.has(n.id) ? 1 : 0.1,
      )

      tooltip.style('opacity', 1).html(
        `<strong>${d.label}</strong><br/>
         ${d.nodeType}${d.genre && d.genre !== 'Unknown' ? ` · ${d.genre}` : ''}<br/>
         ${d.isCenter ? 'Ego (center)' : `distance ${d.distance} · degree ${d.degree}`}`,
      )
    })
    .on('mousemove', (event) => {
      const rect = container.getBoundingClientRect()
      tooltip
        .style('left', `${event.clientX - rect.left + 12}px`)
        .style('top', `${event.clientY - rect.top + 12}px`)
    })
    .on('mouseleave', () => {
      nodeSelection.attr('opacity', baseOpacity)
      linkSelection.attr('opacity', 0.55)
      labelSelection.attr('opacity', 1)
      tooltip.style('opacity', 0)
    })
    .on('click', (event, d) => {
      if (!d.isCenter) recenter(d.id)
    })

  simulation = d3
    .forceSimulation(simNodes)
    .force(
      'link',
      d3.forceLink(simLinks).strength(0.04),
    )
    .force('charge', d3.forceManyBody().strength(-40))
    .force(
      'radial',
      d3
        .forceRadial((d) => ringRadius(d.distance ?? 0), cx, cy)
        .strength((d) => (d.isCenter ? 0 : 0.85)),
    )
    .force(
      'collide',
      d3.forceCollide().radius((d) => (d.isCenter ? CENTER_RADIUS : alterRadius(d.degree)) + 4),
    )
    .on('tick', () => {
      linkSelection
        .attr('x1', (d) => d.source.x)
        .attr('y1', (d) => d.source.y)
        .attr('x2', (d) => d.target.x)
        .attr('y2', (d) => d.target.y)

      nodeSelection.attr('cx', (d) => d.x).attr('cy', (d) => d.y)

      labelSelection
        .attr('x', (d) => d.x)
        .attr('y', (d) => d.y - (d.isCenter ? CENTER_RADIUS : alterRadius(d.degree)) - 4)
    })

  nodeSelection.call(dragBehavior(simulation))

  nodeSelectionRef = nodeSelection
  linkSelectionRef = linkSelection
  labelSelectionRef = labelSelection
}


function applyHighlight() {
  if (!nodeSelectionRef || !linkSelectionRef) return

  nodeSelectionRef
    .attr('stroke', (d) => (isGenreMatch(d) ? '#f59e0b' : 'white'))
    .attr('stroke-width', (d) => (d.isCenter ? 3 : isGenreMatch(d) ? 3 : 1.2))
    .attr('opacity', baseOpacity)
}

function resetZoom() {
  if (!svgSelection || !zoomBehavior) return
  svgSelection.transition().duration(300).call(zoomBehavior.transform, d3.zoomIdentity)
}

function zoomBy(factor) {
  if (!svgSelection || !zoomBehavior) return
  svgSelection.transition().duration(200).call(zoomBehavior.scaleBy, factor)
}

async function scheduleRender() {
  await nextTick()
  renderEgo()
}

watch(
  [
    () => props.graph,
    () => props.index,
    centerId,
    depth,
    nodeLimit,
    relationshipFilter,
  ],
  () => {
    scheduleRender()
  },
  { flush: 'post' },
)


watch(highlightGenre, () => {
  applyHighlight()
})

const debouncedScheduleRender = debounce(scheduleRender, 200)

onMounted(() => {
  scheduleRender()
  window.addEventListener('resize', debouncedScheduleRender)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', debouncedScheduleRender)
  simulation?.stop()
})
</script>

<template>
  <section class="space-y-4">

    <!-- HEADER -->
    <div class="flex flex-wrap items-start justify-between gap-3">

      <div>
        <div class="flex items-center gap-2">
          <h3 class="text-sm font-semibold text-slate-900">{{ centerNode?.label ?? 'Ego Network' }} network</h3>

          <div class="group relative shrink-0">
            <button
              type="button"
              class="flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 bg-white text-[10px] font-semibold text-slate-600"
              aria-label="About the ego network"
            >
              ?
            </button>

            <div class="pointer-events-none absolute left-0 top-6 z-30 hidden w-80 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs leading-5 text-white shadow-xl group-hover:block group-focus-within:block">
              <strong>How does it work?</strong><br />
              <p>The ego network is a local view of the network centered on the selected entity, called the “ego”. The other nodes are called “alters”. The center represents the ego, while the surrounding rings show how far each alter is from it: 1 hop means a direct connection, while 2 or 3 hops indicate that the node is reached through one or more intermediate nodes. </br>
                <br />  
                Use the graph to explore the local structure: hover over a node to see its details and highlight its connections, and click an alter to make it the new center and explore its neighborhood. The <strong>Depth</strong> and <strong>Max alters</strong> controls let you adjust how much of the surrounding network is displayed.
                <br />
                The <strong>Insights</strong> below summarize the most relevant patterns in the current view: the <strong>Most connected</strong> section highlights alters with the highest degree, <strong>Genres in view</strong> shows the main genres represented among the visible alters, and <strong>Direct vs indirect</strong> distinguishes directly connected nodes from those reached through intermediaries and summarizes the types of direct relationships. These insights update as you change the view or navigate to a different node.
              </p>
            </div>
          </div>
        </div>

        <p class="mt-1 text-xs text-slate-500">
          A local view of the selected entity (ego) and its surrounding alter egos, with nodes organized by shortest path distance in hops. The view supports local connectivity analysis, highlighting direct and indirect relationships, node degree, relationship types, and highly connected alters. Click on one of the other nodes to have its ego newtork with the possibility of returning to the initial artist or if it is an artist set that as the new selected artist.
        </p>
      </div>

      <!-- ZOOM CONTROLS -->
      <div class="flex items-center gap-1.5 ml-auto">
        <button
          type="button"
          class="flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 bg-white text-sm text-slate-600 hover:bg-slate-50"
          aria-label="Zoom in"
          @click="zoomBy(1.4)"
        >
          +
        </button>

        <button
          type="button"
          class="flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 bg-white text-sm text-slate-600 hover:bg-slate-50"
          aria-label="Zoom out"
          @click="zoomBy(0.7)"
        >
          −
        </button>

        <button
          type="button"
          class="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          @click="resetZoom"
        >
          Reset view
        </button>
      </div>
    </div>


    <!-- STATO FILTRI ATTIVI -->
    <div
      v-if="relationshipFilter || highlightGenre || props.filters?.songId || props.filters?.albumId"
      class="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500"
    >
      <span class="font-medium text-slate-600"> Active from filters: </span>

      <span
        v-if="props.filters?.songId || props.filters?.albumId"
        class="rounded-full border border-slate-300 bg-white px-2 py-0.5"
      >
        Centered on selected work
      </span>

      <span
        v-if="relationshipFilter"
        class="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-blue-700"
      >
        Only "{{ relationshipFilter }}" links
      </span>

      <span
        v-if="highlightGenre"
        class="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700"
      >
        Highlighting "{{ highlightGenre }}"
      </span>
    </div>

    <!-- BACK/SET ARTIST -->
    <div class="flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs">

      <div class="flex flex-wrap items-center gap-1 text-blue-900">
        <template
          v-for="(crumb, position) in breadcrumbs"
          :key="crumb.id"
        >
          <span v-if="position > 0" class="text-blue-400">/</span>

          <button
            type="button"
            class="rounded px-1.5 py-0.5 hover:bg-blue-100"
            :class="position === breadcrumbs.length - 1 ? 'font-semibold' : ''"
            @click="jumpTo(crumb.id)"
          >
            {{ crumb.label }}
          </button>
        </template>
      </div>

      <button
        v-if="isOffArtist"
        type="button"
        class="ml-auto rounded-md border border-blue-300 bg-white px-2 py-1 font-medium text-blue-700 hover:bg-blue-100"
        @click="resetToActiveArtist"
      >
        Back to active artist
      </button>

      <button
        v-if="canSetAsArtist"
        type="button"
        class="rounded-md bg-blue-600 px-2 py-1 font-medium text-white hover:bg-blue-700"
        @click="setAsActiveArtist"
      >
        Set as active artist
      </button>
    </div>


    <!-- FILTRI -->
    <div class="grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">

      <div>
        <p class="text-xs text-slate-600">Depth</p>

        <div class="mt-1 flex gap-1.5">
          <button
            v-for="option in [1, 2, 3]"
            :key="option"
            type="button"
            class="flex-1 rounded-md border px-2 py-1 text-xs font-medium"
            :class="
              depth === option
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100'
            "
            @click="depth = option"
          >
            {{ option }} hop{{ option > 1 ? 's' : '' }}
          </button>
        </div>
      </div>

      <div>
        <div class="flex items-center justify-between text-xs text-slate-600">
          <label>Max alters</label>
          <span class="font-semibold text-slate-900">{{ nodeLimitDraft }}</span>
        </div>

        <input
          v-model.number="nodeLimitDraft"
          type="range"
          min="10"
          max="150"
          step="5"
          class="mt-1 w-full accent-blue-600"
        />
      </div>

    </div>

    <p class="text-xs text-slate-500">
      {{ alterCount.toLocaleString() }} alters ·
      {{ linkCount.toLocaleString() }} links within {{ depth }}
      hop{{ depth > 1 ? 's' : '' }} of
      <strong>{{ centerNode?.label ?? '—' }}</strong>
      <span v-if="relationshipFilter">
        via "{{ relationshipFilter }}" links only
      </span>
    </p>

    <p
      v-if="relationshipFilter && !alterCount"
      class="text-xs text-amber-700"
    >
      No alters are reachable from {{ centerNode?.label ?? 'this node' }} using only "{{ relationshipFilter }}" links. Try a different relationship in the filter panel, or clear it.
    </p>


    <!-- GRAFO -->
    <div
      ref="chartContainer"
      class="relative w-full overflow-hidden rounded-lg border border-slate-200 bg-white"
    />


    <!-- SUMMARY -->
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">

      <!-- MOST CONNECTED -->
      <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p class="text-xs font-semibold uppercase tracking-wider text-slate-500">Most connected</p>

        <p class="mt-0.5 text-[11px] text-slate-400"> By total degree · click to recenter </p>

        <ul class="mt-2 space-y-1">
          <li
            v-for="node in topConnected"
            :key="node.id"
          >
            <button
              type="button"
              class="flex w-full items-center justify-between gap-2 rounded px-1.5 py-1 text-left text-xs text-slate-700 transition hover:bg-slate-100"
              @click="recenter(node.id)"
            >
              <span class="truncate">{{ node.label }}</span>
              <span class="shrink-0 font-semibold text-slate-900">{{ node.degree }}</span>
            </button>
          </li>

          <li
            v-if="!topConnected.length"
            class="px-1.5 py-1 text-xs text-slate-400"
          >
            No alters in view.
          </li>
        </ul>
      </div>

      <!-- GENRES -->
      <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p class="text-xs font-semibold uppercase tracking-wider text-slate-500"> Genres in view </p>

        <p class="mt-0.5 text-[11px] text-slate-400"> Works with a known genre among alters </p>

        <ul class="mt-2 space-y-1">
          <li
            v-for="genre in genreBreakdown"
            :key="genre.label"
            class="flex items-center justify-between gap-2 px-1.5 py-1 text-xs text-slate-700"
          >
            <span class="truncate">{{ genre.label }}</span>
            <span class="shrink-0 font-semibold text-slate-900">{{ genre.value }}</span>
          </li>

          <li
            v-if="!genreBreakdown.length"
            class="px-1.5 py-1 text-xs text-slate-400"
          >
            No genre data in view.
          </li>
        </ul>
      </div>

      <!-- DIRECT VS INDIRECT -->
      <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p class="text-xs font-semibold uppercase tracking-wider text-slate-500"> Direct vs indirect </p>

        <p class="mt-2 text-xs leading-5 text-slate-600">
          <strong class="text-slate-900">{{ directAlterCount }}</strong> direct ·
          <strong class="text-slate-900">{{ indirectAlterCount }}</strong> via intermediaries
        </p>

        <ul class="mt-2 space-y-1 border-t border-slate-200 pt-2">
          <li
            v-for="row in directRelationshipBreakdown"
            :key="row.key"
            class="flex items-center justify-between px-1.5 text-xs text-slate-600"
          >
            <span>{{ row.label }}</span>
            <span class="font-semibold text-slate-900">{{ row.count }}</span>
          </li>

          <li
            v-if="!directRelationshipBreakdown.length"
            class="px-1.5 text-xs text-slate-400"
          >
            No direct relationships.
          </li>
        </ul>

        <p
          v-if="directInfluenceCount"
          class="mt-2 text-[11px] text-blue-700"
        >
          Including {{ directInfluenceCount }}
          direct influence link{{ directInfluenceCount > 1 ? 's' : '' }}.
        </p>
      </div>

    </div>


    <!-- LEGENDA -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">

      <div>
        <p class="text-xs font-semibold uppercase tracking-wider text-slate-500"> Node type </p>

        <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
          <div class="flex items-center gap-1.5 text-xs text-slate-600">
            <span class="h-2.5 w-2.5 rounded-full bg-slate-900" />
            Ego (selected entity)
          </div>

          <div
            v-for="type in typesInView"
            :key="type"
            class="flex items-center gap-1.5 text-xs text-slate-600"
          >
            <span
              class="h-2.5 w-2.5 rounded-full"
              :style="{ backgroundColor: color(type) }"
            />
            {{ type }}
          </div>

          <div
            v-if="highlightGenre"
            class="flex items-center gap-1.5 text-xs text-slate-600"
          >
            <span class="h-2.5 w-2.5 rounded-full border-2 border-amber-500 bg-white" />
            {{ highlightGenre }} (from Genre filter)
          </div>
        </div>
      </div>

      <div>
        <p class="text-xs font-semibold uppercase tracking-wider text-slate-500"> Relationship (line style) </p>

        <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
          <div
            v-for="category in categoriesInView"
            :key="category"
            class="flex items-center gap-1.5 text-xs text-slate-600"
          >
            <svg width="18" height="10">
              <line
                x1="0" y1="5" x2="18" y2="5"
                stroke="#94a3b8"
                stroke-width="1.5"
                :stroke-dasharray="RELATIONSHIP_CATEGORIES[category].dash || null"
              />
            </svg>
            {{ RELATIONSHIP_CATEGORIES[category].label }}
          </div>
        </div>
      </div>

    </div>

  </section>
</template>
