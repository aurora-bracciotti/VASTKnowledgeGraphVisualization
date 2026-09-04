<script setup>
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import * as d3 from 'd3'

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
})

const chartContainer = ref(null)

const activeArtist = computed(() => {
  if (!props.graph?.nodes || props.artistId === null || props.artistId === undefined) {
    return null
  }

  return (
    props.graph.nodes.find(
      (node) => String(node.id) === String(props.artistId),
    ) ?? null
  )
})

const relationshipData = computed(() => {
  return (props.overview?.edgeTypes ?? [])
    .filter((row) => Number(row.value) > 0)
    .map((row) => ({
      label: row.label,
      value: Number(row.value),
    }))
})

const activeArtistRelationships = computed(() => {
  const artist = activeArtist.value

  if (!artist ||!props.graph?.links) {
    return new Set()
  }

  const artistId = String(artist.id)
  const relationships = new Set()

  for (const link of props.graph.links) {
    if (
      String(link.source) === artistId ||
      String(link.target) === artistId
    ) {
      if (link.edgeType && link.edgeType !== 'Unknown') {
        relationships.add(link.edgeType)
      }
    }
  }

  return relationships
})

function formatNumber(value) {
  return Number(value).toLocaleString()
}

function renderChart() {
  if (!chartContainer.value) return

  const container = chartContainer.value

  d3.select(container)
    .selectAll('*')
    .remove()

  const margin = {
    top: 15,
    right: 65,
    bottom: 45,
    left: 105,
  }

  const width = 720
  const height = 340

  const innerWidth = width - margin.left - margin.right

  const innerHeight = height - margin.top - margin.bottom

  const svg = d3
    .select(container)
    .append('svg')
    .attr(
      'viewBox',
      `0 0 ${width} ${height}`,
    )
    .attr('width', '100%')
    .attr('height', height)

  const chart = svg
    .append('g')
    .attr(
      'transform',
      `translate(${margin.left}, ${margin.top})`,
    )

  const data =
    [...relationshipData.value]
      .sort(
        (a, b) =>
          b.value - a.value,
      )

  const x = d3
    .scaleLinear()
    .domain([
      0,
      d3.max(
        data,
        (d) => d.value,
      ) || 1,
    ])
    .nice()
    .range([
      0,
      innerWidth,
    ])

  const y = d3
    .scaleBand()
    .domain(
      data.map(
        (d) => d.label,
      ),
    )
    .range([
      0,
      innerHeight,
    ])
    .padding(0.25)

  chart
    .append('g')
    .attr(
      'class',
      'fill-slate-500 text-[10px]',
    )
    .call(
      d3
        .axisLeft(y)
        .tickSize(0)
        .tickPadding(8),
    )
    .call((g) =>
      g
        .select('.domain')
        .remove(),
    )

  chart
    .append('g')
    .attr(
      'transform',
      `translate(0, ${innerHeight})`,
    )
    .attr(
      'class',
      'fill-slate-400 text-[10px]',
    )
    .call(
      d3
        .axisBottom(x)
        .ticks(5)
        .tickFormat(
          d3.format('~s'),
        ),
    )
    .call((g) =>
      g
        .select('.domain')
        .attr(
          'stroke',
          '#cbd5e1',
        ),
    )

  chart
    .selectAll('.bar')
    .data(data)
    .join('rect')
    .attr('class', 'bar')
    .attr('x', 0)
    .attr(
      'y',
      (d) => y(d.label),
    )
    .attr(
      'width',
      (d) => x(d.value),
    )
    .attr(
      'height',
      y.bandwidth(),
    )
    .attr('rx', 4)
    .attr(
      'fill',
      (d) =>
        activeArtistRelationships.value.has(
          d.label,
        )
          ? '#2563eb'
          : '#cbd5e1',
    )
    .attr('opacity', (d) => {
      if (!activeArtist.value) return 1

      return activeArtistRelationships.value.has(
        d.label,
      )
        ? 1
        : 0.65
    })

  chart
    .selectAll('.bar-value')
    .data(data)
    .join('text')
    .attr(
      'x',
      (d) => x(d.value) + 10,
    )
    .attr(
      'y',
      (d) =>
        y(d.label) +
        y.bandwidth() / 2,
    )
    .attr(
      'dy',
      '0.35em',
    )
    .attr(
      'class',
      (d) =>
        activeArtistRelationships.value.has(
          d.label,
        )
          ? 'fill-blue-700 text-[10px] font-semibold'
          : 'fill-slate-500 text-[10px]',
    )
    .text(
      (d) =>
        formatNumber(
          d.value,
        ),
    )

  if (activeArtist.value && activeArtistRelationships.value.size
  ) {
    const activeLabels =
      data.filter(
        (d) =>
          activeArtistRelationships.value.has(
            d.label,
          ),
      )

    chart
      .selectAll('.active-marker')
      .data(activeLabels)
      .join('circle')
      .attr(
        'class',
        'active-marker',
      )
      .attr(
        'cx',
        (d) =>
          x(d.value) + 48,
      )
      .attr(
        'cy',
        (d) =>
          y(d.label) +
          y.bandwidth() / 2,
      )
      .attr('r', 5)
      .attr(
        'fill',
        '#1d4ed8',
      )
  }
}

async function render() {
  await nextTick()
  renderChart()
}

watch(
  [
    () => props.graph,
    () => props.overview,
    () => props.artistId,
  ],
  render,
  {
    flush: 'post',
  },
)

onMounted(() => {
  render()

  window.addEventListener(
    'resize',
    render,
  )
})

onBeforeUnmount(() => {
  window.removeEventListener(
    'resize',
    render,
  )
})
</script>

<template>
  <div class="rounded-xl border border-slate-200 bg-white p-5">
    <div class="mb-3">
      <div class="flex items-center gap-2">
        <h3 class="text-sm font-semibold text-slate-900"> Relationship types </h3>
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
            <strong>Which relationships are connected to this artist?</strong>
            <br />
            <p> Bars show the frequency of each relationship type across the entire graph. Blue bars marked with a dot indicate relationships associated with the selected artist. </p>
          </div>
      </div>
    </div>

    <p class="mt-1 text-xs text-slate-500"> Distribution of relationship types across the entire graph.</p>
  </div>
  
    <div
      ref="chartContainer"
      class="relative w-full overflow-x-auto"
    />
  </div>
</template>
