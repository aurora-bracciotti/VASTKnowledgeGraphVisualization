<script setup>
import {computed, nextTick, onMounted, onBeforeUnmount, ref, watch,} from 'vue'

import * as d3 from 'd3'

import {sankey, sankeyCenter, sankeyLinkHorizontal,} from 'd3-sankey'

const props = defineProps({
  graph: {
    type: Object,
    required: true,
  },
  overview: {
    type: Object,
    required: true,
  },
  artistId: {
    type: [String, Number, null],
    default: null,
  },
  filters: {
    type: Object,
    required: true,
  },
})

const chartContainer = ref(null)

const sankeySource = ref('All')
const sankeyRelationship = ref(props.filters?.relationship || 'All')
const sankeyTarget = ref('All')

const sankeyPatterns = computed(() => {
  return (
    props.overview?.relationshipPatterns?.patterns ??
    []
  )
})

const sankeySourceOptions = computed(() => {
  return [
    'All',
    ...new Set(
      sankeyPatterns.value
        .map(
          (item) =>
            item.sourceType,
        )
        .filter(Boolean),
    ),
  ]
})

const sankeyRelationshipOptions =
  computed(() => {
    const source =
      sankeySource.value

    return [
      'All',
      ...new Set(
        sankeyPatterns.value
          .filter((item) => {
            if (source === 'All') {
              return true
            }

            return (item.sourceType === source)
          })
          .map(
            (item) =>
              item.edgeType,
          )
          .filter(Boolean),
      ),
    ]
  })

const sankeyTargetOptions = computed(() => {
  const source = sankeySource.value

  const relationship = sankeyRelationship.value

  return [
    'All',
    ...new Set(
      sankeyPatterns.value
        .filter((item) => {
          if (source !== 'All' && item.sourceType !== source) {
            return false
          }

          if (relationship !== 'All' && item.edgeType !== relationship) {
            return false
          }

          return true
        })
        .map(
          (item) =>
            item.targetType,
        )
        .filter(Boolean),
    ),
  ]
})

const filteredSankeyPatterns =
  computed(() => {
    return sankeyPatterns.value.filter(
      (item) => {
        if (sankeySource.value !== 'All' && item.sourceType !== sankeySource.value) {
          return false
        }

        if (sankeyRelationship.value !=='All' && item.edgeType !== sankeyRelationship.value) {
          return false
        }

        if (sankeyTarget.value !== 'All' && item.targetType !== sankeyTarget.value) {
          return false
        }

        return true
      },
    )
  })

const sankeyLinkCount = computed(() => {
  return filteredSankeyPatterns.value.reduce(
    (sum, item) =>
      sum +
      Number(
        item.value ?? 0,
      ),
    0,
  )
})

const sankeyPatternBreakdown =
  computed(() => {
    return [
      ...filteredSankeyPatterns.value,
    ].sort(
      (a, b) =>
        Number(b.value ?? 0) -
        Number(a.value ?? 0),
    )
  })

function formatNumber(value) {
  return Number(value).toLocaleString()
}

