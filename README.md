# Time Prisms: Dynamic Space-Time Visualizer

I've been working on an isochrone + time prism problem, specifically looking at how to handle graph traversals efficiently in a real-time context.

Most maps show you **Isochrones** ("How far can I go in 30 mins?").
This project visualizes **Space-Time Prisms**: "Where can I go if I start *here* and absolutely must be *there* by 5:00 PM?"

It captures the intersection of two constraints:
1.  **Forward Reachability:** Where you can get to from the start.
2.  **Backward Reachability:** Places from which you can still reach the destination on time.

The result is a dynamic "bead" shape that morphs as you travel.

### The Challenge
The math is straightforward (Bidirectional Dijkstra), but making it run at 60 FPS for a moving simulation was... tricky.

Initial implementations using standard NetworkX graph traversals were hitting 400ms+ latency per frame—way too slow for animation. Through some heavy optimization (and a lot of debugging), I got the calculation down to ~23ms.

To get this running in real-time on a standard San Francisco street grid (~27k edges), we had to stop doing things the naive way.

* **Two-Pass Intersection:** We run a Forward Dijkstra from the start and a Backward Dijkstra from the end. The prism is the geometric intersection of these two search trees.
* **Algorithmic Pruning:** Instead of iterating over every single edge in SF to check if it fits the time budget (which is slow), we do a set intersection of the valid nodes first. We only touch the edges that actually matter.
* **Static Graph Pre-computation:** `networkx.reverse()` is expensive. We moved this to server startup so we aren't re-allocating memory constantly.
* **Frontend Throttling:** The backend actually became *too* fast for React to handle. Implemented a custom `requestAnimationFrame` loop with an FPS throttle to stop the main thread from starving (so the "Stop" button actually works).

### Tech Stack
**Backend**
* **FastAPI:** For the speed.
* **NetworkX:** For the graph math.
* **OSMnx:** To grab the San Francisco drive graph.
* **Physics:** We inject a "Speeding Bias" into the graph because nobody in SF drives exactly at the speed limit.

**Frontend**
* **React + Vite:** The view layer.
* **MapLibre GL JS:** For vector tile rendering.
* **Ref-based Game Loop:** To bypass React state lag during high-speed updates.

### Setup

I've `.gitignore`'d the heavy graph files, so the first run will take a moment to download the SF network from OpenStreetMap.

**Backend**
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload
```
*Note: Watch the console. It will say "Pre-computing Reverse Graph..."

**Frontend**
```bash
cd frontend
npm install
npm run dev
```

### Usage
1.  Open the map.
2.  Click **"+ Add Detection Point"** to set a Start and End location.
3.  Click **"Compute Chain"** to see the static prism.
4.  Click **"Run Simulation"** in the top right. This drives a "Ghost Car" along the shortest path and recalculates the prism in real-time.

### Future Work
If I host this statically (like on GitHub Pages), I'll bake the scenarios into JSON files since we can't run the Python graph engine in the browser. For now, the local setup is the best way to see the dynamic solving.