<script setup>
import { computed, ref } from 'vue'

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

const showAll = ref(false)
const sortKey = ref('nodeCount')
const sortDirection = ref('desc')

const components = computed(() => {
  return props.overview?.connectedComponents?.components ?? []
})

const totalComponents = computed(() => {
  return props.overview?.connectedComponents?.total ?? 0
})

const isolatedCount = computed(() => {
  return props.overview?.connectedComponents?.isolatedCount ?? 0
})

const largestComponent = computed(() => {
  return props.overview?.connectedComponents?.largest ?? null
})

const largestSharePercentage = computed(() => {
  if (!props.graph?.nodes?.length || !largestComponent.value) return 0
  return (largestComponent.value.nodeCount / props.graph.nodes.length) * 100
})

// Trova la componente che contiene l'artista attivo.
const activeArtistComponent = computed(() => {
  if (props.artistId === null || props.artistId === undefined) {
    return null
  }

  const artistId = String(props.artistId)

  return (
    components.value.find((component) =>
      component.nodeIds?.some(
        (nodeId) => String(nodeId) === artistId,
      ),
    ) ?? null
  )
})

const rankedComponents = computed(() => {
  return components.value.map((component, index) => ({
    ...component,
    rank: index + 1,
    percentage: props.graph?.nodes?.length
      ? (component.nodeCount / props.graph.nodes.length) * 100
      : 0,
  }))
})

const sortedComponents = computed(() => {
  const rows = [...rankedComponents.value]
  const key = sortKey.value
  const direction = sortDirection.value === 'asc' ? 1 : -1

  rows.sort((a, b) => {
    if (key === 'dominantType') {
      return (
        (a.dominantType ?? '').localeCompare(b.dominantType ?? '') *
        direction
      )
    }

    return (a[key] - b[key]) * direction
  })

  return rows
})

const visibleComponents = computed(() => {
  if (showAll.value) {
    return sortedComponents.value
  }

  return sortedComponents.value.slice(0, 10)
})

function setSort(key) {
  if (sortKey.value === key) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
    return
  }

  sortKey.value = key
  sortDirection.value = 'desc'
}

function sortIcon(key) {
  if (sortKey.value !== key) return null
  return sortDirection.value === 'asc' ? '↑' : '↓'
}

function formatPercentage(value) {
  return `${value.toFixed(1).replace('.', ',')}%`
}

function isActiveRow(component) {
  return activeArtistComponent.value?.id === component.id
}
</script>

