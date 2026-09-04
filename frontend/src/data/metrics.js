import { countBy, isAlbum, isArtist, isSong } from './graphTransforms.js'
import {isCreativeRoleLink, isInfluenceLink, isPerformanceLink, relationshipCategory,} from './relationship.js'

// --- INDICE DEL GRAFO ---
export function createGraphIndex(graph) {
  return {
    degreeById: computeDegrees(graph),
    adjacency: buildAdjacency(graph),
    pathAdjacency: buildPathAdjacency(graph),
    relationshipPatterns: computeRelationshipPatterns(graph),
  }
}

// --- METRICHE GLOBALI ---

// Compute degree, in-degree and out-degree
export function computeDegrees(graph) {
  const degreeById = new Map(
    graph.nodes.map((node) => [node.id, { degree: 0, inDegree: 0, outDegree: 0 }]),
  )

  for (const link of graph.links) {
    const sourceDegree = degreeById.get(link.source)
    const targetDegree = degreeById.get(link.target)

    if (sourceDegree) {
      sourceDegree.degree += 1
      sourceDegree.outDegree += 1
    }

    if (targetDegree) {
      targetDegree.degree += 1
      targetDegree.inDegree += 1
    }
  }

  return degreeById
}

// General analysis
export function computeGraphOverview(graph, artistId, options = {}) {
  const includeSupport = options.includeSupport !== false
  const degreeById = options.index?.degreeById ?? computeDegrees(graph)
  const genreNodes = []
  const topEntities = []
  const artistProfile = computeArtistProfile(graph, artistId)
  const relationshipCounts = {
    creativeRoleLinks: 0,
    performanceLinks: 0,
    membershipLinks: 0,
    distributionLinks: 0,
    influenceLinks: 0,
  }
  let artistCount = 0
  let songCount = 0
  let albumCount = 0
  let workCount = 0
  let datedWorkCount = 0
  let knownGenreWorkCount = 0

  for (const node of graph.nodes) {
    if (isArtist(node)) artistCount += 1
    if (isSong(node)) songCount += 1
    if (isAlbum(node)) albumCount += 1
    if (isSong(node) || isAlbum(node)) {
      workCount += 1
      if (node.releaseYear !== null) datedWorkCount += 1
      if (node.genre !== 'Unknown') knownGenreWorkCount += 1
    }
    if (node.genre !== 'Unknown') genreNodes.push(node)

    const degree = degreeById.get(node.id) ?? { degree: 0, inDegree: 0, outDegree: 0 }
    topEntities.push({
      id: node.id,
      label: node.label,
      nodeType: node.nodeType,
      degree: degree.degree,
      inDegree: degree.inDegree,
      outDegree: degree.outDegree,
    })
  }

  for (const link of graph.links) {
    if (isCreativeRoleLink(link)) relationshipCounts.creativeRoleLinks += 1
    if (isPerformanceLink(link)) relationshipCounts.performanceLinks += 1
    if (isInfluenceLink(link)) relationshipCounts.influenceLinks += 1
    const category = relationshipCategory(link)
    if (category === 'membership') relationshipCounts.membershipLinks += 1
    if (category === 'distribution') relationshipCounts.distributionLinks += 1
  }

  const genreCounts = countBy(genreNodes, (node) => node.genre)

  return {
    totalNodes: graph.nodes.length,
    totalLinks: graph.links.length,
    artistCount,
    songCount,
    albumCount,
    workCount,
    datedWorkCount,
    knownGenreWorkCount,
    nodeTypes: countBy(graph.nodes, (node) => node.nodeType),
    edgeTypes: countBy(graph.links, (link) => link.edgeType),
    allGenres: genreCounts,
    genres: genreCounts,
    years: includeSupport ? computeTimeline(graph, null, null, options.index?.pathAdjacency) : [],
    degreeDistribution: includeSupport ? computeDegreeDistribution(degreeById) : [],
    connectedComponents: includeSupport
      ? computeConnectedComponents(graph, options.index?.adjacency)
      : emptyConnectedComponents(),
    relationshipPatterns: options.index?.relationshipPatterns ?? computeRelationshipPatterns(graph),
    qualitySignals: includeSupport ? computeQualitySignals(graph) : emptyQualitySignals(),
    topEntities: topEntities
      .sort((a, b) => b.degree - a.degree || a.label.localeCompare(b.label))
      .slice(0, 12),
    ...relationshipCounts,
    medianDegree: computeMedianDegree(degreeById),
    maximumDegree: d3MaximumDegree(degreeById),
    degreeById,
    artistProfile,
  }
}

function emptyConnectedComponents() {
  return {
    total: 0,
    isolatedCount: 0,
    largest: null,
    components: [],
  }
}

function emptyQualitySignals() {
  return {
    chronology: { count: 0, rows: [] },
    missingYears: { count: 0, rows: [] },
    duplicates: { count: 0, rows: [] },
  }
}

// --- sTRUTTURA DEL GRAFO ---

