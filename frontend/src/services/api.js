const BASE_URL = "http://localhost:8000";

export const api = {
    /**
     * Loads the static ALPR camera locations.
     * @returns {Promise<Object>} GeoJSON FeatureCollection
     */
    getCameras: async () => {
        const response = await fetch(`${BASE_URL}/cameras`);
        if (!response.ok) throw new Error("Failed to fetch cameras");
        return response.json();
    },

    /**
     * Finds the nearest graph node to a lat/lng coordinate.
     * @param {number} lat 
     * @param {number} lng 
     * @returns {Promise<Object>} { node_id: number }
     */
    getNearestNode: async (lat, lng) => {
        const response = await fetch(`${BASE_URL}/nearest-node?lat=${lat}&lng=${lng}`);
        if (!response.ok) throw new Error("Failed to fetch nearest node");
        return response.json();
    },

    /**
     * Calculates the shortest path between two nodes.
     * @param {number} startNodeId 
     * @param {number} endNodeId 
     * @returns {Promise<Object>} { path: [{nodeId, lat, lng}, ...] }
     */
    getRoute: async (startNodeId, endNodeId) => {
        const response = await fetch(`${BASE_URL}/route?start_node=${startNodeId}&end_node=${endNodeId}`);
        // We don't throw here immediately because the simulation loop handles empty paths gracefully
        if (!response.ok) return { path: [] }; 
        return response.json();
    },

    /**
     * Computes the Space-Time Prism for a chain of points.
     * @param {Array} points - Array of objects { node_id, time (seconds) }
     * @returns {Promise<Object>} GeoJSON FeatureCollection
     */
    getPrism: async (points, withMetrics = false) => {
        const response = await fetch(`${BASE_URL}/analyze/chain`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                points,
                include_metrics: withMetrics 
            })
        });
        if (!response.ok) throw new Error("Prism analysis failed");
        return response.json();
    }
};