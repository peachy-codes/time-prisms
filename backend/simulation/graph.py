import osmnx as ox
import os
import networkx as nx

class GraphLoader:
    def __init__(self, place_name="San Francisco, California, USA"):
        self.place_name = place_name
        self.drive_file = "backend/data/sf_drive_graph.graphml"

    def get_graph(self):
        """
        Returns the drive graph with custom physics for speeding drivers.
        """
        if os.path.exists(self.drive_file):
            print(f"Loading cached DRIVE graph from {self.drive_file}...")
            return ox.load_graphml(self.drive_file)
        
        print(f"Downloading new DRIVE graph for {self.place_name}...")
        G = ox.graph_from_place(self.place_name, network_type='drive')
        
        # 1. Impute standard speed limits (defaults to 25mph if missing)
        G = ox.add_edge_speeds(G)
        
        # 2. Apply "Speeding" Physics: +7.5 mph (approx 12 kph)
        print("Applying +7.5mph speeding bias...")
        SPEED_BUFFER_KPH = 12.07 
        
        for u, v, k, data in G.edges(keys=True, data=True):
            current_speed = data.get('speed_kph', 40.0)
            if isinstance(current_speed, list):
                current_speed = max(current_speed)
                
            new_speed = current_speed + SPEED_BUFFER_KPH
            data['speed_kph'] = new_speed
        
        # 3. Calculate travel times based on NEW speeds
        G = ox.add_edge_travel_times(G)
        
        # 4. Save
        ox.save_graphml(G, self.drive_file)
        return G