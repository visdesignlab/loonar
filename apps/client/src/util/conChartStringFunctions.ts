export function stringToKeys(conditionChartSourceString: string) {
    const [key1, value1, key2, value2] = conditionChartSourceString.replace('condition_chart_', '').replace('_filter', '').split("¶")

    return [key1, value1, key2, value2];
}