export function computeConnectedComponents(graph, precomputedAdjacency = null) {
  const adjacency = precomputedAdjacency ?? buildAdjacency(graph)
  const visited = new Set()
  const components = []

  for (const node of graph.nodes) {
    if (visited.has(node.id)) continue

    const nodeIds = []
    const stack = [node.id]
    visited.add(node.id)

    while (stack.length) {
      const currentId = stack.pop()
      nodeIds.push(currentId)

      for (const neighborId of adjacency.get(currentId) ?? []) {
        if (!visited.has(neighborId)) {
          visited.add(neighborId)
          stack.push(neighborId)
        }
      }
    }

    const idSet = new Set(nodeIds)
    const links = graph.links.filter((link) => idSet.has(link.source) && idSet.has(link.target))
    const typeCounts = countBy(
      nodeIds.map((id) => graph.nodeById.get(id)).filter(Boolean),
      (node) => node.nodeType,
    )

    components.push({
      id: components.length + 1,
      nodeIds,
      nodeCount: nodeIds.length,
      linkCount: links.length,
      dominantType: typeCounts[0]?.label ?? 'Unknown',
    })
  }

  const sortedComponents = components.sort(
    (a, b) => b.nodeCount - a.nodeCount || b.linkCount - a.linkCount || a.id - b.id,
  )

  return {
    total: sortedComponents.length,
    isolatedCount: sortedComponents.filter((component) => component.nodeCount === 1).length,
    largest: sortedComponents[0] ?? null,
    components: sortedComponents,
  }
}

export function computeRelationshipPatterns(graph) {
  const counts = new Map()
  const sourceCounts = new Map()
  const edgeCounts = new Map()
  const targetCounts = new Map()
  const sourceToEdgeCounts = new Map()
  const edgeToTargetCounts = new Map()

  const seenUndirectedEdges = new Set()

  for (const link of graph.links) {
    const edgeType = link.edgeType ?? 'Unknown'
    const [nodeA, nodeB] = [link.source, link.target].sort()
    const undirectedKey = `${edgeType}|${nodeA}|${nodeB}`

    if (seenUndirectedEdges.has(undirectedKey)) continue
    seenUndirectedEdges.add(undirectedKey)

    const sourceType = link.sourceNode?.nodeType ?? 'Unknown'
    const targetType = link.targetNode?.nodeType ?? 'Unknown'
    const key = `${sourceType}|${edgeType}|${targetType}`
    const row = counts.get(key) ?? {
      key,
      sourceType,
      edgeType,
      targetType,
      value: 0,
    }
    row.value += 1
    counts.set(key, row)

    incrementCount(sourceCounts, sourceType, 'sourceType')
    incrementCount(edgeCounts, edgeType, 'edgeType')
    incrementCount(targetCounts, targetType, 'targetType')
    incrementPairCount(sourceToEdgeCounts, sourceType, edgeType)
    incrementPairCount(edgeToTargetCounts, edgeType, targetType)
  }

  const patterns = Array.from(counts.values()).sort(
    (a, b) =>
      b.value - a.value ||
      a.sourceType.localeCompare(b.sourceType) ||
      a.edgeType.localeCompare(b.edgeType) ||
      a.targetType.localeCompare(b.targetType),
  )

  return {
    patterns,
    sourceOptions: sortedCountRows(sourceCounts),
    edgeOptions: sortedCountRows(edgeCounts),
    targetOptions: sortedCountRows(targetCounts),
    sourceToEdge: sortedPairRows(sourceToEdgeCounts),
    edgeToTarget: sortedPairRows(edgeToTargetCounts),
    total: patterns.length,
    maximum: patterns[0]?.value ?? 0,
  }
}

function incrementCount(counts, key, field) {
  const row = counts.get(key) ?? { key, field, value: 0 }
  row.value += 1
  counts.set(key, row)
}

function incrementPairCount(counts, from, to) {
  const key = `${from}|${to}`
  const row = counts.get(key) ?? { key, from, to, value: 0 }
  row.value += 1
  counts.set(key, row)
}

function sortedCountRows(counts) {
  return Array.from(counts.values()).sort(
    (a, b) => b.value - a.value || String(a.key).localeCompare(String(b.key)),
  )
}

function sortedPairRows(counts) {
  return Array.from(counts.values()).sort(
    (a, b) =>
      b.value - a.value ||
      String(a.from).localeCompare(String(b.from)) ||
      String(a.to).localeCompare(String(b.to)),
  )
}

// --- QUALITÀ DATI

