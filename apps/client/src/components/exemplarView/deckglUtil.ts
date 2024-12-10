import HorizonChartLayer from '../layers/HorizonChartLayer/HorizonChartLayer';

export const HORIZON_CHART_MOD_OFFSETS = [
    -8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5,
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
    const rgbaList: number[] = [];
    for (const colorHex of hexList) {
        // convert coloHex to rgba array all values [0-1]
        const color = [];
        for (let i = 0; i < 3; i++) {
            color.push(
                parseInt(colorHex.slice(1 + i * 2, 1 + i * 2 + 2), 16) / 255
            );
        }
        color.push(1.0);
        rgbaList.push(...color);
    }
    return rgbaList;
}