function renderChart() {
  if (!chartContainer.value) {
    return
  }

  const container = chartContainer.value

  d3.select(container)
    .selectAll('*')
    .remove()

  const patterns = filteredSankeyPatterns.value

  if (!patterns.length) {
    d3.select(container)
      .append('div')
      .attr(
        'class',
        'flex h-full min-h-[320px] items-center justify-center text-sm text-slate-500',
      )
      .text(
        'No relationships match the selected filters.',
      )

    return
  }

  const sourceNodes = new Map()
  const relationshipNodes = new Map()
  const targetNodes = new Map()

  const rawLinks = []

  patterns.forEach((item) => {
    const source = item.sourceType ?? 'Unknown'

    const relationship = item.edgeType ?? 'Unknown'

    const target = item.targetType ?? 'Unknown'

    const value = Number( item.value ?? 0,)

    if (!value || value <= 0) {
      return
    }

    const sourceId = `source:${source}`

    const relationshipId = `relationship:${relationship}`

    const targetId = `target:${target}`

    if (!sourceNodes.has(sourceId,)) {
      sourceNodes.set(
        sourceId,
        {
          id: sourceId,
          label: source,
          group: 'source',
        },
      )
    }

    if (!relationshipNodes.has(relationshipId,)) {
      relationshipNodes.set(
        relationshipId,
        {
          id: relationshipId,
          label: relationship,
          group: 'relationship',
        },
      )
    }

    if (!targetNodes.has(targetId,)) {
      targetNodes.set(
        targetId,
        {
          id: targetId,
          label: target,
          group: 'target',
        },
      )
    }

    rawLinks.push({
      source: sourceId,
      target: relationshipId,
      value,
      relationship,
    })

    rawLinks.push({
      source: relationshipId,
      target: targetId,
      value,
      relationship,
    })
  })

  const linkMap = new Map()

  rawLinks.forEach((link) => {
    const key = `${link.source}|${link.target}`

    const existing =linkMap.get(key)

    if (existing) {
      existing.value += link.value
    } else {
      linkMap.set(key, {
        source: link.source,
        target: link.target,
        value: link.value,
        relationship:
          link.relationship,
      })
    }
  })

  const links = Array.from(linkMap.values(),)

  const nodes = [
    ...sourceNodes.values(),
    ...relationshipNodes.values(),
    ...targetNodes.values(),
  ]

  const width = container.clientWidth

  if (!width) {
    // Il contenitore non ha ancora una larghezza misurabile (es. primo istante dopo il mount): il ResizeObserver richiamerà renderChart non appena sarà disponibile
    return
  }

  const margin = {
    top: 45,
    right: 150,
    bottom: 30,
    left: 150,
  }

  const NODE_ROW_HEIGHT = 46

  const maxNodesInColumn =
    Math.max(
      sourceNodes.size,
      relationshipNodes.size,
      targetNodes.size,
    )

  const height = Math.max(
    420,
    margin.top +
      margin.bottom +
      maxNodesInColumn *
        NODE_ROW_HEIGHT,
  )

  const svg = d3
    .select(container)
    .append('svg')
    .attr(
      'viewBox',
      `0 0 ${width} ${height}`,
    )
    .attr(
      'width',
      '100%',
    )
    .attr(
      'height',
      height,
    )
    .style(
      'display',
      'block',
    )
    .attr(
      'preserveAspectRatio',
      'xMidYMid meet',
    )

  const colorScale =
    d3.scaleOrdinal(
      d3.schemeTableau10,
    )

  const nodeColor = (node) => {
    if (node.group === 'relationship') {
      return colorScale(
        `relationship:${node.label}`,
      )
    }

    return colorScale(
      `${node.group}:${node.label}`,
    )
  }

  const layout = sankey()
    .nodeId(
      (d) => d.id,
    )
    .nodeWidth(18)
    .nodePadding(22)
    .nodeAlign(sankeyCenter)
    .extent([
      [
        margin.left,
        margin.top,
      ],
      [
        width - margin.right,
        height - margin.bottom,
      ],
    ])

  const data = layout({
    nodes: nodes.map(
      (node) => ({
        ...node,
      }),
    ),

    links: links.map(
      (link) => ({
        ...link,
      }),
    ),
  })

  const linkGroup = svg
    .append('g')
    .attr(
      'fill',
      'none',
    )

  const link = linkGroup
    .selectAll('path')
    .data(data.links)
    .join('path')
    .attr(
      'd',
      sankeyLinkHorizontal(),
    )
    .attr(
      'stroke',
      (d) =>
        nodeColor(
          d.source,
        ),
    )
    .attr(
      'stroke-opacity',
      0.35,
    )
    .attr(
      'stroke-width',
      (d) =>
        Math.max(
          1,
          d.width,
        ),
    )
    .style(
      'cursor',
      'pointer',
    )

  const tooltip = d3
    .select(container)
    .append('div')
    .attr(
      'class',
      'pointer-events-none absolute z-50 hidden rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg',
    )

  link
    .on(
      'mouseenter',
      function (event, d) {
        d3.select(this)
          .attr(
            'stroke-opacity',
            0.8,
          )

        tooltip
          .style(
            'display',
            'block',
          )
          .html(`
            <div class="font-semibold">
              ${d.source.label}
              → ${d.target.label}
            </div>

            <div class="mt-1 text-slate-500">
              ${d3.format(',')(d.value)} links
            </div>
          `)
      },
    )
    .on(
      'mousemove',
      function (event) {
        const [
          x,
          y,
        ] = d3.pointer(
          event,
          container,
        )

        tooltip
          .style(
            'left',
            `${x + 14}px`,
          )
          .style(
            'top',
            `${y + 14}px`,
          )
      },
    )
    .on(
      'mouseleave',
      function () {
        d3.select(this)
          .attr(
            'stroke-opacity',
            0.35,
          )

        tooltip.style(
          'display',
          'none',
        )
      },
    )

  const node = svg
    .append('g')
    .selectAll('g')
    .data(data.nodes)
    .join('g')

  node
    .append('rect')
    .attr(
      'x',
      (d) => d.x0,
    )
    .attr(
      'y',
      (d) => d.y0,
    )
    .attr(
      'width',
      (d) => d.x1 - d.x0,
    )
    .attr(
      'height',
      (d) => Math.max(
                6,
                d.y1 - d.y0,
              ),
    )
    .attr(
      'rx',
      4,
    )
    .attr(
      'fill',
      nodeColor,
    )

  node
    .append('text')
    .attr(
      'x',
      (d) => d.x0 < width / 2 ? d.x1 + 8 : d.x0 - 8,
    )
    .attr(
      'y',
      (d) => (d.y0 + d.y1) / 2,
    )
    .attr(
      'dy',
      '-0.1em',
    )
    .attr(
      'text-anchor',
      (d) => d.x0 < width / 2 ? 'start' : 'end',
    )
    .attr(
      'class',
      'fill-slate-700 text-[10px] font-medium',
    )
    .text(
      (d) => d.label,
    )

  node
    .append('text')
    .attr(
      'x',
      (d) => d.x0 < width / 2 ? d.x1 + 8 : d.x0 - 8,
    )
    .attr(
      'y',
      (d) => (d.y0 + d.y1) / 2,
    )
    .attr(
      'dy',
      '1.05em',
    )
    .attr(
      'text-anchor',
      (d) => d.x0 < width / 2 ? 'start' : 'end',
    )
    .attr(
      'class',
      'fill-slate-500 text-[9px]',
    )
    .text(
      (d) => `${d3.format(',')(d.value)} links`,
    )

  svg
    .append('text')
    .attr(
      'x',
      margin.left,
    )
    .attr(
      'y',
      20,
    )
    .attr(
      'class',
      'fill-slate-500 text-[10px] font-semibold uppercase tracking-wider',
    )
    .text('Source')

  svg
    .append('text')
    .attr(
      'x',
      width / 2,
    )
    .attr(
      'y',
      20,
    )
    .attr(
      'text-anchor',
      'middle',
    )
    .attr(
      'class',
      'fill-slate-500 text-[10px] font-semibold uppercase tracking-wider',
    )
    .text('Relationship')

  svg
    .append('text')
    .attr(
      'x',
      width - margin.right,
    )
    .attr(
      'y',
      20,
    )
    .attr(
      'text-anchor',
      'end',
    )
    .attr(
      'class',
      'fill-slate-500 text-[10px] font-semibold uppercase tracking-wider',
    )
    .text('Target')
}