<template>
  <section class="rounded-xl border border-slate-200 bg-white p-5 space-y-5">

    <!-- HEADER -->
    <div class="mb-3 ">
      <div class="flex items-start gap-2">
        <h3 class="text-sm font-semibold text-slate-900"> Connected Components </h3>

        <!-- INFO -->
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
            <strong>How is the network divided into groups?</strong>
            <br />
            <p> A connected component is a group of nodes that can reach one another through the network, either directly or through other connected nodes. Large components reveal broad connected structures within the network, while small components and isolated nodes highlight more disconnected parts. Connected components describe the overall connectivity of the graph and should not be confused with semantic communities, which group nodes based on stronger or more meaningful patterns of connections.</p>
          </div>
        </div>
      </div>
      <p class="mt-1 text-xs leading-5 text-slate-500"> How the network breaks down into separately connected groups of nodes. </p>
    </div>

    <!-- SUMMARY -->
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">

      <div class="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <div class="min-w-0">
          <p class="text-xs text-slate-500"> Components </p>
          <p class="text-lg font-semibold tabular-nums text-slate-900">
            {{ totalComponents.toLocaleString() }}
          </p>
        </div>
      </div>

      <div class="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <div class="min-w-0">
          <p class="text-xs text-slate-500"> Largest component </p>
          <p class="text-lg font-semibold tabular-nums text-slate-900">
            {{ largestComponent?.nodeCount?.toLocaleString() ?? 0 }}
            <span class="text-xs font-normal text-slate-400">nodes</span>
          </p>
        </div>
      </div>

      <div class="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <div class="min-w-0">
          <p class="text-xs text-slate-500"> Isolated nodes </p>
          <p class="text-lg font-semibold tabular-nums text-slate-900">
            {{ isolatedCount.toLocaleString() }}
          </p>
        </div>
      </div>

    </div>

    <!-- SUMMARY -->
    <p class="rounded-lg bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
      The network splits into
      <strong class="text-slate-800">{{ totalComponents.toLocaleString() }}</strong>
      separate groups. The largest one alone holds
      <strong class="text-slate-800">{{ formatPercentage(largestSharePercentage) }}</strong>
      of all nodes, while
      <strong class="text-slate-800">{{ isolatedCount.toLocaleString() }}</strong>
      nodes have no connections at all.
    </p>

    <!-- TABLE -->
    <div>
      <div class="flex items-center justify-between gap-3">
        <p class="text-xs font-semibold text-slate-700"> Components breakdown </p>

        <p
          v-if="activeArtistComponent"
          class="flex items-center gap-1.5 text-[11px] text-blue-700"
        >
          <span class="h-2 w-2 rounded-full bg-blue-500" />
          Selected artist's component
        </p>
      </div>

      <div class="mt-2 overflow-x-auto rounded-lg border border-slate-200">
        <table class="w-full min-w-[460px] text-left text-xs">
          <thead>
            <tr class="border-b border-slate-200 bg-slate-50 text-slate-500">
              <th class="w-10 px-2 py-2 font-medium">
                #
              </th>

              <th class="px-2 py-2 font-medium">
                <button
                  type="button"
                  class="flex items-center gap-1 rounded transition hover:text-slate-800"
                  @click="setSort('nodeCount')"
                >
                  Nodes
                  <span class="w-3 text-blue-600">{{ sortIcon('nodeCount') }}</span>
                </button>
              </th>

              <th class="px-2 py-2 font-medium">
                <button
                  type="button"
                  class="flex items-center gap-1 rounded transition hover:text-slate-800"
                  @click="setSort('linkCount')"
                >
                  Relationships
                  <span class="w-3 text-blue-600">{{ sortIcon('linkCount') }}</span>
                </button>
              </th>

              <th class="px-2 py-2 font-medium">
                <button
                  type="button"
                  class="flex items-center gap-1 rounded transition hover:text-slate-800"
                  @click="setSort('percentage')"
                >
                  % of nodes
                  <span class="w-3 text-blue-600">{{ sortIcon('percentage') }}</span>
                </button>
              </th>

              <th class="px-2 py-2 font-medium">
                <button
                  type="button"
                  class="flex items-center gap-1 rounded transition hover:text-slate-800"
                  @click="setSort('dominantType')"
                >
                  Dominant type
                  <span class="w-3 text-blue-600">{{ sortIcon('dominantType') }}</span>
                </button>
              </th>
            </tr>
          </thead>

          <tbody>
            <tr
              v-for="component in visibleComponents"
              :key="component.id"
              class="border-b border-slate-100 transition last:border-b-0 hover:bg-slate-50"
              :class="[
                isActiveRow(component)
                  ? 'border-l-4 border-l-blue-500 bg-blue-50/70 hover:bg-blue-50'
                  : 'border-l-4 border-l-transparent odd:bg-white even:bg-slate-50/40',
              ]"
            >
              <td class="px-2 py-2.5 font-medium text-slate-700">
                <span
                  class="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold"
                  :class="
                    isActiveRow(component)
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600'
                  "
                >
                  {{ component.rank }}
                </span>
              </td>

              <td class="px-2 py-2.5 font-semibold tabular-nums text-slate-800">
                {{ component.nodeCount.toLocaleString() }}
              </td>

              <td class="px-2 py-2.5 tabular-nums text-slate-600">
                {{ component.linkCount.toLocaleString() }}
              </td>

              <td class="px-2 py-2.5 tabular-nums text-slate-600">
                {{ formatPercentage(component.percentage) }}
              </td>

              <td class="px-2 py-2.5 text-slate-600">
                <span class="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                  {{ component.dominantType ?? 'Unknown' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- SHOW MORE -->
    <button
      v-if="components.length > 10"
      type="button"
      class="w-full rounded-lg border border-slate-300 px-2 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
      @click="showAll = !showAll"
    >
      {{
        showAll
          ? 'Show fewer components'
          : `Show all ${components.length.toLocaleString()} components`
      }}
    </button>
  </section>
</template>