export function computeQualitySignals(graph) {
  const chronologyRows = []
  const missingYearRows = []
  const duplicateGroups = new Map()

  for (const link of graph.links) {
    if (isInfluenceLink(link)) {
      const sourceYear = link.sourceNode?.releaseYear ?? null
      const targetYear = link.targetNode?.releaseYear ?? null
      if (!sourceYear || !targetYear) {
        missingYearRows.push({
          key: `missing-${link.id}`,
          link,
          detail: `${sourceYear ?? '?'} -> ${targetYear ?? '?'}`,
        })
      } else if (sourceYear < targetYear) {
        chronologyRows.push({
          key: `chronology-${link.id}`,
          link,
          detail: `${sourceYear} -> ${targetYear}`,
        })
      }
    }

    const duplicateKey = `${link.source}|${link.edgeType}|${link.target}`
    if (!duplicateGroups.has(duplicateKey)) duplicateGroups.set(duplicateKey, [])
    duplicateGroups.get(duplicateKey).push(link)
  }

  const duplicateRows = Array.from(duplicateGroups.values())
    .filter((links) => links.length > 1)
    .map((links) => ({
      key: `duplicate-${links[0].id}`,
      link: links[0],
      detail: `${links.length} records`,
    }))

  return {
    chronology: { count: chronologyRows.length, rows: chronologyRows },
    missingYears: { count: missingYearRows.length, rows: missingYearRows },
    duplicates: { count: duplicateRows.length, rows: duplicateRows },
  }
}

// Global statistics for histrogram
export function computeDegreeDistribution(degreeById) {
  const bins = [
    { label: '0', min: 0, max: 0, value: 0 },
    { label: '1', min: 1, max: 1, value: 0 },
    { label: '2-3', min: 2, max: 3, value: 0 },
    { label: '4-7', min: 4, max: 7, value: 0 },
    { label: '8-15', min: 8, max: 15, value: 0 },
    { label: '16-31', min: 16, max: 31, value: 0 },
    { label: '32-63', min: 32, max: 63, value: 0 },
    { label: '64+', min: 64, max: null, value: 0 },
  ]

  for (const degree of degreeById.values()) {
    const bin = bins.find(
      (candidate) =>
        degree.degree >= candidate.min &&
        (candidate.max === null || degree.degree <= candidate.max),
    )
    if (bin) bin.value += 1
  }

  return bins
}

// --- TIMELINE ---
export function computeTimeline(graph, artistId = null, focusGenre = null, precomputedPathAdjacency = null) {
  const byYear = new Map()
  const pathAdjacency = precomputedPathAdjacency ?? buildPathAdjacency(graph)

  const selectedArtist = artistId ? graph.nodeById.get(artistId) : null

  // Genere di riferimento
  const effectiveFocusGenre = focusGenre ?? computeArtistProfile(graph, artistId)?.genreCounts?.[0]?.label ?? null

  // Opere artista selezionato
  const selectedArtistWorkIds = new Set()

  if (selectedArtist && isArtist(selectedArtist)) {
    for (const link of graph.links) {
      if (!isCreativeRoleLink(link) && !isPerformanceLink(link)) {
        continue
      }

      if (link.source === artistId) {
        const targetNode = graph.nodeById.get(link.target)

        if (targetNode && (isSong(targetNode) || isAlbum(targetNode))) {
          selectedArtistWorkIds.add(targetNode.id)
        }
      }

      if (link.target === artistId) {
        const sourceNode = graph.nodeById.get(link.source)

        if (sourceNode && (isSong(sourceNode) || isAlbum(sourceNode))) {
          selectedArtistWorkIds.add(sourceNode.id)
        }
      }
    }
  }

  for (const node of graph.nodes) {
    if (!node.releaseYear ||(!isSong(node) && !isAlbum(node))) {
      continue
    }

    const row = getTimelineRow(
      byYear,
      node.releaseYear,
    )

    // Opere dell'artista selezionato
    if (selectedArtistWorkIds.has(node.id)) {
      row.works += 1

      row.workItems.push({
        id: node.id,
        label: node.label,
        nodeType: node.nodeType,
        genre: node.genre,
        year: node.releaseYear,
        contributors: getWorkContributors(graph, node.id, pathAdjacency),
        influences: getWorkInfluenceDetails(graph, node.id, pathAdjacency),
      })

      if (isSong(node)) {
        row.songs += 1
      }

      if (isAlbum(node)) {
        row.albums += 1
      }
    }

    // Attività globale del genere selezionato
    if (effectiveFocusGenre && node.genre === effectiveFocusGenre) {
      row.genreWorks += 1

      if (selectedArtistWorkIds.has(node.id)) {
        row.artistGenreWorks += 1
      }
    }
  }

  // Relazioni artista e influenze
  for (const link of graph.links) {
    if (!artistId) continue

    const linkIsInfluence = isInfluenceLink(link)

    // Relazione diretta con l'artista
    const directArtistLink = link.source === artistId || link.target === artistId

    // Le influence collegano due opere. Controlla quindi se almeno una delle due opere appartiene al catalogo dell'artista selezionato
    const artistWorkInfluence = linkIsInfluence && (selectedArtistWorkIds.has(link.source) || selectedArtistWorkIds.has(link.target))

    if (!directArtistLink && !artistWorkInfluence) {
      continue
    }

    // Recuperiamo i veri nodi source e target
    const sourceNode = graph.nodeById.get(link.source)

    const targetNode = graph.nodeById.get(link.target)

    if (!sourceNode || !targetNode) {
      continue
    }

    // Anno della relazione
    let year = null

    if (artistWorkInfluence) {
      // Se è un'influence, usiamo l'anno dell'opera appartenente all'artista selezionato
      const ownNode = selectedArtistWorkIds.has(link.source) ? sourceNode: targetNode

      year = ownNode.releaseYear
    } else if (isSong(sourceNode) || isAlbum(sourceNode)) {
      year = sourceNode.releaseYear
    } else if (isSong(targetNode) || isAlbum(targetNode)) {
      year = targetNode.releaseYear
    }

    if (!year) {
      continue
    }

    const row = getTimelineRow(
      byYear,
      year,
    )

    // Conteggi
    row.artistLinks += 1

    if (isCreativeRoleLink(link)) {
      row.artistCreativeRoles += 1
    }

    if (isPerformanceLink(link)) {
      row.artistPerformances += 1
    }

    if (linkIsInfluence) {
      row.artistInfluences += 1

      row.influenceItems.push({
        id: link.id,

        // Nome del nodo source
        sourceLabel: sourceNode.label ?? sourceNode.name ?? 'Unknown',

        // Nome del nodo target
        targetLabel: targetNode.label ?? targetNode.name ?? 'Unknown',

        // Tipo della relazione
        edgeType: link.edgeTypeKey ?? link.edgeType ?? 'Unknown',
      })
    }
  }

  return Array.from(byYear.values()).sort(
    (a, b) => a.year - b.year,
  )
}
 
