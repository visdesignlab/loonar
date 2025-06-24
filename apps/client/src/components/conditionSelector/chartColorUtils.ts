export function getChartColor(
    idx: number,
    idy: number,
    xLabels: string[],
    yLabels: string[],
    colors: string[]
): string | undefined {
    if (!Array.isArray(xLabels) || !Array.isArray(yLabels) || !Array.isArray(colors) || colors.length === 0) {
        return undefined;
    }
    // If there is only one label in either xLabels or yLabels, return a color based on the index
    if (yLabels.length === 1) {
        return colors[idx % colors.length];
    }
    if (xLabels.length === 1) {
        return colors[idy % colors.length];
    }
    // Otherwise, default
    return undefined;
}