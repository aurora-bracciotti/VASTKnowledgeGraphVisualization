# Project Documentation

This folder contains the documentation for the Visual Analytics course project developed for the VAST 2025 Design Challenge, focusing on Mini-Challenge 1 and the exploration of a heterogeneous music knowledge graph.

## Documents

* **[report.pdf](./report.pdf)** – Final project report describing the dataset, design goals, dashboard design, interaction model, analytical scenario, design process, limitations, and conclusions.

## Project Overview

The project presents an interactive visual analytics dashboard designed to support the discovery of new information and relationships within a music knowledge graph.

The dashboard focuses on the exploration of an artist from multiple perspectives:

* **Overview Network** – provides a global view of the knowledge graph and its structure.
* **Ego Network** – focuses on the local neighbourhood and relationships surrounding a selected entity (artist, song, album).
* **Artist Timeline** – provides a temporal perspective on the artist's works and influence relationships.
* **Filter Panel** – allows users to define and refine the analytical context.

The views are coordinated through shared filtering and selection mechanisms, allowing users to progressively move from global exploration to local relationship analysis and temporal investigation.

## Dataset

The project uses the music knowledge graph provided for VAST 2025 Mini-Challenge 1.

The dataset contains:

* **17,412 nodes**
* **37,857 links**

It represents a heterogeneous network containing artists, songs, albums, genres, musical groups, and other music-related entities connected through typed relationships.

## Dashboard and Interaction

The dashboard supports coordinated exploration through filters for:

* artist
* genre
* song
* album
* year range
* relationship type

Users can interact with the network through selection, hovering, zooming, panning, and node dragging. Selecting an artist in the Overview Network can make it the focus of the Ego Network.

The Ego Network supports exploration up to three hops from the selected artist, while the Timeline allows users to investigate works and influence relationships over time.

## Analytical Workflow

The intended workflow progresses from broad exploration to more focused analysis:

1. Select an artist and inspect the global graph context.
2. Explore relationship distributions and entity connections.
3. Investigate the selected artist's local neighbourhood through the Ego Network.
4. Select individual entities and follow relationships.
5. Use the Timeline to investigate the temporal development of the artist's career.
6. Apply filters to focus the analysis on specific genres, albums, songs, relationship types, or periods.

## Implementation

The frontend is implemented using Vue 3 and JavaScript, with the visualization system based on D3.

The main frontend source code is organized under:

```text
frontend/
└── src/
    ├── components/
    ├── data/
    └── utils/
```
