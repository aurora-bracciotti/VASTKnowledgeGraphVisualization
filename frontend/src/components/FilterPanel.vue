<script setup>
import { computed } from 'vue'

import { getArtists, isSong, isAlbum } from '../data/graphTransforms.js'

const props = defineProps({
  graph: {
    type: Object,
    required: true,
  },
  selectedArtistId: {
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
  'update:filters',
])

// --- ELENCO ARTISTI ---
const artists = computed(() => {
  if (!props.graph?.nodes) {
    return []
  }

  return getArtists(props.graph.nodes)
})

// --- ARTISTA EFFETTIVO ---
const effectiveArtist = computed(() => {
  if (!props.graph?.nodes || props.selectedArtistId === null || props.selectedArtistId === undefined) {
    return null
  }

  return (
    artists.value.find(
      (artist) => artist.id === String(props.selectedArtistId),
    ) ?? null
  )
})

// Sono mostrati solo i nodi collegati all'artista attivo
const artistContextNodes = computed(() => {
  if (!props.graph?.nodes || !props.graph?.links || !effectiveArtist.value) {
    return []
  }

  const artistId = effectiveArtist.value.id
  const contextIds = new Set()

  contextIds.add(artistId)

  for (const link of props.graph.links) {
    if (link.source === artistId) {
      contextIds.add(link.target)
    }

    if (link.target === artistId) {
      contextIds.add(link.source)
    }
  }

  return props.graph.nodes.filter((node) => contextIds.has(node.id))
})

// Canzoni
const songs = computed(() => {
  return artistContextNodes.value
    .filter(isSong)
    .sort((a, b) => a.label.localeCompare(b.label))
})

// Album
const albums = computed(() => {
  return artistContextNodes.value
    .filter(isAlbum)
    .sort((a, b) => a.label.localeCompare(b.label))
})

// Generi
const genres = computed(() => {
  return [
    ...new Set(
      songs.value
        .map((song) => song.genre)
        .filter((genre) => genre && genre !== 'Unknown'),
    ),
  ].sort((a, b) => a.localeCompare(b))
})

// Relazioni 
const relationships = computed(() => {
  if (!props.graph?.links || !effectiveArtist.value) {
    return []
  }

  const artistId = effectiveArtist.value.id

  return [
    ...new Set(
      props.graph.links
        .filter((link) => link.source === artistId || link.target === artistId)
        .map((link) => link.edgeType)
        .filter((type) => type && type !== 'Unknown'),
    ),
  ].sort((a, b) => a.localeCompare(b))
})

// Periodo disponibile 
const years = computed(() => {
  return [
    ...new Set(
      songs.value
        .map((song) => song.releaseYear)
        .filter((year) => year !== null && year !== undefined),
    ),
  ].sort((a, b) => a - b)
})

// --- BINDING DEI FILTRI CONDIVISI ---
function makeFilterModel(key, { parseNumber = false } = {}) {
  return computed({
    get: () => {
      const value = props.filters?.[key]
      return value === null || value === undefined ? '' : value
    },
    set: (rawValue) => {
      const value = rawValue === '' ? null : rawValue
      emit('update:filters', {
        [key]: parseNumber && value !== null ? Number(value) : value,
      })
    },
  })
}

const selectedGenre = makeFilterModel('genre')
const selectedRelationship = makeFilterModel('relationship')
const minYear = makeFilterModel('minYear', { parseNumber: true })
const maxYear = makeFilterModel('maxYear', { parseNumber: true })

// Selezione della canzone o dell'album
const selectedSongId = computed({
  get: () => (props.filters?.songId ? props.filters.songId : ''),
  set: (rawValue) => {
    const value = rawValue === '' ? null : rawValue
    emit('update:filters', {
      songId: value,
      albumId: value ? null : props.filters?.albumId ?? null,
    })
  },
})

const selectedAlbumId = computed({
  get: () => (props.filters?.albumId ? props.filters.albumId : ''),
  set: (rawValue) => {
    const value = rawValue === '' ? null : rawValue
    emit('update:filters', {
      albumId: value,
      songId: value ? null : props.filters?.songId ?? null,
    })
  },
})

// --- CAMBIO ARTISTA ---

// Tutti i filtri dipendenti dall'artista precedente vengono azzerati quando cambia l'artista attivo
function resetDependentFilters() {
  emit('update:filters', {
    genre: null,
    relationship: null,
    songId: null,
    albumId: null,
    minYear: null,
    maxYear: null,
  })
}

function selectArtist(event) {
  const value = event.target.value

  // "" significa: nessuna selezione esplicita, quindi usa il default (Sailor Shift)
  emit('select-artist', value === '' ? null : value)
  resetDependentFilters()
}

// Reset completo
function resetFilters() {
  resetDependentFilters()
  emit('select-artist', null)
}

defineExpose({ resetFilters })
</script>


<template>

  <div class="space-y-3">

    <!-- ARTISTA -->
    <div>
      <label class="block text-sm font-medium text-slate-700"> Artist </label>

      <select
        :value="selectedArtistId ?? ''"
        @change="selectArtist"
        class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
      >
        <option value="">
          Sailor Shift (default)
        </option>

        <option
          v-for="artist in artists"
          :key="artist.id"
          :value="artist.id"
        >
          {{ artist.label }}
        </option>
      </select>

      <p class="mt-1 text-[10px] text-slate-400"> Drives every panel: overview, ego network and timeline.</p>
    </div>

    <!-- ARTISTA ATTIVO -->
    <div
      v-if="effectiveArtist"
      class="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2"
    >

      <p class="text-xs text-blue-700"> Active artist </p>

      <p class="text-sm font-semibold text-blue-950">
        {{ effectiveArtist.label }}
      </p>
    </div>

    <!-- GENERE -->
    <div>
      <label class="block text-sm font-medium text-slate-700"> Genre </label>

      <select
        v-model="selectedGenre"
        :disabled="!effectiveArtist"
        class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
      >

        <option value="">
          All genres
        </option>

        <option
          v-for="genre in genres"
          :key="genre"
          :value="genre"
        >
          {{ genre }}
        </option>
      </select>

      <p class="mt-1 text-[10px] text-slate-400"> Highlights matching nodes in the Ego Network and Timeline panels. </p>
    </div>

    <!-- RELAZIONI -->

    <div>
      <label class="block text-sm font-medium text-slate-700"> Relationship </label>

      <select
        v-model="selectedRelationship"
        :disabled="!effectiveArtist"
        class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
      >

        <option value="">
          All relationships
        </option>

        <option
          v-for="relationship in relationships"
          :key="relationship"
          :value="relationship"
        >
          {{ relationship }}
        </option>
      </select>

      <p class="mt-1 text-[10px] text-slate-400"> Restricts the Ego Network's connections and pre-fills the Sankey diagram in the Network Overview panel.</p>
    </div>

    <!-- CANZONE -->
    <div>
      <label class="block text-sm font-medium text-slate-700"> Song </label>

      <select
        v-model="selectedSongId"
        :disabled="!effectiveArtist"
        class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
      >

        <option value="">
          All songs
        </option>

        <option
          v-for="song in songs"
          :key="song.id"
          :value="song.id"
        >
          {{ song.label }}
        </option>
      </select>
    </div>

    <!-- ALBUM -->
    <div>
      <label class="block text-sm font-medium text-slate-700"> Album </label>

      <select
        v-model="selectedAlbumId"
        :disabled="!effectiveArtist"
        class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
      >

        <option value="">
          All albums
        </option>

        <option
          v-for="album in albums"
          :key="album.id"
          :value="album.id"
        >
          {{ album.label }}
        </option>
      </select>

      <p class="mt-1 text-[10px] text-slate-400">  Song / Album: re-centers the Ego Network on that work and highlights in the Timeline panel. Only one can be selected at a time. </p>
    </div>

    <!-- PERIODO -->
    <div>
      <label class="block text-sm font-medium text-slate-700"> Year range </label>

      <div class="mt-1 grid grid-cols-2 gap-2">
        <input
          v-model="minYear"
          type="number"
          placeholder="From"
          :min="years[0]"
          :max="years.at(-1)"
          class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          :disabled="!effectiveArtist"
        />

        <input
          v-model="maxYear"
          type="number"
          placeholder="To"
          :min="years[0]"
          :max="years.at(-1)"
          class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          :disabled="!effectiveArtist"
        />
      </div>

      <p class="mt-1 text-[10px] text-slate-400"> Used by the Timeline panel. </p>
    </div>

    <!-- RIASSUNTO -->
    <div
      v-if="effectiveArtist"
      class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-xs leading-5 text-slate-600"
    >

      <p> Showing data for
        <strong>{{ effectiveArtist.label }}</strong>.
      </p>

      <p class="mt-1">
        {{ songs.length }} songs ·
        {{ albums.length }} albums ·
        {{ genres.length }} genres ·
        {{ relationships.length }} relationships
      </p>
    </div>
  </div>
</template>
