# VAST Knowledge Graph Visualization

Collaborative project developed by students of the **Course on Visual Analytics** in response to the **VAST Challenge 2025 – Design Challenge**.

> Challenge page: https://vast-challenge.github.io/2025/DC.html

## Overview

This repository is intended to host the research, design material, prototypes, and documentation produced for the 2025 VAST Design Challenge using dataset from Mini-Challange 1. The challenge asks participants to conceive a **visual analytics design for knowledge graphs** that helps non-expert users and expert to discover new information or relationships,

Knowledge graphs combine graph structure with rich, heterogeneous node and edge attributes. This creates important visualization challenges related to scale, uncertainty, incomplete information, and interpretability. Our project explores how visual analytics can support these tasks through an accessible and well-justified design.

## Project Goals

The main goals of this collaborative project are to:

1. study the VAST 2025 Design Challenge requirements ;
2. investigate visual encodings and interaction techniques for knowledge-graph exploration;
3. design a visual analytics solution that supports the challenge tasks;
4. document the design rationale, limitations, and intended user workflow;
5. coordinate the contributions of the student team.

## Challenge Context

According to the challenge brief, the final submission should focus on a **design**, not necessarily a fully working prototype. However, within the class we will explore factual implementations using Vue.js and D3.js to have a final tool that can be used to demonstrate the design.


## Repository Status

The repository now contains a working Vue/D3 prototype, project documentation, and design rationale. The implemented dashboard uses the official VAST 2025 MC1 knowledge graph as the concrete case study for the Design Challenge.

## Implemetation Status
Key frontend folders:

frontend/src
  components
     overview
        ConnectedComponentChart.vue
        DegreeDistributionChart.vue
        EntityCompositionChart.vue
        GenreCompositionChart.vue
        NodeLinkDiagram.vue
        RelationshipFlowChart.vue
        RelationshipTypesChart.vue
    Dashboard.vue
    DashboardCard.vue
    FilterPanel.vue
    OverviewPanel.vue
    EgoNetworkPanel.vue
    TimelinePanel.vue
  data
    graphLoader.js
    graphTransforms.js
    metrics.js
    scoring.js

## How to Run
From the frontend folder:

cd frontend
npm install
npm run dev

Open:
http://127.0.0.1:5173/

## Working Approach

The workflow is:

1. **Interpret the challenge**
   - identify the analytical tasks the team wants to support;
   - define the target user and usage scenario.

2. **Explore design alternatives**
   - compare different visual representations for large, attributed, uncertain graphs;
   - evaluate trade-offs between overview, detail, explainability, and interaction complexity.

3. **Develop and refine the concept**
   - create sketches, wireframes, or interactive mockups;
   - gather feedback during class reviews or team meetings;
   - refine the design rationale and task support.

4. **Prepare final deliverables**
   - write the final design description;
   - document limitations and assumptions;
   - assemble supporting visuals, storyboard, and reflection material.


## Team

This project is developed collaboratively by Aurora Bracciotti.

## References

- VAST Challenge 2025 – Design Challenge: https://vast-challenge.github.io/2025/DC.html
- IEEE VIS / VAST community resources on visual analytics, graph visualization, and knowledge graphs