// --- SOTTOGRAFI ---
export function buildNodeLinkSubgraph(graph, nodeLimit = 100, degreeRange = {}, precomputedDegreeById = null) {
  if (!graph) {
    return {
      nodes: [],
      links: [],
      totalNodes: 0,
      totalLinks: 0,
      matchingNodes: 0,
      nodeLimit,
      degreeMin: 0,
      degreeMax: 0,
    }
  }

  const degreeById = precomputedDegreeById ?? computeDegrees(graph)
  const degrees = Array.from(degreeById.values(), (row) => row.degree)
  const graphMaxDegree = d3MaximumDegree(degreeById)
  const degreeMin = Math.max(0, Number(degreeRange.min ?? 0))
  const degreeMax = Math.min(
    graphMaxDegree,
    Number.isFinite(Number(degreeRange.max)) ? Number(degreeRange.max) : graphMaxDegree,
  )
  const candidates = graph.nodes
    .map((node) => ({ id: node.id, degree: degreeById.get(node.id)?.degree ?? 0, label: node.label }))
    .filter((node) => node.degree >= degreeMin && node.degree <= degreeMax)
    .sort((a, b) => b.degree - a.degree || a.label.localeCompare(b.label))

  const selectedIds = candidates.slice(0, nodeLimit).map((node) => node.id)
  const selected = new Set(selectedIds)

  return {
    nodes: graph.nodes
      .filter((node) => selected.has(node.id))
      .map((node) => ({
        ...node,
        degree: degreeById.get(node.id)?.degree ?? 0,
      })),
    links: graph.links.filter((link) => selected.has(link.source) && selected.has(link.target)),
    totalNodes: graph.nodes.length,
    totalLinks: graph.links.length,
    matchingNodes: candidates.length,
    nodeLimit,
    degreeMin,
    degreeMax,
    graphMinDegree: degrees.length ? Math.min(...degrees) : 0,
    graphMaxDegree,
  }
}

// --- EGONETWORK ---
export function buildEgoNetwork(
  graph,
  centerId,
  depth = 1,
  nodeLimit = 50,
  precomputedDegreeById = null,
  precomputedAdjacency = null,
  options = {},
) {
  if (!centerId) return { nodes: [], links: [] }

  // Opzione per filtrare in base al filtro della relazione
  const { relationshipType = null, pathAdjacency = null } = options

  const adjacency = relationshipType ? buildFilteredAdjacency(graph, relationshipType, pathAdjacency) : precomputedAdjacency ?? buildAdjacency(graph)

  const distanceById = new Map([[centerId, 0]])
  let frontier = [centerId]

  for (let currentDepth = 0; currentDepth < depth; currentDepth += 1) {
    const next = []
    for (const id of frontier) {
      for (const neighborId of adjacency.get(id) ?? []) {
        if (!distanceById.has(neighborId)) {
          distanceById.set(neighborId, currentDepth + 1)
          next.push(neighborId)
        }
      }
    }
    frontier = next
  }

  const degreeById = precomputedDegreeById ?? computeDegrees(graph)
  const selectedIds = Array.from(distanceById.keys())
    .sort((a, b) => {
      const distanceDiff = distanceById.get(a) - distanceById.get(b)
      if (distanceDiff !== 0) return distanceDiff
      return (degreeById.get(b)?.degree ?? 0) - (degreeById.get(a)?.degree ?? 0)
    })
    .slice(0, nodeLimit)

  const selected = new Set(selectedIds)

  return {
    nodes: graph.nodes
      .filter((node) => selected.has(node.id))
      .map((node) => ({
        ...node,
        distance: distanceById.get(node.id),
        degree: degreeById.get(node.id)?.degree ?? 0,
      })),
    links: graph.links.filter(
      (link) => selected.has(link.source) && selected.has(link.target) && (!relationshipType || link.edgeType === relationshipType),
    ),
  }
}

