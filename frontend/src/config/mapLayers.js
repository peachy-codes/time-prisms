export const prismLayer = {
    id: 'prism-edges',
    type: 'line',
    paint: {
        'line-width': 2,
        'line-color': [
            'interpolate',
            ['linear'],
            ['get', 'score'],
            0.0, '#00ff00',  // Green (Optimal)
            0.5, '#ffff00',  // Yellow
            1.0, '#ff0000'   // Red (Boundary)
        ],
        'line-opacity': 0.5
    }
};

export const pointLayer = {
    id: 'selected-points',
    type: 'circle',
    paint: {
        'circle-radius': 4,
        'circle-color': [
            'match',
            ['get', 'type'],
            'start', '#00ff00',
            'end', '#ff0000',
            '#000000'
        ],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#000000ff'
    }
};