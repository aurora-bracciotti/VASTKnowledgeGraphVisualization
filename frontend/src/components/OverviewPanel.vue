<script setup>
import { computed } from 'vue'
import { computeGraphOverview } from '../data/metrics.js'

import EntityCompositionChart from './overview/EntityCompositionChart.vue'
import GenreCompositionChart from './overview/GenreCompositionChart.vue'
import RelationshipTypesChart from './overview/RelationshipTypesChart.vue'
import DegreeDistributionChart from './overview/DegreeDistributionChart.vue'
import RelationshipFlowChart from './overview/RelationshipFlowChart.vue'
import NodeLinkDiagram from './overview/NodeLinkDiagram.vue'
import ConnectedComponentsChart from './overview/ConnectedComponentsChart.vue'

const props = defineProps({
  graph: {
    type: Object,
    required: true,
  },
  index: {
    type: Object,
    required: true,
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

const overview = computed(() => {
  if (!props.graph || !props.artistId) {
    return null
  }

  return computeGraphOverview(
    props.graph,
    props.artistId,
    {
      index: props.index,
    },
  )
})
</script>

<template>
  <div v-if="overview">

    <!-- SELECTED ARTIST -->
    <section>
      <p class="text-xs font-semibold uppercase tracking-wider text-slate-500"> Selected artist </p>

      <h3
        class="mt-1 text-xl font-bold text-slate-900"
      >
        {{ overview.artistProfile?.node?.label ?? 'Unknown' }}
      </h3>

      <div
        v-if="overview.artistProfile"
        class="mt-4 grid grid-cols-2 gap-3"
      >

        <!-- WORKS -->
        <div>
          <p class="text-xs text-slate-500"> Works </p>

          <p class="text-xl font-bold">
            {{ overview.artistProfile.workCount }}
          </p>
        </div>

        <!-- DEGREE -->
        <div>
          <p class="text-xs text-slate-500"> Degree </p>

          <p class="text-xl font-bold">
            {{ overview.artistProfile.degree }}
          </p>
        </div>

        <!-- CREATIVE ROLES -->
        <div>
          <p class="text-xs text-slate-500"> Creative roles </p>

          <p class="text-xl font-bold">
            {{ overview.artistProfile.creativeRoleLinks }}
          </p>
        </div>

        <!-- PERFORMANCES -->
        <div>
          <p class="text-xs text-slate-500"> Performances </p>

          <p class="text-xl font-bold">
            {{ overview.artistProfile.performanceLinks }}
          </p>
        </div>

        <!-- INFLUENCES -->
        <div>
          <p class="text-xs text-slate-500"> Influences </p>

          <p class="text-xl font-bold">
            {{ overview.artistProfile.influenceLinks }}
          </p>
        </div>

        <!-- ACTIVE YEARS -->
        <div>
          <p class="text-xs text-slate-500"> Active years </p>

          <p class="text-xl font-bold">
            {{ overview.artistProfile.activeYearCount }}
          </p>

          <p class="text-xs text-slate-400"> {{ overview.artistProfile.firstYear }} – {{ overview.artistProfile.lastYear }} </p>
        </div>
      </div>
    </section>

    <!-- SEPARATOR -->
    <div class="my-6 border-t border-slate-200"></div>

    <!-- GLOBAL GRAPH -->
    <section>
      <p class="text-xs font-semibold uppercase tracking-wider text-slate-500"> Global graph </p>

      <div class="mt-4 grid grid-cols-2 gap-3">

        <!-- NODES -->
        <div>
          <p class="text-xs text-slate-500"> Nodes </p>

          <p class="text-xl font-bold">
            {{ overview.totalNodes }}
          </p>
        </div>

        <!-- LINKS -->
        <div>
          <p class="text-xs text-slate-500"> Links </p>

          <p class="text-xl font-bold">
            {{ overview.totalLinks }}
          </p>
        </div>

        <!-- ARTISTS -->
        <div>
          <p class="text-xs text-slate-500"> Artists </p>

          <p class="text-xl font-bold">
            {{ overview.artistCount }}
          </p>
        </div>

        <!-- SONGS -->
        <div>
          <p class="text-xs text-slate-500"> Songs </p>

          <p class="text-xl font-bold">
            {{ overview.songCount }}
          </p>
        </div>

        <!-- ALBUMS -->
        <div>
          <p class="text-xs text-slate-500"> Albums </p>

          <p class="text-xl font-bold">
            {{ overview.albumCount }}
          </p>
        </div>

        <!-- WORKS -->
        <div>
          <p class="text-xs text-slate-500"> Works </p>

          <p class="text-xl font-bold">
            {{ overview.workCount }}
          </p>
        </div>

      </div>
    </section>


    <!-- OVERVIEW CHARTS -->
    <div
      class="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2"
    >

      <!-- ENTITY COMPOSITION -->
      <EntityCompositionChart
        :graph="graph"
        :overview="overview"
        :artist-id="artistId"
      />

      <!-- GENRE COMPOSITION -->
      <GenreCompositionChart
        :graph="graph"
        :overview="overview"
        :artist-id="artistId"
      />

      <!-- RELATIONSHIP TYPES -->
      <RelationshipTypesChart
        :graph="graph"
        :overview="overview"
        :artist-id="artistId"
      />

      <!-- DEGREE DISTRIBUTION -->
      <DegreeDistributionChart
        :graph="graph"
        :overview="overview"
        :artist-id="artistId"
      />

      <!-- RELATIONSHIP FLOW -->
      <RelationshipFlowChart
        :graph="graph"
        :overview="overview"
        :artist-id="artistId"
        :filters="filters"
      />
      <div class="grid grid-cols-1 gap-6 lg:col-span-2 lg:grid-cols-5">

        <!-- NODE-LINK DIAGRAM -->
        <div class="lg:col-span-3">
          <NodeLinkDiagram
            :graph="graph"
            :index="index"
            :artist-id="artistId"
            @select-artist="(id) => emit('select-artist', id)"
          />
        </div>

        <!-- CONNECTED COMPONENTS -->
        <div class="lg:col-span-2">
          <ConnectedComponentsChart
            v-if="overview"
            :graph="graph"
            :overview="overview"
            :artist-id="artistId"
          />
        </div>
      </div>
    </div>
  </div>

  <!-- LOADING -->
  <p v-else> Loading data... </p>
</template>
