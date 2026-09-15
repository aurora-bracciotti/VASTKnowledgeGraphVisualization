<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as d3 from 'd3'

import { buildNodeLinkSubgraph } from '../../data/metrics.js'
import { isArtist } from '../../data/graphTransforms.js'
import { relationshipDash, RELATIONSHIP_CATEGORY_ORDER, RELATIONSHIP_CATEGORIES } from '../../data/relationship.js'

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
})

const emit = defineEmits(['select-artist',])

const chartContainer = ref(null)

// --- HELPER: debounce ---
// Evita di ricalcolare/ridisegnare il grafo ad ogni singolo evento (drag di uno slider, resize della finestra): aspetta che l'utente si fermi per `delay` ms prima di eseguire davvero `fn`
function debounce(fn, delay = 150) {
  let timeoutId = null
  return (...args) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}

// --- CONTROLLI UTENTE ---
// I ref "Draft" sono legati direttamente agli slider e si aggiornano ad ogni pixel trascinato 
// I ref "committati" (nodeLimit, minDegree) sono quelli che davvero entrano nel subgraph/render pesante: sono aggiornati con debounce 
const nodeLimitDraft = ref(60)
const nodeLimit = ref(60)
const minDegreeDraft = ref(1)
const minDegree = ref(1)
const isSimulating = ref(false)

const commitNodeLimit = debounce((value) => { nodeLimit.value = value }, 150)
const commitMinDegree = debounce((value) => { minDegree.value = value }, 150)
watch(nodeLimitDraft, (value) => commitNodeLimit(value))
watch(minDegreeDraft, (value) => commitMinDegree(value))

let simulation = null
let zoomBehavior = null
let svgSelection = null

// ---SOTTOGRAFO ---
const subgraph = computed(() => {
  if (!props.graph) {
    return {
      nodes: [],
      links: [],
      totalNodes: 0,
      totalLinks: 0,
      matchingNodes: 0,
      graphMaxDegree: 0,
    }
  }

  return buildNodeLinkSubgraph(
    props.graph,
    nodeLimit.value,
    { min: minDegree.value },
    props.index?.degreeById ?? null,
  )
})

const graphMaxDegree = computed(() => subgraph.value.graphMaxDegree ?? 0)

// Nodi effettivamente mostrati vs nodi totali del grafo
const shownCount = computed(() => subgraph.value.nodes.length)
const shownLinkCount = computed(() => subgraph.value.links.length)

// Tipi di nodo presenti nella vista corrente (per la legenda)
const typesInView = computed(() => {
  return [...new Set(subgraph.value.nodes.map((node) => node.nodeType))].sort()
})

// Stesso colore indipendente dal cambio artista
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

