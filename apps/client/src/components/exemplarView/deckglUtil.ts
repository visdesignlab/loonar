import HorizonChartLayer from '../layers/HorizonChartLayer/HorizonChartLayer';

export const HORIZON_CHART_MOD_OFFSETS = [
    -10, -9, -8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
];

export interface TemporalDataPoint {
    time: number;
    value: number;
}

export function constructGeometryBase(
    data: TemporalDataPoint[],
    timestep: number
): number[] {
    const geometry: number[] = [];

    const hackyBottom = -404.123456789;
    // this is a hack to make the shaders work correctly.
    // this value is used in the shaders to determine the non value side
    // of the geometry. If a data has this exact value there will be a
    // small visual bug. This value is arbitrary, but is less likely to
    // be found in data than 0.

    if (data.length === 1) {
        const d0 = data[0];
        const x = d0.time;
        const x1 = x - timestep / 2;
        const x2 = x + timestep / 2;
        const y = d0.value;
        geometry.push(x1, hackyBottom);
        geometry.push(x1, y);
        geometry.push(x2, hackyBottom);
        geometry.push(x2, y);
        return geometry;
    }

    const firstX = data[0].time;
    geometry.push(firstX, hackyBottom);
    let x = 0;
    for (const dataPoint of data) {
        x = dataPoint.time;
        const y = dataPoint.value;
        geometry.push(x, y);
        geometry.push(x, hackyBottom);
    }

    geometry.push(x, hackyBottom);
    return geometry;
}

export function hexListToRgba(hexList: readonly string[]): number[] {
    // flatMap returns a single, flattened array by mapping each hex to [r, g, b, a]
    // then concatenating them all together.
    return hexList.flatMap((hex) => {
        // Make sure your input is in the format '#RRGGBB' (7 chars total).
        // If it might have a leading '#' missing or includes alpha, you'll need additional checks.
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;

        // Always use the second argument `16` in parseInt for hex parsing.
        // Divide by 255 to get a value in the [0, 1] range for WebGL / Canvas usage.
        return [r, g, b, 1.0];
    });
}

const positiveHorizonChartScheme = [
    '#E0F7FA',
    '#B3E5FC',
    '#81D4FA',
    '#4FC3F7',
    '#29B6F6',
    '#03A9F4',
    '#039BE5',
    '#0288D1',
    '#0277BD',
    '#01579B',
    '#003366',
    '#000000',
    // Add more if needed
];

const negativeHorizonChartScheme = [
    '#FFE0E0',
    '#FFB3B3',
    '#FF8181',
    '#FF4F4F',
    '#FF2929',
    '#FF0303',
    '#E50303',
    '#D10202',
    '#BD0202',
    '#9B0202',
    '#660202',
    '#330202',
    // Add more if needed
];

// Used in exemplarView to catch overlapping.
export function rectsOverlap(
    rect1: [number, number, number, number],
    rect2: [number, number, number, number]
): boolean {
    const [x1, y1, x2, y2] = rect1;
    const [x3, y3, x4, y4] = rect2;
    return !(x2 <= x3 || x1 >= x4 || y2 >= y3 || y1 <= y4);
}

export function pointInBBox(
    point: [number, number],
    bbox: [number, number, number, number]
): boolean {
    const [x, y] = point;
    const [x1, y1, x2, y2] = bbox;
    return x >= x1 && x <= x2 && y <= y1 && y >= y2;
}
