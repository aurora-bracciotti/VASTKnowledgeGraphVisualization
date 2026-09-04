# VAST 2025 Knowledge Graph Visualization — Frontend

This directory contains the frontend of the interactive visual analytics prototype developed for the **VAST 2025 Design Challenge**.

The application is built with **Vue 3**, **Vite**, and **D3.js**, and provides an interactive interface for exploring the knowledge graph through multiple coordinated visualizations, filtering mechanisms, and analytical views.

## Structure

### `src/components/`

The `components/` directory contains the Vue components that implement the main visual analytics interface.

- `Dashboard.vue`: main container of the application, coordinating the different analytical panels and the overall interaction workflow;
- `DashboardCard.vue`: reusable card component used to organize visualizations and analytical elements within the dashboard;
- `FilterPanel.vue`: provides controls for filtering the knowledge graph and updating the information displayed in the visualizations;
- `OverviewPanel.vue`: presents an overview of the knowledge graph through a collection of complementary visualizations;
- `EgoNetworkPanel.vue`: provides a focused view of the local network surrounding a selected entity;
- `TimelinePanel.vue`: supports the exploration of temporal information associated with the knowledge graph.

#### `src/components/overview/`

The `overview/` directory contains the individual visualizations used in the overview panel:

- `ConnectedComponentChart.vue`: visualizes the connected components of the graph;
- `DegreeDistributionChart.vue`: shows the distribution of node degrees in the knowledge graph;
- `EntityCompositionChart.vue`: represents the composition of the graph according to entity types;
- `GenreCompositionChart.vue`: visualizes the distribution of genres represented in the graph;
- `NodeLinkDiagram.vue`: provides a node-link representation of the knowledge graph;
- `RelationshipFlowChart.vue`: visualizes the flow and distribution of relationships between entity types;
- `RelationshipTypesChart.vue`: summarizes the different types of relationships present in the graph.

Together, these components provide complementary views of the graph structure, composition, and relationships, supporting both high-level analysis and more detailed exploration.

### `src/data/`

The `data/` directory contains the JavaScript modules responsible for loading, transforming, and analysing the knowledge graph data.

- `graphLoader.js`: handles the loading of the knowledge graph data used by the application;
- `graphTransforms.js`: provides transformations of the graph data required by the visualizations and analytical views;
- `metrics.js`: contains functions for computing graph-related metrics and derived information;
- `relationship.js`: defines and handles relationship information used throughout the visual analytics interface.

These modules separate data processing and analytical logic from the Vue components, allowing the visualizations to operate on consistent graph data and derived measures.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Compile and Minify for Production

```sh
npm run build
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```
