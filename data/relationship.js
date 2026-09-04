export const RELATIONSHIP_CATEGORIES = {
  creative: {
    label: 'Creative role',
    tokens: ['composer', 'producer', 'lyricist'],
    dash: '',
  },
  performance: {
    label: 'Performance / recording',
    tokens: ['performer', 'recorded'],
    dash: '2 4',
  },
  membership: {
    label: 'Group membership',
    tokens: ['member'],
    dash: '9 3',
  },
  distribution: {
    label: 'Distribution',
    tokens: ['distributed'],
    dash: '9 3 2 3',
  },
  influence: {
    label: 'Influence / reference',
    tokens: ['style', 'interpolates', 'reference', 'cover', 'sample'],
    dash: '5 5',
  },
  other: {
    label: 'Other',
    tokens: [],
    dash: '1 5',
  },
}

export const RELATIONSHIP_CATEGORY_ORDER = [
  'creative',
  'performance',
  'membership',
  'distribution',
  'influence',
  'other',
]

export function relationshipCategory(link) {
  const type = String(link?.edgeTypeKey ?? link?.edgeType ?? '').toLowerCase()

  return (
    RELATIONSHIP_CATEGORY_ORDER.find(
      (category) =>
        category !== 'other' &&
        RELATIONSHIP_CATEGORIES[category].tokens.some((token) => type.includes(token)),
    ) ?? 'other'
  )
}

export function relationshipMatchesCategory(link, category) {
  return category === 'all' || relationshipCategory(link) === category
}

export function relationshipDash(link) {
  return RELATIONSHIP_CATEGORIES[relationshipCategory(link)].dash
}

export function isCreativeRoleLink(link) {
  return relationshipCategory(link) === 'creative'
}

export function isPerformanceLink(link) {
  return relationshipCategory(link) === 'performance'
}

export function isInfluenceLink(link) {
  return relationshipCategory(link) === 'influence'
}