export function findShortestPath(graph, sourceId, targetId, maxDepth = 6, precomputedAdjacency = null) {
  if (!graph || !sourceId || !targetId) return null
  if (sourceId === targetId) {
    const node = graph.nodeById.get(sourceId)
    return node ? { nodes: [node], links: [], hopCount: 0 } : null
  }
  if (!graph.nodeById.has(sourceId) || !graph.nodeById.has(targetId)) return null

  const adjacency = precomputedAdjacency ?? buildPathAdjacency(graph)

  const queue = [{ id: sourceId, depth: 0 }]
  const visited = new Set([sourceId])
  const previous = new Map()

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index]
    if (current.depth >= maxDepth) continue

    for (const step of adjacency.get(current.id) ?? []) {
      if (visited.has(step.neighborId)) continue
      visited.add(step.neighborId)
      previous.set(step.neighborId, { nodeId: current.id, link: step.link })

      if (step.neighborId === targetId) {
        return reconstructPath(graph, sourceId, targetId, previous)
      }

      queue.push({ id: step.neighborId, depth: current.depth + 1 })
    }
  }

  return null
}

// --- ANALISI ARTISTA ---
export function computeArtistProfile(graph, artistId) {
  const node = graph?.nodeById.get(artistId)
  if (!graph || !node || !isArtist(node)) return null

  const adjacentLinks = graph.links.filter(
    (link) => link.source === artistId || link.target === artistId,
  )
  const workIds = new Set()

  for (const link of adjacentLinks) {
    const otherId = link.source === artistId ? link.target : link.source
    const otherNode = graph.nodeById.get(otherId)
    if (otherNode && (isSong(otherNode) || isAlbum(otherNode))) workIds.add(otherId)
  }

  const works = Array.from(workIds, (id) => graph.nodeById.get(id)).filter(Boolean)
  const years = new Set(works.map((work) => work.releaseYear).filter(Boolean))

  const influenceLinkCount = graph.links.filter(
    (link) => isInfluenceLink(link) && (workIds.has(link.source) || workIds.has(link.target)),
  ).length

  return {
    node,
    workIds,
    workCount: works.length,
    genreCounts: countBy(works, (work) => work.genre),
    creativeRoleLinks: adjacentLinks.filter(isCreativeRoleLink).length,
    performanceLinks: adjacentLinks.filter(isPerformanceLink).length,
    membershipLinks: adjacentLinks.filter(
      (link) => relationshipCategory(link) === 'membership',
    ).length,
    influenceLinks: influenceLinkCount,
    activeYearCount: years.size,
    firstYear: years.size ? Math.min(...years) : null,
    lastYear: years.size ? Math.max(...years) : null,
    degree: adjacentLinks.length,
  }
}

// --- INFLUENCE RICEVUTE / DATE DALL'ARTISTA SELEZIONATO ---
export function computeArtistInfluenceNetwork(graph, artistId, focusGenre = null, precomputedPathAdjacency = null) {
  const empty = {
    focusGenre,
    byYear: [],
    receivedFrom: [],
    givenTo: [],
    totalReceived: 0,
    totalGiven: 0,
  }

  const node = graph?.nodeById.get(artistId)
  if (!graph || !node || !isArtist(node)) return empty

  const adjacentLinks = graph.links.filter(
    (link) => link.source === artistId || link.target === artistId,
  )
  const workIds = new Set()

  for (const link of adjacentLinks) {
    const otherId = link.source === artistId ? link.target : link.source
    const otherNode = graph.nodeById.get(otherId)
    if (otherNode && (isSong(otherNode) || isAlbum(otherNode))) workIds.add(otherId)
  }

  const byYear = new Map()
  const receivedFrom = new Map()
  const givenTo = new Map()
  
  const pathAdjacency = precomputedPathAdjacency ?? buildPathAdjacency(graph)

  function yearRow(year) {
    if (!byYear.has(year)) byYear.set(year, { year, received: 0, given: 0 })
    return byYear.get(year)
  }

  function addArtistCount(map, id, label) {
    const row = map.get(id) ?? { id, label, value: 0 }
    row.value += 1
    map.set(id, row)
  }

  for (const link of graph.links) {
    if (!isInfluenceLink(link)) continue

    const sourceIsOwn = workIds.has(link.source)
    const targetIsOwn = workIds.has(link.target)
    if (!sourceIsOwn && !targetIsOwn) continue

    const sourceNode = graph.nodeById.get(link.source)
    const targetNode = graph.nodeById.get(link.target)
    if (!sourceNode || !targetNode) continue

    const ownNode = sourceIsOwn ? sourceNode : targetNode
    if (ownNode.releaseYear) {
      const row = yearRow(ownNode.releaseYear)
      if (sourceIsOwn) row.received += 1 // la mia opera (source) deriva da target
      if (targetIsOwn) row.given += 1 // la mia opera (target) ha influenzato source
    }

    // Ricevute: una mia opera (source) deriva da/è influenzata da targetNode
    if (sourceIsOwn) {
      for (const otherId of getWorkArtistIds(graph, targetNode.id, pathAdjacency)) {
        if (otherId === artistId) continue
        const otherArtist = graph.nodeById.get(otherId)
        if (!otherArtist) continue
        addArtistCount(receivedFrom, otherId, otherArtist.label ?? otherArtist.name ?? otherId)
      }
    }

    // Se impostato un genere di riferimento, contiamo solo le opere source di quel genere (i "collaboratori del genere principale")
    if (targetIsOwn && (!focusGenre || sourceNode.genre === focusGenre)) {
      for (const otherId of getWorkArtistIds(graph, sourceNode.id, pathAdjacency)) {
        if (otherId === artistId) continue
        const otherArtist = graph.nodeById.get(otherId)
        if (!otherArtist) continue
        addArtistCount(givenTo, otherId, otherArtist.label ?? otherArtist.name ?? otherId)
      }
    }
  }

  function sortRows(map) {
    return Array.from(map.values()).sort(
      (a, b) => b.value - a.value || a.label.localeCompare(b.label),
    )
  }

  const byYearRows = Array.from(byYear.values()).sort((a, b) => a.year - b.year)

  return {
    focusGenre,
    byYear: byYearRows,
    receivedFrom: sortRows(receivedFrom),
    givenTo: sortRows(givenTo),
    totalReceived: byYearRows.reduce((sum, row) => sum + row.received, 0),
    totalGiven: byYearRows.reduce((sum, row) => sum + row.given, 0),
  }
}