async function render() {
  await nextTick()
  renderChart()
}

watch(
  [
    () => props.graph,
    () => props.overview,
  ],
  () => {
    scheduleRender()
  },
  {
    flush: 'post',
  },
)

// Se il filtro "Relationship" è presente pre-selezioniamo lo stesso valore qui. L'utente resta comunque libero di cambiarlo.
watch(
  () => props.filters?.relationship,
  (value) => {
    const nextValue = value || 'All'

    if (sankeyRelationshipOptions.value.includes(nextValue)) {
      sankeyRelationship.value = nextValue
    } else if (!value) {
      sankeyRelationship.value = 'All'
    }
  },
)

watch(
  sankeySource,
  () => {
    if (!sankeyRelationshipOptions.value.includes( sankeyRelationship.value,)) {
      sankeyRelationship.value =  'All'
    }

    if (!sankeyTargetOptions.value.includes(sankeyTarget.value,)) {
      sankeyTarget.value ='All'
    }

    scheduleRender()
  },
)

watch(
  sankeyRelationship,
  () => {
    if (!sankeyTargetOptions.value.includes(sankeyTarget.value,)) {
      sankeyTarget.value ='All'
    }

    scheduleRender()
  },
)

watch(
  sankeyTarget,
  () => {
    scheduleRender()
  },
)

let resizeObserver = null
let scheduledRender = null

function scheduleRender() {
  if (scheduledRender !== null) {
    cancelAnimationFrame(scheduledRender)
  }

  scheduledRender = requestAnimationFrame(() => {
    scheduledRender = null
    render()
  })
}

onMounted(() => {
  scheduleRender()

  // Un ResizeObserver si attiva ogni volta che le dimensioni del contenitore cambiano 
  resizeObserver = new ResizeObserver(() => {
    scheduleRender()
  })

  resizeObserver.observe(chartContainer.value)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
})
</script>

