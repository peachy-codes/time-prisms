import { POINT_STYLES, POINT_TYPES } from './theme';

export const prismLayer = {
    id: 'prism-edges',
    type: 'line',
    paint: {
        'line-width': 2,
        'line-color': [
            'interpolate',
            ['linear'],
            ['get', 'score'],
            0.0, '#00ff00',  
            0.5, '#ffff00',  
            1.0, '#ff0000'   
        ],
        'line-opacity': [
            'interpolate',
            ['linear'],
            ['get', 'score'],
            0.0, 0.9, 
            0.5, 0.6,
            1.0, 0.1 
        ]
    }
};

export const pointLayer = {
    id: 'selected-points',
    type: 'circle',
    paint: {
        // Look up the 'meta.type' property we added in pointUtils
        'circle-color': [
            'match',
            ['get', 'type'], // We will pass the calculated type into the GeoJSON properties
            POINT_TYPES.START, POINT_STYLES[POINT_TYPES.START].colorHex,
            POINT_TYPES.END, POINT_STYLES[POINT_TYPES.END].colorHex,
            POINT_TYPES.ALPR, POINT_STYLES[POINT_TYPES.ALPR].colorHex,
            POINT_TYPES.GHOST, POINT_STYLES[POINT_TYPES.GHOST].colorHex,
            POINT_STYLES[POINT_TYPES.WAYPOINT].colorHex // Default
        ],
        'circle-radius': [
            'match',
            ['get', 'type'],
            POINT_TYPES.GHOST, POINT_STYLES[POINT_TYPES.GHOST].radius,
            POINT_TYPES.ALPR, POINT_STYLES[POINT_TYPES.ALPR].radius,
            6 // Default
        ],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff'
    }
};