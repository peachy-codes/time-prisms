import json
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from simulation.graph import GraphLoader
from analytics.prism import calculate_prism_chain
import osmnx as ox
import networkx as nx
from shapely.geometry import shape

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- GRAPH LOADING ---
print("Initializing Graph...")
loader = GraphLoader()
G = loader.get_graph()
G_REV = G.reverse()
print("Graph Ready.")

# --- CAMERA LOADING ---
class CameraLoader:
    def __init__(self, filepath="backend/data/real_osm_cameras.json"):
        self.filepath = filepath
        self.cameras = []
        self.camera_node_map = {} 

    def load_cameras(self, graph):
        if not os.path.exists(self.filepath):
            print(f"Warning: Camera file {self.filepath} not found.")
            return

        print("Loading ALPR Cameras...")
        with open(self.filepath, 'r') as f:
            try:
                raw_data = json.load(f)
                features = raw_data if isinstance(raw_data, list) else raw_data.get('features', [])
            except json.JSONDecodeError:
                print("Error decoding camera JSON")
                return

        processed_features = []
        
        for item in features:
            try:
                geom_shape = shape(item['geometry'])
                centroid = geom_shape.centroid
                lat, lng = centroid.y, centroid.x
                node_id = int(ox.nearest_nodes(graph, X=lng, Y=lat))
                
                feature = {
                    "type": "Feature",
                    "geometry": { "type": "Point", "coordinates": [lng, lat] },
                    "properties": {
                        "id": item.get('id', 'unknown'),
                        "node_id": node_id,
                        "type": "alpr"
                    }
                }
                processed_features.append(feature)
                self.camera_node_map[node_id] = feature
                
            except Exception as e:
                continue
        
        self.cameras = { "type": "FeatureCollection", "features": processed_features }
        print(f"Loaded {len(processed_features)} ALPR cameras mapped to graph nodes.")

camera_loader = CameraLoader()
camera_loader.load_cameras(G)

# --- ENDPOINTS ---

@app.get("/cameras")
def get_cameras():
    return camera_loader.cameras

@app.get("/nearest-node")
def get_nearest_node(lat: float, lng: float):
    node = ox.nearest_nodes(G, X=lng, Y=lat)
    return {"node_id": int(node)}

@app.get("/route")
def get_path(start_node: int, end_node: int):
    try:
        # 1. Get List of Nodes
        path_nodes = nx.shortest_path(G, start_node, end_node, weight='travel_time')
        
        path_coords = []
        current_time_s = 0.0
        
        # 2. Iterate to build path with precise cumulative time
        for i, node_id in enumerate(path_nodes):
            
            # Calculate time from previous node
            if i > 0:
                prev_node = path_nodes[i-1]
                # Safe access for MultiDiGraph (handles key 0 or others)
                edge_atlas = G[prev_node][node_id]
                data = edge_atlas.get(0) or next(iter(edge_atlas.values()))
                
                # Add exact edge travel time
                current_time_s += data.get('travel_time', 0)

            path_coords.append({
                "nodeId": node_id,
                "lat": G.nodes[node_id]['y'],
                "lng": G.nodes[node_id]['x'],
                "timeOffset": current_time_s # <--- CRITICAL FOR ANIMATION SYNC
            })
            
        return {
            "path": path_coords,
            "duration_s": current_time_s
        }
    except nx.NetworkXNoPath:
        return {"path": [], "duration_s": 0}

@app.post("/analyze/chain")
def analyze_chain(payload: dict):
    points = payload.get("points", [])
    include_metrics = payload.get("include_metrics", False) 
    
    if len(points) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 points")

    nodes = [p['node_id'] for p in points]
    times = [p['time'] for p in points]

    try:
        # We pass include_metrics to the calculation function
        geojson = calculate_prism_chain(G, G_REV, nodes, times, include_metrics=include_metrics)
        return geojson
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))