export function findArtistComparators(graph, artistId, genre = null, limit = 5) {
  const focusProfile = computeArtistProfile(graph, artistId)
  
  const filteredFocusWorks = genre ? focusWorks.filter((work) => work.genre === genre) : focusWorks
  if (!focusProfile) return []
  
  const focusWorks = Array.from(focusProfile.workIds)
    .map((id) => graph.nodeById.get(id))
    .filter(Boolean)

  const focusGenres = new Set(
  filteredFocusWorks
    .map((work) => work.genre)
    .filter((value) => value && value !== 'Unknown'),
)

  const focusWorkIds = new Set(
    filteredFocusWorks.map((work) => work.id),
  )

  const candidateIds = new Set()

  for (const link of graph.links) {
    if (focusWorkIds.has(link.source)) {
      const candidate = graph.nodeById.get(link.target)

      if (candidate && isArtist(candidate) && candidate.id !== artistId) {
        candidateIds.add(candidate.id)
      }
    }

    if (focusWorkIds.has(link.target)) {
      const candidate = graph.nodeById.get(link.source)

      if (candidate && isArtist(candidate) &&candidate.id !== artistId) {
        candidateIds.add(candidate.id)
      }
    }
  }

  return Array.from(candidateIds)
    .map((candidateId) => {
      const profile = computeArtistProfile(graph, candidateId)

      if (!profile) return null

      const candidateWorks = Array.from(profile.workIds)
        .map((id) => graph.nodeById.get(id))
        .filter(Boolean)

      const candidateFilteredWorks = genre ? candidateWorks.filter((work) => work.genre === genre) : candidateWorks

      const candidateWorkIds = new Set(
        candidateFilteredWorks.map((work) => work.id),
      )

      const sharedWorks = [...focusWorkIds].filter((id) =>
        candidateWorkIds.has(id),
      ).length

      const candidateGenres = new Set(
        candidateWorks
          .map((work) => work.genre)
          .filter((value) => value && value !== 'Unknown'),
      )

      const sharedGenres = [...focusGenres].filter((value) =>
        candidateGenres.has(value),
      ).length

      const similarity = sharedWorks * 10 + sharedGenres * 2

      return {
        ...profile,
        sharedWorks,
        sharedGenres,
        similarity,
        genre: genre ?? 'All',
      }
    })
    .filter(Boolean)
    .filter((profile) => profile.sharedWorks > 0 || profile.sharedGenres > 0)
    .sort(
      (a, b) => b.similarity - a.similarity || b.sharedWorks - a.sharedWorks || a.node.label.localeCompare(b.node.label),
    )
    .slice(0, limit)
}

// --- FUNZIONI DI UTILITÀ ---
function reconstructPath(graph, sourceId, targetId, previous) {
  const nodeIds = [targetId]
  const links = []
  let currentId = targetId

  while (currentId !== sourceId) {
    const step = previous.get(currentId)
    if (!step) return null
    links.unshift(step.link)
    currentId = step.nodeId
    nodeIds.unshift(currentId)
  }

  return {
    nodes: nodeIds.map((id) => graph.nodeById.get(id)).filter(Boolean),
    links,
    hopCount: links.length,
  }
}

function buildAdjacency(graph) {
  const adjacency = new Map(graph.nodes.map((node) => [node.id, new Set()]))

  for (const link of graph.links) {
    adjacency.get(link.source)?.add(link.target)
    adjacency.get(link.target)?.add(link.source)
  }

  return adjacency
}

