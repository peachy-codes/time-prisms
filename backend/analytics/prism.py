import networkx as nx

def calculate_single_prism(G, G_rev, start_node, end_node, real_budget_seconds, detour_ratio=1.3):
    """
    Calculates the prism but clamps the max travel time to prevent 'overshoot'.
    
    real_budget_seconds: The actual time difference (e.g., 20 mins).
    detour_ratio: 1.3 means we only visualize paths up to 30% longer than 
                  optimal, even if the budget allows for more.
    """
    
    # 1. Calculate Minimum Theoretical Time (Shortest Path)
    try:
        min_time = nx.shortest_path_length(G, start_node, end_node, weight='travel_time')
    except nx.NetworkXNoPath:
        return None

    # 2. Validation
    # If the user physically couldn't make it in time, return nothing.
    if real_budget_seconds < min_time:
        return None

    # 3. Determine the "Visual" Cutoff
    # We use the SMALLER of:
    #   a) The actual time budget (the hard physics limit)
    #   b) The "Reasonable Driver" limit (shortest path * ratio)
    
    # This prevents the "spiky ball" effect where a driver drives 5 miles 
    # past the destination just to burn time.
    capped_budget = min_time * detour_ratio
    effective_cutoff = min(real_budget_seconds, capped_budget)

    # 4. Forward Search (From Start)
    dists_from_start = nx.single_source_dijkstra_path_length(
        G, start_node, cutoff=effective_cutoff, weight='travel_time'
    )
    
    # 5. Backward Search (To End) - Use Reversed Graph
    dists_to_end = nx.single_source_dijkstra_path_length(
        G_rev, end_node, cutoff=effective_cutoff, weight='travel_time'
    )

    # ... (After Step 5: Backward Search) ...

    features = []
    
    # OPTIMIZATION: Intersection of sets
    # Find nodes that are reachable from Start AND can reach End
    # This is much faster than iterating all edges
    reachable_nodes = set(dists_from_start.keys()) & set(dists_to_end.keys())
    
    # iterate ONLY over the valid nodes to find connecting edges
    for u in reachable_nodes:
        # Check all outgoing edges from this valid node
        # G[u] gives neighbors of u
        for v, data in G[u].items():
            # We only care if the destination node v is also reachable by the end
            if v in dists_to_end:
                t_start = dists_from_start[u]
                t_edge = data.get('travel_time', 0)
                t_end = dists_to_end[v]
                
                total_trip_time = t_start + t_edge + t_end
                
                if total_trip_time <= effective_cutoff:
                    # ... (Your existing scoring and geometry logic) ...
                    # COPY YOUR EXISTING LOGIC HERE
                    
                    if effective_cutoff == min_time:
                        score = 0
                    else:
                        score = (total_trip_time - min_time) / (effective_cutoff - min_time)

                    geom = data.get('geometry', None)
                    if geom:
                        geojson_geom = geom.__geo_interface__
                    else:
                        geojson_geom = {
                            "type": "LineString",
                            "coordinates": [
                                [G.nodes[u]['x'], G.nodes[u]['y']], 
                                [G.nodes[v]['x'], G.nodes[v]['y']]
                            ]
                        }

                    features.append({
                        "type": "Feature",
                        "geometry": geojson_geom,
                        "properties": {
                            "score": score,
                            "time_cost": total_trip_time
                        }
                    })

    return features

def calculate_prism_chain(G, G_rev, nodes, times):
    """
    Iterates through a list of nodes/times and unions the prisms.
    """
    all_features = []
    
    for i in range(len(nodes) - 1):
        u = nodes[i]
        v = nodes[i+1]
        t_u = times[i]
        t_v = times[i+1]
        
        budget = t_v - t_u
        
        if budget <= 0:
            continue 
            
        #print(f"Leg {i}: {budget}s available. Computing...")
        
        # We use the single prism logic with the detour clamp
        leg_features = calculate_single_prism(G, G_rev, u, v, budget, detour_ratio=1.3)
        
        if leg_features:
            all_features.extend(leg_features)
            
    return {
        "type": "FeatureCollection",
        "features": all_features
    }