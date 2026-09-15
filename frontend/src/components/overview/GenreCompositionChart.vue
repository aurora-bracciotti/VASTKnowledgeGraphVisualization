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

const genreData = computed(() => {
  return (props.overview?.genres ?? [])
    .filter((row) => Number(row.value) > 0)
    .map((row) => ({
      label: row.label,
      value: Number(row.value),
    }))
})

const activeArtistGenres = computed(() => {
  const artist = activeArtist.value

  if (!artist ||!props.graph?.links || !props.graph?.nodes) {
    return new Set()
  }

  const artistId = String(artist.id)
  const genres = new Set()

  for (const link of props.graph.links) {
    const sourceId = String(link.source)
    const targetId = String(link.target)

    let connectedId = null

    if (sourceId === artistId) {
      connectedId = targetId
    } else if (targetId === artistId) {
      connectedId = sourceId
    }

    if (connectedId === null) continue

    const connectedNode =
      props.graph.nodes.find(
        (node) =>
          String(node.id) === connectedId,
      )

    if (connectedNode?.genre && connectedNode.genre !== 'Unknown') {
      genres.add(connectedNode.genre)
    }
  }

  if (artist.genre && artist.genre !== 'Unknown') {
    genres.add(artist.genre)
  }

  return genres
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
    genreData.value,
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

  const color = d3
    .scaleOrdinal()
    .domain(
      genreData.value.map(
        (d) => d.label,
      ),
    )
    .range(d3.schemeTableau10)

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

  chart
    .selectAll('path')
    .data(pie(genreData.value))
    .join('path')
    .attr('d', arc)
    .attr(
      'fill',
      (d) => color(d.data.label),
    )
    .attr(
      'stroke',
      (d) =>
        activeArtistGenres.value.has(
          d.data.label,
        )
          ? '#0f172a'
          : 'white',
    )
    .attr(
      'stroke-width',
      (d) =>
        activeArtistGenres.value.has(
          d.data.label,
        )
          ? 4
          : 2,
    )
    .attr('opacity', (d) => {
      if (!activeArtist.value) return 1

      return activeArtistGenres.value.has(
        d.data.label,
      )
        ? 1
        : 0.65
    })
    .on('mouseenter', function (event, d) {
      const percent = percentage(
        d.data.value,
        total,
      )

      d3.select(this)
        .transition()
        .duration(150)
        .attr(
          'transform',
          'scale(1.06)',
        )

      tooltip
        .style('opacity', 1)
        .html(
          `<strong>${d.data.label}</strong><br/>
           ${formatNumber(d.data.value)} entities<br/>
           ${percent} of total`,
        )
    })
    .on('mousemove', function (event) {
      const rect =
        container.getBoundingClientRect()

      tooltip
        .style(
          'left',
          `${event.clientX - rect.left + 12}px`,
        )
        .style(
          'top',
          `${event.clientY - rect.top + 12}px`,
        )
    })
    .on('mouseleave', function () {
      d3.select(this)
        .transition()
        .duration(150)
        .attr(
          'transform',
          'scale(1)',
        )

      tooltip.style(
        'opacity',
        0,
      )
    })

  chart
    .append('text')
    .attr('text-anchor', 'middle')
    .attr('dy', '-0.1em')
    .attr(
      'class',
      'fill-slate-800 text-xl font-bold',
    )
    .text(formatNumber(genreData.value.length))

  chart
    .append('text')
    .attr('text-anchor', 'middle')
    .attr('dy', '1.5em')
    .attr(
      'class',
      'fill-slate-500 text-[10px]',
    )
    .text('genre')

  const visibleGenres =
    genreData.value.slice(0, 7)

  const legendHeight =
    visibleGenres.length * 38

  const legend = svg
    .append('g')
    .attr(
      'transform',
      `translate(345, ${
        (height - legendHeight) / 2
      })`,
    )

  visibleGenres.forEach(
    (item, index) => {
      const active =
        activeArtistGenres.value.has(
          item.label,
        )

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
    <div class="mb-3">
      <div class="flex items-start gap-2">
        <h3 class="text-sm font-semibold text-slate-900"> Genre composition </h3>

        <div class="group relative shrink-0">
          <button
            type="button"
            class="flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 bg-white text-[10px] font-semibold text-slate-600"
            aria-label="Information about genre composition"
          >
            ?
          </button>

          <div
            class="pointer-events-none absolute left-1/2 top-6 z-30 hidden w-72 -translate-x-1/2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs leading-5 text-white shadow-xl group-hover:block group-focus-within:block"
          >
            <strong>Which genres are connected to this artist?</strong>
            <br />
            <p> Black-outlined genres are associated with the artist or inherited through their influences. Other genres belong to the wider network. Hover over a genre to see its name, percentage, and count. Only the main genres are shown in the legend.</p>
          </div>
        </div>
    </div>

    <p class="mt-1 text-xs text-slate-500"> Genre distribution across the entire graph. </p>
  </div>
    <div
      ref="chartContainer"
      class="relative w-full"
    />
  </div>
</template>