<template>
  <div class="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2">
    <div class="mb-3">
      <div class="flex items-center gap-2">
        <h3 class="text-sm font-semibold text-slate-900"> Sankey Diagram - Relationship Flow</h3>
        <div class="group relative shrink-0">
          <button
            type="button"
            class="flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 bg-white text-[10px] font-semibold text-slate-600"
            aria-label="Information about relationship types"
          >
            ?
          </button>

          <div
            class="pointer-events-none absolute left-1/2 top-6 z-30 hidden w-72 -translate-x-1/2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs leading-5 text-white shadow-xl group-hover:block group-focus-within:block"
          >
            <strong>Which patterns dominate?</strong>
            <br />
            <p> The Sankey diagram is a type of flow diagram in which the width of the bands is drawn proportional to the amount of flow represented. Hovering over a band reveals the type of relationship and number of links. </p>
          </div>
        </div>
      </div>

      <p class="mt-1 text-xs text-slate-500"> Explore how different entity types are connected. Select a source, relationship, and destination to narrow your view and see only the connections you're interested in.</p>
    </div>

    <!-- FILTERS -->
    <div class="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
      
      <!-- SOURCE -->
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-slate-600"> Source </span>

        <select
          v-model="sankeySource"
          class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        >
          <option
            v-for="option in sankeySourceOptions"
            :key="option"
            :value="option"
          >
            {{ option }}
          </option>
        </select>
      </label>

      <!-- RELATIONSHIP -->
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-slate-600"> Relationship </span>

        <select
          v-model="sankeyRelationship"
          class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        >
          <option
            v-for="option in sankeyRelationshipOptions"
            :key="option"
            :value="option"
          >
            {{ option }}
          </option>
        </select>

        <p
          v-if="filters?.relationship && sankeyRelationship === filters.relationship"
          class="mt-1 text-[10px] text-blue-600"
        >
          Pre-filled from your Relationship filter — change it here anytime.
        </p>
      </label>

      <!-- TARGET -->
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-slate-600"> Target</span>

        <select
          v-model="sankeyTarget"
          class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        >
          <option
            v-for="option in sankeyTargetOptions"
            :key="option"
            :value="option"
          >
            {{ option }}
          </option>
        </select>
      </label>
    </div>

    <!-- SANKEY -->
    <div
      ref="chartContainer"
      class="relative w-full min-h-[420px] overflow-x-auto"
    />

    <!-- CURRENT SELECTION -->
    <div class="mt-4 border-t border-slate-200 pt-4">
      <p class="text-xs font-semibold uppercase tracking-wider text-slate-500"> Selected relationship </p>

      <div class="mt-2 flex flex-wrap items-center gap-2 text-sm">
        <span class="font-semibold text-slate-900">
          {{ sankeySource }}
        </span>

        <span class="text-slate-400"> → </span>

        <span class="font-semibold text-slate-900">
          {{ sankeyRelationship }}
        </span>

        <span class="text-slate-400"> → </span>

        <span class="font-semibold text-slate-900">
          {{ sankeyTarget }}
        </span>
      </div>

      <p class="mt-2 text-sm text-slate-600">
        {{ formatNumber(sankeyLinkCount) }}
        {{
          sankeyLinkCount === 1 ? 'link' : 'links'
        }}
      </p>
    </div>

    <!-- PATTERN BREAKDOWN -->
    <div class="mt-4 border-t border-slate-200 pt-4">
      <p class="text-xs font-semibold uppercase tracking-wider text-slate-500"> Relationship combinations</p>

      <ul class="mt-2 max-h-64 space-y-1 overflow-y-auto text-sm">
        <li
          v-for="pattern in sankeyPatternBreakdown"
          :key="pattern.key"
          class="flex items-center justify-between gap-3 rounded-md px-2 py-1 odd:bg-slate-50"
        >
          <span class="flex flex-wrap items-center gap-1 text-slate-700">
            <span class="font-medium text-slate-900">
              {{ pattern.sourceType }}
            </span>

            <span class="text-slate-400"> → </span>

            <span>
              {{ pattern.edgeType }}
            </span>

            <span class="text-slate-400"> → </span>

            <span class="font-medium text-slate-900">
              {{ pattern.targetType }}
            </span>
          </span>

          <span class="shrink-0 text-xs font-semibold text-slate-600">
            {{ formatNumber(pattern.value) }}
            {{
              pattern.value === 1 ? 'link': 'links'
            }}
          </span>
        </li>

        <li
          v-if="!sankeyPatternBreakdown.length"
          class="px-2 py-1 text-slate-500"
        >
          No combinations match the selected filters.
        </li>
      </ul>
    </div>
  </div>
</template>
