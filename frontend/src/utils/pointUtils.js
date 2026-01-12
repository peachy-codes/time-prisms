import { POINT_TYPES, POINT_STYLES } from '../config/theme';

/**
 * analyzes the list of points and assigns metadata (type, label, style)
 * to each one based on its position in the user journey.
 */
export const enrichPointsWithMetadata = (points) => {
    // 1. Identify the User Journey (excluding simulation artifacts)
    const userPoints = points.filter(p => !p.isGhost && p.type !== 'alpr');
    const firstId = userPoints.length > 0 ? userPoints[0].id : null;
    const lastId = userPoints.length > 0 ? userPoints[userPoints.length - 1].id : null;
    
    let waypointCounter = 0;

    return points.map(p => {
        let type = POINT_TYPES.WAYPOINT; // Default
        let label = "";

        // Determine Type
        if (p.isGhost) {
            type = POINT_TYPES.GHOST;
        } else if (p.type === 'alpr' || p.isDetected) {
            type = POINT_TYPES.ALPR;
        } else if (p.id === firstId) {
            type = POINT_TYPES.START;
        } else if (p.id === lastId) {
            type = POINT_TYPES.END;
        } else {
            type = POINT_TYPES.WAYPOINT;
        }

        // Determine Label
        const style = POINT_STYLES[type];
        if (type === POINT_TYPES.WAYPOINT) {
            waypointCounter++;
            label = `Waypoint ${waypointCounter}`;
        } else {
            label = style.label;
        }

        return {
            ...p,
            meta: {
                type,
                label,
                style // Contains the hex and tailwind classes
            }
        };
    });
};