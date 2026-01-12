// Central definitions for point types
export const POINT_TYPES = {
    START: 'start',
    END: 'end',
    WAYPOINT: 'waypoint',
    ALPR: 'alpr',
    GHOST: 'ghost'
};

// Visual definitions
export const POINT_STYLES = {
    [POINT_TYPES.START]: {
        label: "Start",
        colorHex: '#10B981', // Emerald 500
        twBadge: 'text-white bg-emerald-500',
        twBorder: 'border-emerald-500',
        radius: 6
    },
    [POINT_TYPES.END]: {
        label: "End",
        colorHex: '#EF4444', // Red 500
        twBadge: 'text-white bg-red-500',
        twBorder: 'border-red-500',
        radius: 6
    },
    [POINT_TYPES.WAYPOINT]: {
        label: "Waypoint",
        colorHex: '#3B82F6', // Blue 500
        twBadge: 'text-white bg-blue-500',
        twBorder: 'border-blue-500',
        radius: 6
    },
    [POINT_TYPES.ALPR]: {
        label: "ALPR Detection",
        colorHex: '#DC2626', // Red 600
        twBadge: 'text-white bg-red-600',
        twBorder: 'border-red-600',
        radius: 5
    },
    [POINT_TYPES.GHOST]: {
        label: "Simulation",
        colorHex: '#FBBF24', // Amber 400
        twBadge: 'text-black bg-amber-400',
        twBorder: 'border-amber-400',
        radius: 8
    }
};

// Default fallback
export const DEFAULT_STYLE = POINT_STYLES[POINT_TYPES.WAYPOINT];