export function buildPathAdjacency(graph) {
  const adjacency = new Map(graph.nodes.map((node) => [node.id, []]))

  for (const link of graph.links) {
    adjacency.get(link.source)?.push({ neighborId: link.target, link })
    adjacency.get(link.target)?.push({ neighborId: link.source, link })
  }

  return adjacency
}

function buildFilteredAdjacency(graph, relationshipType, precomputedPathAdjacency = null) {
  const pathAdjacency = precomputedPathAdjacency ?? buildPathAdjacency(graph)
  const adjacency = new Map(graph.nodes.map((node) => [node.id, new Set()]))

  for (const [nodeId, entries] of pathAdjacency) {
    for (const { neighborId, link } of entries) {
      if (link.edgeType === relationshipType) {
        adjacency.get(nodeId)?.add(neighborId)
      }
    }
  }

  return adjacency
}

function computeMedianDegree(degreeById) {
  const values = Array.from(degreeById.values(), (row) => row.degree).sort((a, b) => a - b)
  if (!values.length) return 0
  const middle = Math.floor(values.length / 2)
  return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2
}

function d3MaximumDegree(degreeById) {
  let maximum = 0
  for (const row of degreeById.values()) maximum = Math.max(maximum, row.degree)
  return maximum
}

function getTimelineRow(byYear, year) {
  if (!byYear.has(year)) {
    byYear.set(year, {
      year,

      // Opere
      works: 0,
      songs: 0,
      albums: 0,
      workItems: [],

      // Relazioni dell'artista
      artistLinks: 0,
      artistCreativeRoles: 0,
      artistPerformances: 0,

      // Influence
      artistInfluences: 0,
      influenceItems: [],

      // Genere
      genreWorks: 0,
      artistGenreWorks: 0,
    })
  }

  return byYear.get(year)
}

export function computeGenreYearCounts(graph, genre) {
  if (!graph || !genre) return []
  const byYear = new Map()

  for (const node of graph.nodes) {
    if (!(isSong(node) || isAlbum(node))) continue
    if (node.genre !== genre) continue
    if (!node.releaseYear) continue
    byYear.set(node.releaseYear, (byYear.get(node.releaseYear) ?? 0) + 1)
  }

  return Array.from(byYear.entries())
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => a.year - b.year)
}

export function listGenres(graph) {
  if (!graph) return []
  const works = graph.nodes.filter(
    (node) => (isSong(node) || isAlbum(node)) && node.genre && node.genre !== 'Unknown',
  )
  return countBy(works, (node) => node.genre)
}

export function getGenreCandidates(graph, artistId) {
  const profile = computeArtistProfile(graph, artistId)
  return profile?.genreCounts ?? []
}

export function computeGenreInfluence(graph, genre, options = {}) {
  const { minYear = null, maxYear = null, precomputedPathAdjacency = null } = options

  if (!graph || !genre) {
    return {
      genre: null,
      minYear,
      maxYear,
      overTime: [],
      totalGiven: 0,
      totalReceived: 0,
      totalIncident: 0,
      topInfluencedArtists: [],
      influencedGenres: [],
      influencingGenres: [],
    }
  }

  const byYear = new Map()
  const influencedArtists = new Map()
  const influencedGenres = new Map()
  const influencingGenres = new Map()

  let totalGiven = 0
  let totalReceived = 0
  let totalIncident = 0

  const pathAdjacency = precomputedPathAdjacency ?? buildPathAdjacency(graph)

  function addCount(map, key, label = key) {
    if (!key || key === 'Unknown') return

    const row = map.get(key) ?? {
      id: key,
      label,
      value: 0,
    }

    row.value += 1
    map.set(key, row)
  }

  function addYear(year, given, received) {
    if (!year) return

    const row = byYear.get(year) ?? {
      year,
      given: 0,
      received: 0,
      total: 0,
    }

    row.given += given
    row.received += received

    row.total += 1

    byYear.set(year, row)
  }

  for (const link of graph.links) {
    if (!isInfluenceLink(link)) continue

    const sourceNode = graph.nodeById.get(link.source)
    const targetNode = graph.nodeById.get(link.target)

    if (!sourceNode || !targetNode) continue

    if (!isSong(sourceNode) && !isAlbum(sourceNode)) {
      continue
    }

    if (!isSong(targetNode) && !isAlbum(targetNode)) {
      continue
    }

    const sourceIsGenre = sourceNode.genre === genre

    const targetIsGenre = targetNode.genre === genre

    if (!sourceIsGenre && !targetIsGenre) {
      continue
    }
    const genreNode = sourceIsGenre ? sourceNode : targetNode

    const genreYear = genreNode.releaseYear ?? null

    if (minYear !== null && (!genreYear || genreYear < minYear)) continue
    if (maxYear !== null && (!genreYear || genreYear > maxYear)) continue

    // targetIsGenre: target è l'originale, ha DATO Influenza a sourceNode
    // sourceIsGenre: source è il Derivato, ha RICEVUTO influenza da targetNode
    addYear(
      genreYear,
      targetIsGenre ? 1 : 0,
      sourceIsGenre ? 1 : 0,
    )

    totalIncident += 1

    if (targetIsGenre) {
      totalGiven += 1

      // Artisti proprietari dell'opera derivata (influenzata dalla mia)
      const sourceArtistIds =
        getWorkArtistIds(
          graph,
          sourceNode.id,
          pathAdjacency,
        )

      for (const artistId of sourceArtistIds) {
        const artistNode =
          graph.nodeById.get(artistId)

        if (!artistNode) continue

        addCount(
          influencedArtists,
          artistNode.id,
          artistNode.label ??
            artistNode.name ??
            artistNode.id,
        )
      }

      if (sourceNode.genre && sourceNode.genre !== 'Unknown'
      ) {
        addCount(
          influencedGenres,
          sourceNode.genre,
          sourceNode.genre,
        )
      }
    }
    if (sourceIsGenre) {
      totalReceived += 1

      if (targetNode.genre && targetNode.genre !== 'Unknown'
      ) {
        addCount(
          influencingGenres,
          targetNode.genre,
          targetNode.genre,
        )
      }
    }
  }

  function sortRows(map) {
    return Array.from(map.values()).sort(
      (a, b) =>
        b.value - a.value ||
        a.label.localeCompare(b.label),
    )
  }

  return {
    genre,
    minYear,
    maxYear,

    overTime: Array.from(
      byYear.values(),
    ).sort(
      (a, b) => a.year - b.year,
    ),

    totalGiven,
    totalReceived,
    totalIncident,

    topInfluencedArtists:
      sortRows(
        influencedArtists,
      ).slice(0, 8),

    influencedGenres:
      sortRows(
        influencedGenres,
      ).slice(0, 8),

    influencingGenres:
      sortRows(
        influencingGenres,
      ).slice(0, 8),
  }
}

