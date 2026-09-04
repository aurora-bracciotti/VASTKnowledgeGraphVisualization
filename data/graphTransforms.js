const UNKNOWN = 'Unknown'

const ARTIST_TYPES = new Set(['person', 'artist', 'singer', 'musician', 'producer'])
const SONG_TYPES = new Set(['song', 'track'])
const ALBUM_TYPES = new Set(['album', 'record'])

// --- NORMALIZZAZIONE GRAFO ---
export function normalizeGraph(rawGraph) {
  const nodes = (rawGraph.nodes ?? []).map(normalizeNode)
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const links = (rawGraph.links ?? [])
    .map((link, index) => normalizeLink(link, index, nodeById))
    .filter((link) => link.sourceNode && link.targetNode)

  return {
    directed: Boolean(rawGraph.directed),
    multigraph: Boolean(rawGraph.multigraph),
    graph: rawGraph.graph ?? {},
    nodes,
    links,
    nodeById,
  }
}

export function normalizeNode(node) {
  const id = normalizeId(node.id)
  const nodeType = formatUnknown(node['Node Type'] ?? node.type)
  const genre = formatUnknown(node.genre)
  const releaseYear = extractYear(node.release_date)
  const writtenYear = extractYear(node.written_date)
  const notorietyYear = extractYear(node.notoriety_date)
  const year = releaseYear ?? writtenYear ?? notorietyYear
  
  return {
    ...node,
    rawProperties: Object.fromEntries(
      Object.entries(node).filter(([key]) => !['id', 'Node Type', 'name'].includes(key)),
    ),
    id,
    rawId: node.id,
    label: formatUnknown(node.name ?? node.stage_name ?? node.label ?? node.id),
    nodeType,
    nodeTypeKey: nodeType.trim().toLowerCase(),
    genre,
    releaseYear,
    writtenYear,
    notorietyYear,
    year,
    notable: Boolean(node.notable),
    isSingle: Boolean(node.single),
  }
}

export function normalizeLink(link, index, nodeById) {
  const source = normalizeEndpoint(link.source)
  const target = normalizeEndpoint(link.target)
  const edgeType = formatUnknown(link['Edge Type'] ?? link.type)
  
  return {
    ...link,
    rawProperties: Object.fromEntries(
      Object.entries(link).filter(
        ([key]) => !['source', 'target', 'Edge Type'].includes(key),
      ),
    ),
    id: `${source}-${target}-${link.key ?? index}`,
    source,
    target,
    rawSource: link.source,
    rawTarget: link.target,
    sourceNode: nodeById.get(source),
    targetNode: nodeById.get(target),
    edgeType,
    edgeTypeKey: edgeType.trim().toLowerCase(),
    year: extractYear(link.date ?? link.year ?? link.release_date ?? link.written_date),
  }
}

// --- NORMALIZZAZIONE GENERALE ---
export function normalizeEndpoint(endpoint) {
  if (endpoint && typeof endpoint === 'object') {
    return normalizeId(endpoint.id)
  }

  return normalizeId(endpoint)
}

export function normalizeId(id) {
  if (id === null || id === undefined || id === '') return null
  return String(id)
}

export function formatUnknown(value) {
  if (value === null || value === undefined || value === '') return UNKNOWN
  return String(value)
}

export function extractYear(value) {
  if (value === null || value === undefined || value === '') return null
  const match = String(value).match(/\b(19|20)\d{2}\b/)
  return match ? Number(match[0]) : null
}

// --- ENTITÀ ---
export function isArtist(node) {
  return ARTIST_TYPES.has(node.nodeTypeKey)
}

export function isSong(node) {
  return SONG_TYPES.has(node.nodeTypeKey)
}

export function isAlbum(node) {
  return ALBUM_TYPES.has(node.nodeTypeKey)
}

// --- ARTISTA ---
// MC1
export function findSailorShift(nodes) {
  return (
    nodes.find((node) => node.label.toLowerCase() === 'sailor shift') ??
    nodes.find((node) => node.label.toLowerCase().includes('sailor shift')) ??
    null
  )
}

// Generale
export function getArtists(nodes) {
  return nodes
    .filter(isArtist)
    .sort((a, b) => a.label.localeCompare(b.label))
}


export function findArtist(nodes, artistId) {
  return (
    nodes.find(
      (node) => node.id === normalizeId(artistId) && isArtist(node)
    ) ?? null
  )
}

export function countBy(items, accessor, limit = null) {
  const counts = new Map()

  for (const item of items) {
    const key = formatUnknown(accessor(item))
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const rows = Array.from(counts, ([label, value]) => ({ label, value })).sort(
    (a, b) => b.value - a.value || a.label.localeCompare(b.label),
  )

  return limit ? rows.slice(0, limit) : rows
}

// --- FILTER CONTEXT ---
export function getArtistFilterContext(graph, artistId) {
  const nodes = graph?.nodes ?? []
  const links = graph?.links ?? []

  // Nessun artista selezionato: restituiamo tutto il dataset
  if (!artistId) {
    return {
      artist: null,
      nodes,
      links,
    }
  }

  const artist = nodes.find(
    (node) =>
      node.id === String(artistId) &&
      isArtist(node),
  )

  if (!artist) {
    return {
      artist: null,
      nodes: [],
      links: [],
    }
  }

  // Trova tutti i nodi direttamente collegati all'artista
  const connectedIds = new Set([artist.id])

  links.forEach((link) => {
    if (link.source === artist.id) {
      connectedIds.add(link.target)
    }

    if (link.target === artist.id) {
      connectedIds.add(link.source)
    }
  })

  const contextNodes = nodes.filter((node) =>
    connectedIds.has(node.id),
  )

  const contextLinks = links.filter(
    (link) =>
      connectedIds.has(link.source) &&
      connectedIds.has(link.target),
  )

  return {
    artist,
    nodes: contextNodes,
    links: contextLinks,
  }
}
