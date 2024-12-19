const DELIM = '¶';

export function stringToKeys(
    conditionChartSourceString: string
): [string, string, string, string] {
    const [key1, value1, key2, value2] = conditionChartSourceString
        .replace('condition_chart_', '')
        .replace('_filter', '')
        .split(DELIM);

    return [key1, value1, key2, value2];
}

export function keysToString(
    key1: string,
    value1: string,
    key2: string,
    value2: string
): string {
    return `${key1}${DELIM}${value1}${DELIM}${key2}${DELIM}${value2}`;
}