// --- ARTISTI E COLLABORATORI ---
function isArtistOrGroup(node) {
  return Boolean(node) && (isArtist(node) || node.nodeTypeKey === 'musicalgroup')
}

export function getWorkContributors(graph, workId, precomputedPathAdjacency = null) {
  const contributors = new Map()
  const pathAdjacency = precomputedPathAdjacency ?? buildPathAdjacency(graph)
  const entries = pathAdjacency.get(workId) ?? []

  for (const { neighborId, link } of entries) {
    if (!isCreativeRoleLink(link) && !isPerformanceLink(link)) continue

    const otherNode = graph.nodeById.get(neighborId)
    if (!isArtistOrGroup(otherNode)) continue

    const role = link.edgeTypeKey ?? link.edgeType ?? 'Unknown'
    const key = `${otherNode.id}|${role}`

    if (!contributors.has(key)) {
      contributors.set(key, {
        id: otherNode.id,
        name: otherNode.label ?? otherNode.name ?? otherNode.id,
        role,
      })
    }
  }

  return Array.from(contributors.values())
}

export function getWorkInfluenceDetails(graph, workId, precomputedPathAdjacency = null) {
  const received = []
  const given = []
  const pathAdjacency = precomputedPathAdjacency ?? buildPathAdjacency(graph)
  const entries = pathAdjacency.get(workId) ?? []

  for (const { link } of entries) {
    if (!isInfluenceLink(link)) continue

    const role = link.edgeTypeKey ?? link.edgeType ?? 'Unknown'

    if (link.source === workId) {
      // Quest'opera (source) deriva da/è influenzata da targetNode: RICEVUTA.
      const targetNode = graph.nodeById.get(link.target)
      if (!targetNode) continue
      received.push({
        id: targetNode.id,
        name: targetNode.label ?? targetNode.name ?? targetNode.id,
        role,
        year: targetNode.releaseYear ?? null,
        genre: targetNode.genre ?? 'Unknown',
      })
    }

    if (link.target === workId) {
      // Quest'opera (target) ha influenzato sourceNode: DATA.
      const sourceNode = graph.nodeById.get(link.source)
      if (!sourceNode) continue
      given.push({
        id: sourceNode.id,
        name: sourceNode.label ?? sourceNode.name ?? sourceNode.id,
        role,
        year: sourceNode.releaseYear ?? null,
        genre: sourceNode.genre ?? 'Unknown',
      })
    }
  }

  return { received, given }
}

export function getWorkArtistIds(graph, workId, precomputedPathAdjacency = null) {
  const artistIds = new Set()
  const pathAdjacency = precomputedPathAdjacency ?? buildPathAdjacency(graph)
  const entries = pathAdjacency.get(workId) ?? []

  for (const { neighborId, link } of entries) {
    if (!isCreativeRoleLink(link) && !isPerformanceLink(link)) {
      continue
    }

    const node = graph.nodeById.get(neighborId)

    if (isArtistOrGroup(node)) {
      artistIds.add(node.id)
    }
  }

  return artistIds
}
