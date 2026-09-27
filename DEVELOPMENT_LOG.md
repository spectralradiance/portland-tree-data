# Development Log

## Goal
Build a portfolio-ready workflow for analyzing and visualizing Portland tree data using Python + React.

## Process timeline

1. Confirmed stack correction from "pyrgon" to **Python** and locked architecture to Python data prep + React presentation.
2. Scaffolded frontend with Vite React for predictable tooling and fast iteration.
3. Added mapping/chart dependencies (React Leaflet + Recharts).
4. Implemented Python preprocessing script to:
   - load raw tree GeoJSON (remote URL or local file),
   - normalize fields required by UI,
   - compute interview-friendly summary metrics,
   - write stable frontend data artifacts.
5. Implemented React dashboard with:
   - map markers + popups,
   - filter controls (species, condition, neighborhood),
   - core analysis charts,
   - key metric cards.
6. Added usage documentation and workflow commands.

## Interview talking points

- **Why split Python and React?** Python handles reproducible data shaping; React focuses on interaction and UX.
- **How did you control frontend performance?** Capped rendered map points and kept precomputed summaries in JSON.
- **How is this extensible?** Add new derived metrics in Python, then bind them to additional charts/components.
- **How to adapt to restricted networks?** Script supports local input path instead of live API.
