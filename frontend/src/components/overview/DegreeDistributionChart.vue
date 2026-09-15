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
  if (!props.graph?.nodes ||props.artistId === null ||props.artistId === undefined) {
    return null
  }

  return (
    props.graph.nodes.find(
      (node) => String(node.id) === String(props.artistId),
    ) ?? null
  )
})

const degreeData = computed(() => {
  return (props.overview?.degreeDistribution ?? [])
    .map((row) => ({
      label: row.label,
      value: Number(row.value),
    }))
})

const activeArtistDegree = computed(() => {
  const artist = activeArtist.value

  if (!artist ||!props.graph?.links) {
    return 0
  }

  const artistId = String(artist.id)

  let degree = 0

  for (const link of props.graph.links) {
    if (String(link.source) === artistId || String(link.target) === artistId) {
      degree++
    }
  }

  return degree
})

function degreeBelongsToBin(
  degree,
  label,
) {
  if (degree === null || degree === undefined) {
    return false
  }

  const normalized =String(label).replace(  /\s/g, '',)

  if (normalized.includes('-')) {
    const [min, max] =
      normalized
        .split('-')
        .map(Number)

    return (
      degree >= min &&
      degree <= max
    )
  }

  if (normalized.endsWith('+')) {
    const min = Number(
      normalized.replace(
        '+',
        '',
      ),
    )

    return degree >= min
  }

  return (
    degree ===
    Number(normalized)
  )
}

function renderChart() {
  if (!chartContainer.value) return

  const container = chartContainer.value

  d3.select(container)
    .selectAll('*')
    .remove()

  const margin = {
    top: 35,
    right: 25,
    bottom: 55,
    left: 55,
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
    .attr(
      'width',
      '100%',
    )
    .attr(
      'height',
      height,
    )

  const chart = svg
    .append('g')
    .attr(
      'transform',
      `translate(${margin.left}, ${margin.top})`,
    )

  const data = degreeData.value

  const x = d3
    .scaleBand()
    .domain(
      data.map(
        (d) => d.label,
      ),
    )
    .range([
      0,
      innerWidth,
    ])
    .padding(0.18)

  const y = d3
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
      innerHeight,
      0,
    ])

  chart
    .append('g')
    .attr(
      'transform',
      `translate(0, ${innerHeight})`,
    )
    .attr(
      'class',
      'fill-slate-500 text-[10px]',
    )
    .call(
      d3
        .axisBottom(x)
        .tickSize(0)
        .tickPadding(10),
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
    .append('g')
    .attr(
      'class',
      'fill-slate-400 text-[10px]',
    )
    .call(
      d3
        .axisLeft(y)
        .ticks(5)
        .tickFormat(
          d3.format('~s'),
        ),
    )
    .call((g) =>
      g
        .select('.domain')
        .remove(),
    )

  const activeBin =
    data.find((d) =>
      degreeBelongsToBin(
        activeArtistDegree.value,
        d.label,
      ),
    )?.label

  chart
    .selectAll('.degree-bar')
    .data(data)
    .join('rect')
    .attr(
      'class',
      'degree-bar',
    )
    .attr(
      'x',
      (d) => x(d.label),
    )
    .attr(
      'y',
      (d) => y(d.value),
    )
    .attr(
      'width',
      x.bandwidth(),
    )
    .attr(
      'height',
      (d) =>
        innerHeight -
        y(d.value),
    )
    .attr(
      'rx',
      4,
    )
    .attr(
      'fill',
      (d) =>
        d.label === activeBin
          ? '#2563eb'
          : '#cbd5e1',
    )
    .attr(
      'opacity',
      (d) =>
        d.label === activeBin
          ? 1
          : 0.65,
    )

  if ( activeArtist.value && activeBin) {
    const item =
      data.find(
        (d) =>
          d.label ===
          activeBin,
      )

    if (item) {
      const xPosition =
        x(item.label) +
        x.bandwidth() / 2

      const yPosition =
        y(item.value)

      chart
        .append('line')
        .attr(
          'x1',
          xPosition,
        )
        .attr(
          'x2',
          xPosition,
        )
        .attr(
          'y1',
          yPosition - 3,
        )
        .attr(
          'y2',
          yPosition - 25,
        )
        .attr(
          'stroke',
          '#2563eb',
        )
        .attr(
          'stroke-width',
          2,
        )

      chart
        .append('circle')
        .attr(
          'cx',
          xPosition,
        )
        .attr(
          'cy',
          yPosition - 28,
        )
        .attr(
          'r',
          5,
        )
        .attr(
          'fill',
          '#2563eb',
        )

      chart
        .append('text')
        .attr(
          'x',
          xPosition,
        )
        .attr(
          'y',
          yPosition - 38,
        )
        .attr(
          'text-anchor',
          'middle',
        )
        .attr(
          'class',
          'fill-blue-700 text-[10px] font-semibold',
        )
        .text(
          `${activeArtist.value.label}: ${activeArtistDegree.value}`,
        )
    }
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
      <h3 class="text-sm font-semibold text-slate-900"> Degree distribution </h3>

      <div class="group relative shrink-0">
        <button
          type="button"
          class="flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 bg-white text-[10px] font-semibold text-slate-600"
          aria-label="Information about degree distribution"
        >
          ?
        </button>

        <div
          class="pointer-events-none absolute left-1/2 top-6 z-30 hidden w-72 -translate-x-1/2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs leading-5 text-white shadow-xl group-hover:block group-focus-within:block"
        >
          <strong>How connected are the nodes?</strong>
          <br />
          <p> A node's degree is the number of connections it has. The chart shows the degree distribution for all nodes in the graph. The blue bar and dot highlight the selected artist's degree.</p>
        </div>
      </div>
    </div>

    <p class="mt-1 text-xs text-slate-500"> Distribution of node degree across the entire graph.</p>
  </div>

    <div
      ref="chartContainer"
      class="relative w-full overflow-x-auto"
    />
  </div>
</template>
