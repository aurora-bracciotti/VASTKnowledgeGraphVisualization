<script setup>
import { computed, onMounted, ref } from 'vue'

import { loadGraph } from '../data/graphLoader.js'
import { normalizeGraph } from '../data/graphTransforms.js'
import { createGraphIndex } from '../data/metrics.js'

import DashboardCard from './DashboardCard.vue'
import FilterPanel from './FilterPanel.vue'
import OverviewPanel from './OverviewPanel.vue'
import EgoNetworkPanel from './EgoNetworkPanel.vue'
import TimelinePanel from './TimelinePanel.vue'

const graph = ref(null)
const index = ref(null)
const filterPanelRef = ref(null)

const loading = ref(true)
const error = ref(null)
const chartsReady = ref(false)

// Tutti i pannelli ricevono questi stessi filtri. Ogni pannello decide poi come interpretarli
const filters = ref({
  artistId: null,
  genre: null,
  albumId: null,
  songId: null,
  relationship: null,
  minYear: null,
  maxYear: null,
})

// Espansione pannello
const expandedPanel = ref(null)

onMounted(async () => {
  try {
    const rawGraph = await loadGraph()

    graph.value = normalizeGraph(rawGraph)

    index.value = createGraphIndex(graph.value)

    requestAnimationFrame(() => {
      chartsReady.value = true
    })

  } catch (err) {
    console.error(err)
    error.value = err.message

  } finally {
    loading.value = false
  }
})

// Artista effettivo
//Se l'utente non ha ancora scelto un artista, manteniamo il comportamento della MC1: Sailor Shift come artista di default
const effectiveArtistId = computed(() => {
  if (filters.value.artistId !== null) {
    return filters.value.artistId
  }

  if (!graph.value) {
    return null
  }

  const sailor = graph.value.nodes.find(
    (node) =>
      node.label?.toLowerCase() === 'sailor shift',
  )

  return sailor?.id ?? null
})

// Riceve l'intero stato dei filtri dal FilterPanel
function updateFilters(nextFilters) {
  filters.value = {
    ...filters.value,
    ...nextFilters,
  }
}

// Quando un grafico seleziona un artista, aggiorniamo il filtro globale dell'artista
function selectArtist(artistId) {
  filters.value = {
    ...filters.value,
    artistId,
  }
}

// Apertura pannello
function openPanel(panel) {
  expandedPanel.value = panel
}

// Chiusura pannello
function closePanel() {
  expandedPanel.value = null
}
</script>

<template>

  <main class="h-screen overflow-hidden p-6">

    <!-- LOADING -->
    <div v-if="loading">
      <p>Loading graph...</p>
    </div>

    <!-- ERROR -->
    <div v-else-if="error">
      <p class="text-red-600">Error loading graph: {{ error }} </p>
    </div>

    <!-- DASHBOARD -->
    <div
      v-else
      class="grid h-full min-h-0 grid-cols-[280px_1fr] gap-6"
    >
      <!-- FILTRI -->
      <aside class="min-h-0 min-w-0">
        <div
          class="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
        >
          <!-- HEADER FILTRI -->
          <div class="flex shrink-0 items-center justify-between gap-2 p-4">
            <h3 class="text-base font-semibold text-slate-900"> Filters </h3>

            <button
              type="button"
              @click="filterPanelRef?.resetFilters()"
              class="shrink-0 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Reset
            </button>
          </div>

          <!-- CONTENUTO FILTRI -->
          <div class="min-h-0 flex-1 overflow-auto px-4 pb-4">
            <FilterPanel
              ref="filterPanelRef"
              :graph="graph"
              :selected-artist-id="effectiveArtistId"
              :filters="filters"
              @update:filters="updateFilters"
              @select-artist="selectArtist"
            />
          </div>
        </div>
      </aside>

      <!-- PANNELLI -->
      <section
        v-if="chartsReady"
        class="grid min-h-0 min-w-0 gap-6"
        :class="
          expandedPanel
            ? 'grid-cols-1 grid-rows-1'
            : 'grid-cols-2 grid-rows-[minmax(0,1fr)_minmax(0,1fr)]'
        "
      >
        <!-- OVERVIEW -->
        <DashboardCard
          v-if="!expandedPanel || expandedPanel === 'overview'"
          :class="!expandedPanel ? '' : 'col-span-1 row-span-1'"
          title="Network Overview — Exploring Artists, Connections & Structure"
          subtitle="General analysis - What can we discover from artists’ connections?"
          description="The Network Overview provides both global statistical analysis and structural analysis of the Knowledge Graph, including entity and relationship distributions, degree distribution, Sankey-based relationship flows, and connected-component. The selected artist is also contextualized against the global graph statistics."
          :expanded="expandedPanel === 'overview'"
          @open="openPanel('overview')"
          @close="closePanel"
        >
          <OverviewPanel
            :graph="graph"
            :index="index"
            :artist-id="effectiveArtistId"
            :filters="filters"
            @select-artist="selectArtist"
          />
        </DashboardCard>

        <!-- EGO NETWORK -->
        <DashboardCard
          v-if="!expandedPanel || expandedPanel === 'ego'"
          title="Ego Network - Exploring Local Connections & Relationships"
          subtitle="Artist connectivity - How is the selected entity connected to its local network?"
          description="Explore the local neighborhood of the selected entity. Adjust the depth and maximum number of alters to control how much of the surrounding network is shown. The Summary below highlights the most connected nodes, the main genres, and the direct and indirect connections."
          :expanded="expandedPanel === 'ego'"
          @open="openPanel('ego')"
          @close="closePanel"
        >
          <EgoNetworkPanel
            :graph="graph"
            :index="index"
            :artist-id="effectiveArtistId"
            :filters="filters"
            @select-artist="selectArtist"
          />
        </DashboardCard>

        <!-- TIMELINE -->
        <DashboardCard
          v-if="!expandedPanel || expandedPanel === 'timeline'"
          class="col-span-2"
          title="Timeline - Genre Activity & Influences Over Time"
          subtitle="Temporal analysis - How are the artist’s works and influences distributed over time?"
          description="This timeline shows how the selected artist’s activity and influence relationships evolve over time. Bars represent the artist’s works released each year, while additional charts show who influenced the artist and who was influenced by the artist. Selecting a year reveals further details about the related works and influence relationships."
          :expanded="expandedPanel === 'timeline'"
          @open="openPanel('timeline')"
          @close="closePanel"
        >
          <TimelinePanel
            :graph="graph"
            :index="index"
            :artist-id="effectiveArtistId"
            :filters="filters"
          />
        </DashboardCard>
      </section>
    </div>
  </main>
</template>