// Categorie di relazione 
const categoriesInView = computed(() => {
  return RELATIONSHIP_CATEGORY_ORDER.filter((key) =>
    subgraph.value.links.some((link) => relationshipCategoryOf(link) === key),
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

function radiusScale(degree) {
  const scale = d3
    .scaleSqrt()
    .domain([0, Math.max(1, graphMaxDegree.value)])
    .range([4, 17])
    .clamp(true)

  return scale(degree ?? 0)
}

// --- RENDER ---

function dragBehavior(activeSimulation) {
  function started(event, d) {
    if (!event.active) activeSimulation.alphaTarget(0.25).restart()
    d.fx = d.x
    d.fy = d.y
  }

  function dragged(event, d) {
    d.fx = event.x
    d.fy = event.y
  }

  function ended(event, d) {
    if (!event.active) activeSimulation.alphaTarget(0)
    d.fx = null
    d.fy = null
  }

  return d3.drag().on('start', started).on('drag', dragged).on('end', ended)
}

function renderGraph() {
  if (!chartContainer.value) return

  const container = chartContainer.value
  d3.select(container).selectAll('*').remove()

  if (simulation) {
    simulation.stop()
    simulation = null
  }

  const { nodes: rawNodes, links: rawLinks } = subgraph.value

  const width = container.clientWidth || 800
  const height = 560

  if (!rawNodes.length) {
    d3.select(container)
      .append('div')
      .attr(
        'class',
        'flex h-[420px] items-center justify-center text-sm text-slate-400',
      )
      .text('No nodes match the current filters.')
    return
  }

  // Cloniamo nodi e link
  const simNodes = rawNodes.map((node) => ({ ...node }))
  const nodeById = new Map(simNodes.map((node) => [node.id, node]))
  const simLinks = rawLinks
    .map((link) => ({
      ...link,
      source: nodeById.get(link.source),
      target: nodeById.get(link.target),
    }))
    .filter((link) => link.source && link.target)

  // Etichette permanenti solo per i nodi più rilevanti
  const degreeSorted = [...simNodes].sort((a, b) => b.degree - a.degree)
  const labelIds = new Set(
    degreeSorted.slice(0, 12).map((node) => node.id),
  )
  if (props.artistId !== null && props.artistId !== undefined) {
    labelIds.add(String(props.artistId))
  }

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
    .scaleExtent([0.2, 6])
    .on('zoom', (event) => {
      zoomLayer.attr('transform', event.transform)
    })

  svg.call(zoomBehavior)

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
    .attr('opacity', 0.5)

  const nodeSelection = zoomLayer
    .append('g')
    .selectAll('circle')
    .data(simNodes)
    .join('circle')
    .attr('r', (d) => radiusScale(d.degree))
    .attr('fill', (d) => color.value(d.nodeType))
    .attr('stroke', (d) =>
      String(d.id) === String(props.artistId) ? '#0f172a' : 'white',
    )
    .attr('stroke-width', (d) =>
      String(d.id) === String(props.artistId) ? 3 : 1.2,
    )
    .style('cursor', 'pointer')
    .call(dragBehavior(null))

  const labelSelection = zoomLayer
    .append('g')
    .selectAll('text')
    .data(simNodes.filter((d) => labelIds.has(d.id)))
    .join('text')
    .attr('class', 'fill-slate-700 text-[9px] font-medium')
    .attr('text-anchor', 'middle')
    .style('pointer-events', 'none')
    .text((d) => d.label)

  // Adiacenza locale (solo vista corrente) per l'highlight on hover
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
         degree ${d.degree}`,
      )
    })
    .on('mousemove', (event) => {
      const rect = container.getBoundingClientRect()
      tooltip
        .style('left', `${event.clientX - rect.left + 12}px`)
        .style('top', `${event.clientY - rect.top + 12}px`)
    })
    .on('mouseleave', () => {
      nodeSelection.attr('opacity', 1)
      linkSelection.attr('opacity', 0.5)
      labelSelection.attr('opacity', 1)
      tooltip.style('opacity', 0)
    })
    .on('click', (event, d) => {
      if (isArtist(d)) {
        emit('select-artist', d.id)
      }
    })

  simulation = d3
    .forceSimulation(simNodes)
    .force(
      'link',
      d3
        .forceLink(simLinks)
        .distance(46)
        .strength(0.35),
    )
    .force('charge', d3.forceManyBody().strength(-130))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force(
      'collide',
      d3.forceCollide().radius((d) => radiusScale(d.degree) + 3),
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
        .attr('y', (d) => d.y - radiusScale(d.degree) - 4)
    })

  nodeSelection.call(dragBehavior(simulation))

  isSimulating.value = true
  simulation.on('end', () => {
    isSimulating.value = false
  })
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
  renderGraph()
}

watch(
  [() => props.graph, () => props.index, () => props.artistId, nodeLimit, minDegree],
  () => {
    scheduleRender()
  },
  { flush: 'post' },
)

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
          <h3 class="text-sm font-semibold text-slate-900"> Node-Link Diagram </h3>

          <div class="group relative shrink-0">
            <button
              type="button"
              class="flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 bg-white text-[10px] font-semibold text-slate-600"
              aria-label="About the node-link diagram"
            >
              ?
            </button>

            <div class="pointer-events-none absolute left-0 top-6 z-30 hidden w-80 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs leading-5 text-white shadow-xl group-hover:block group-focus-within:block">
              <p class="mb-2"> 
                <strong>How does it work?</strong><br />
                Each circle represents an entity, and each line represents a relationship between two entities. Colors indicate entity types, while larger circles represent entities with more connections.</p>

              <p class="mb-2"> This is a <strong>simplified view of the full knowledge graph</strong>. To keep the diagram readable, only a limited number of nodes and their connections are displayed. A node may therefore have fewer visible connections than its total number of connections in the full graph.</p>

              <p class="mb-2">
                <strong>Interactions:</strong><br />
                • Hover over a node to highlight its connected entities.<br />
                • Drag nodes to explore the graph.<br />
                • Zoom and pan to navigate the diagram.<br />
                • Click an artist to select them and explore their individual
                network in the other panel.
              </p>

              <p class="mb-2">
                <strong>Filters:</strong><br />
                • <strong>Maximum nodes</strong> shown limits the number of nodes
                displayed.<br />
                • <strong>Minimum connections</strong> hides nodes with fewer
                connections than the selected value.
              </p>

              <p>
                <strong>Reset view</strong> returns the diagram to its original
                zoom and position.
              </p>
            </div>
          </div>
        </div>

        <p class="mt-1 text-xs text-slate-500"> Simplified overview of the entire knowledge graph. Explore how entities are connected and click an artist node to make it the active artist. </p>
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


    <!-- FILTRI -->
    <div class="grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">

      <div>
        <div class="flex items-center justify-between text-xs text-slate-600">
          <label>Nodes to show</label>
          <span class="font-semibold text-slate-900">{{ nodeLimitDraft }}</span>
        </div>

        <input
          v-model.number="nodeLimitDraft"
          type="range"
          min="20"
          max="300"
          step="10"
          class="mt-1 w-full accent-blue-600"
        />
      </div>

      <div>
        <div class="flex items-center justify-between text-xs text-slate-600">
          <label>Minimum connections</label>
          <span class="font-semibold text-slate-900">{{ minDegreeDraft }}</span>
        </div>

        <input
          v-model.number="minDegreeDraft"
          type="range"
          min="0"
          :max="Math.max(1, graphMaxDegree)"
          step="1"
          class="mt-1 w-full accent-blue-600"
        />
      </div>

    </div>

    <p class="text-xs text-slate-500">
      Showing {{ shownCount.toLocaleString() }} nodes ·
      {{ shownLinkCount.toLocaleString() }} links
      (out of {{ subgraph.matchingNodes?.toLocaleString() ?? 0 }} matching
      the degree filter, {{ subgraph.totalNodes?.toLocaleString() ?? 0 }} total)
    </p>

    <!-- GRAFO -->
    <div
      ref="chartContainer"
      class="relative w-full overflow-hidden rounded-lg border border-slate-200 bg-white"
    />

    <!-- LEGENDA -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">

      <div>
        <p class="text-xs font-semibold uppercase tracking-wider text-slate-500"> Node type </p>

        <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
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
        </div>
      </div>

      <div>
        <p class="text-xs font-semibold uppercase tracking-wider text-slate-500"> Relationship (line style)</p>

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
