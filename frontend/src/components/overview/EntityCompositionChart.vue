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

// Artista attivo
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

const entityData = computed(() => {
  return (props.overview?.nodeTypes ?? [])
    .filter((row) => Number(row.value) > 0)
    .map((row) => ({
      label: row.label,
      value: Number(row.value),
    }))
})

function formatNumber(value) {
  return Number(value).toLocaleString()
}

function percentage(value, total) {
  if (!total) return '0%'

  return `${((value / total) * 100).toFixed(1)}%`
}

function renderChart() {
  if (!chartContainer.value) return

  const container = chartContainer.value

  d3.select(container)
    .selectAll('*')
    .remove()

  const width = 620
  const height = 300
  const radius = 105

  const svg = d3
    .select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('width', '100%')
    .attr('height', height)

  const chart = svg
    .append('g')
    .attr(
      'transform',
      `translate(185, ${height / 2})`,
    )

  const total = d3.sum(
    entityData.value,
    (d) => d.value,
  )

  const pie = d3
    .pie()
    .sort(null)
    .value((d) => d.value)

  const arc = d3
    .arc()
    .innerRadius(radius * 0.55)
    .outerRadius(radius)

  const activeType =
    activeArtist.value?.nodeType ?? null

  const color = d3
    .scaleOrdinal()
    .domain(entityData.value.map((d) => d.label))
    .range(d3.schemeTableau10)

  chart
    .selectAll('path')
    .data(pie(entityData.value))
    .join('path')
    .attr('d', arc)
    .attr('fill', (d) => color(d.data.label))
    .attr(
      'stroke',
      (d) =>
        d.data.label === activeType
          ? '#0f172a'
          : 'white',
    )
    .attr(
      'stroke-width',
      (d) =>
        d.data.label === activeType
          ? 4
          : 2,
    )
    .attr('opacity', (d) => {
      if (!activeType) return 1

      return d.data.label === activeType
        ? 1
        : 0.65
    })

  chart
    .append('text')
    .attr('text-anchor', 'middle')
    .attr('dy', '-0.1em')
    .attr(
      'class',
      'fill-slate-800 text-xl font-bold',
    )
    .text(formatNumber(total))

  chart
    .append('text')
    .attr('text-anchor', 'middle')
    .attr('dy', '1.5em')
    .attr(
      'class',
      'fill-slate-500 text-[10px]',
    )
    .text('entities')

  const legendHeight =
    entityData.value.length * 38

  const legend = svg
    .append('g')
    .attr(
      'transform',
      `translate(345, ${
        (height - legendHeight) / 2
      })`,
    )

  entityData.value.forEach(
    (item, index) => {
      const active =
        item.label === activeType

      const row = legend
        .append('g')
        .attr(
          'transform',
          `translate(0, ${index * 38})`,
        )

      row
        .append('rect')
        .attr('width', 11)
        .attr('height', 11)
        .attr('rx', 2)
        .attr(
          'fill',
          color(item.label),
        )
        .attr(
          'stroke',
          active
            ? '#0f172a'
            : 'none',
        )
        .attr(
          'stroke-width',
          2,
        )

      row
        .append('text')
        .attr('x', 20)
        .attr('y', 10)
        .attr(
          'class',
          active
            ? 'fill-slate-900 text-xs font-semibold'
            : 'fill-slate-700 text-xs',
        )
        .text(item.label)

      row
        .append('text')
        .attr('x', 20)
        .attr('y', 25)
        .attr(
          'class',
          'fill-slate-500 text-[10px]',
        )
        .text(
          `${formatNumber(item.value)} (${percentage(
            item.value,
            total,
          )})`,
        )
    },
  )
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
    <div class="mb-3 ">
      <div class="flex items-start gap-2">
        <h3 class="text-sm font-semibold text-slate-900"> Entity composition </h3>

        <div class="group relative shrink-0">
          <button
            type="button"
            class="flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 bg-white text-[10px] font-semibold text-slate-600"
            aria-label="Information about entity composition"
          >
            ?
          </button>

          <div
            class="pointer-events-none absolute left-1/2 top-6 z-30 hidden w-72 -translate-x-1/2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs leading-5 text-white shadow-xl group-hover:block group-focus-within:block">
            <strong>What is the network made of?</strong>
            <br />
            <p> Shows the number and the percentage of each type of entity in the entire network, from the most common to the least common.</p>
          </div>
        </div>
    </div>
    <p class="mt-1 text-xs text-slate-500"> Distribution of entity types across the entire graph. </p>
  </div>
    <div
      ref="chartContainer"
      class="relative w-full overflow-x-auto"
    />
  </div>
</template>
