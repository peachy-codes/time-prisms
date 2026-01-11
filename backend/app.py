from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from simulation.graph import GraphLoader
from analytics.prism import calculate_prism_chain
import osmnx as ox
import networkx as nx


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

print("Initializing Graph...")
loader = GraphLoader()
G = loader.get_graph()
print("Graph Ready.")

print("Pre-computing Reverse Graph...")
G_REV = G.reverse() 
print("Graph Ready.")

@app.get("/nearest-node")
def get_nearest_node(lat: float, lng: float):
    node = ox.nearest_nodes(G, X=lng, Y=lat)
    return {"node_id": int(node)}

@app.get("/route")
def get_path(start_node: int, end_node: int):
    try:
        # Get list of nodes
        path_nodes = nx.shortest_path(G, start_node, end_node, weight='travel_time')
        
        # Hydrate with coordinates so the frontend can draw them
        path_coords = []
        for node_id in path_nodes:
            path_coords.append({
                "nodeId": node_id,
                "lat": G.nodes[node_id]['y'],
                "lng": G.nodes[node_id]['x']
            })
            
        return {"path": path_coords}
    except nx.NetworkXNoPath:
        raise HTTPException(status_code=404, detail="No path found")

@app.post("/analyze/chain")
def analyze_chain(payload: dict):
    # Payload: { points: [ {node_id: 123, time: 0}, {node_id: 456, time: 600} ] }
    points = payload.get("points", [])
    
    if len(points) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 points")

    nodes = [p['node_id'] for p in points]
    times = [p['time'] for p in points] # These should be seconds (relative or epoch)

    try:
        geojson = calculate_prism_chain(G, G_REV, nodes, times)
        return geojson
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))