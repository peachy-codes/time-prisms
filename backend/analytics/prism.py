import networkx as nx
import json

def calculate_single_prism(G, G_REV, start_node, end_node, real_budget_seconds, detour_ratio=1.3, include_metrics=False):
    """
    Calculates a single leg of the Space-Time Prism.
    Returns: (list of features, float total_length_meters)
    """
    
    # 1. Physics Check: Can we make it?
    try:
        min_time = nx.shortest_path_length(G, start_node, end_node, weight='travel_time')
    except nx.NetworkXNoPath:
        return [], 0.0

    if real_budget_seconds < min_time:
        return [], 0.0

    # 2. Logic: Restrict the 'Lens' to avoid the "Entire City" problem
    capped_budget = min_time * detour_ratio
    effective_cutoff = min(real_budget_seconds, capped_budget)

    # 3. Graph Search (Forward & Backward)
    dists_from_start = nx.single_source_dijkstra_path_length(
        G, start_node, cutoff=effective_cutoff, weight='travel_time'
    )
    dists_to_end = nx.single_source_dijkstra_path_length(
        G_REV, end_node, cutoff=effective_cutoff, weight='travel_time'
    )

    features = []
    leg_total_length = 0.0

    # 4. Intersection & Construction
    # We find nodes reachable from Start AND capable of reaching End
    reachable_nodes = set(dists_from_start.keys()) & set(dists_to_end.keys())
    
    for u in reachable_nodes:
        # Check outgoing edges from valid nodes
        for v, edge_atlas in G[u].items():
            if v in dists_to_end:
                if 0 in edge_atlas:
                    data = edge_atlas[0]
                else:
                    data = next(iter(edge_atlas.values()))

                t_start = dists_from_start[u]
                t_edge = data.get('travel_time', 0)
                t_end = dists_to_end[v]
                
                total_trip_time = t_start + t_edge + t_end
                
                if total_trip_time <= effective_cutoff:
                    # Metric Calculation (Done here, inside the loop)
                    print(f"Edge found! Metrics Requested: {include_metrics}")
                    if include_metrics:
                        edge_len = data.get('length', 0)

                        leg_total_length += edge_len
                        print(f"Adding edge length: {edge_len}")

                    # Score Calculation
                    if effective_cutoff == min_time:
                        score = 0.0
                    else:
                        score = (total_trip_time - min_time) / (effective_cutoff - min_time)
                        score = max(0.0, min(1.0, score))

                    # Geometry
                    if 'geometry' in data:
                        coords = list(data['geometry'].coords)
                    else:
                        n1 = G.nodes[u]
                        n2 = G.nodes[v]
                        coords = [(n1['x'], n1['y']), (n2['x'], n2['y'])]

                    features.append({
                        "type": "Feature",
                        "geometry": {
                            "type": "LineString",
                            "coordinates": coords
                        },
                        "properties": {
                            "score": score,
                            "time_cost": total_trip_time
                        }
                    })

    
    return features, leg_total_length


def calculate_prism_chain(G, G_REV, nodes, times, include_metrics=False):
    """
    Iterates through the chain and sums up the length returned by single_prism.
    """
    all_features = []
    total_chain_length = 0.0
    
    for i in range(len(nodes) - 1):
        u, v = nodes[i], nodes[i+1]
        t_start, t_end = times[i], times[i+1]
        
        real_budget = t_end - t_start
        if real_budget <= 0:
            continue
            
        # Call helper
        leg_features, leg_length = calculate_single_prism(
            G, G_REV, u, v, real_budget, 
            detour_ratio=1.3, 
            include_metrics=include_metrics
        )
        
        all_features.extend(leg_features)
        total_chain_length += leg_length
    print(f"Chain Calc Complete. Total Length: {total_chain_length} meters. Metrics: {include_metrics}")
    return {
        "type": "FeatureCollection",
        "features": all_features,
        "properties": {
            "total_length_km": round(total_chain_length / 1000.0, 3)
        }
    }