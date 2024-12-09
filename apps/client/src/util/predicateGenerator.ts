import type { DataSelection } from "@/stores/interactionStores/selectionStore";
import { useDatasetSelectionStore } from "@/stores/dataStores/datasetSelectionUntrrackedStore";
import { storeToRefs } from "pinia";

function _escapeSource(source: string) {
    return `"${source.replace(/"/g, '""')}"`;
}

// If ranges are using the JS Infinity key word, 
// then escape with single quotes for use in SQL
function _escapeRange(range: number[]) {
    const newRange: Array<string | number> = [];
    range.forEach(number => {
        if (number === Infinity) {
            newRange.push("'Infinity'")
        } else if (number === -Infinity) {
            newRange.push("'-Infinity'")
        } else {
            newRange.push(number)
        }
    })
    return newRange;
}

// Predicate for 'selection' queries with data source as the composite table.
export function getPredicateSelectionComposite(selection: DataSelection) {

    /*----------------------------------------------

        Charts Using This Type of Predicate:
        
        Image
        Line Chart
        Condition Chart
        Cell Attributes

    ----------------------------------------------*/

    const { plotName, type, range: unescapedRange } = selection;
    const range = _escapeRange(unescapedRange);

    const escapedSource = _escapeSource(plotName);

    const dataSetSelectionStore = useDatasetSelectionStore();
    const { currentExperimentMetadata } = storeToRefs(dataSetSelectionStore);

    // Get ID Column
    const idColumn =
        currentExperimentMetadata.value?.headerTransforms?.['id'];

    // Aggregate Table Name
    const aggTableName = `${currentExperimentMetadata.value?.name}_composite_experiment_cell_metadata_aggregate`;

    if (currentExperimentMetadata.value) {
        if (type === 'cell') {
            return range
                ? `${escapedSource} BETWEEN ${range[0]} AND ${range[1]}`
                : null;
        } else if (type === 'track') {
            return range
                ? `"${idColumn}" IN (SELECT tracking_id FROM ${aggTableName} WHERE ${escapedSource} between ${range[0]} and ${range[1]} )`
                : null;
        } else {
            console.warn(`Type '${type}' not implemented.`)
            return null
        }
    } else {
        console.warn('Cell Metadata not yet initialized.')
        return null
    }
}

// Predicate for 'selection' queries with data source as the agg table.
export function getPredicateSelectionAgg(selection: DataSelection) {

    /*----------------------------------------------

        Charts Using This Type of Predicate:
        
        Track Attributes Plot

    ----------------------------------------------*/

    const { plotName, type, range: unescapedRange } = selection;
    const range = _escapeRange(unescapedRange);

    const escapedSource = _escapeSource(plotName);

    const dataSetSelectionStore = useDatasetSelectionStore();
    const { currentExperimentMetadata } = storeToRefs(dataSetSelectionStore);


    if (currentExperimentMetadata.value) {
        if (type === 'cell') {
            return range
                ? `NOT ( "Maximum ${plotName}" <= ${range[0]} OR "Minimum ${plotName}" >= ${range[1]} )`
                : null;
        } else if (type === 'track') {
            return range ? `${escapedSource} between ${range[0]} and ${range[1]}` : null;
        } else {
            console.warn(`Type '${type}' not implemented.`)
            return null
        }
    } else {
        console.warn('Cell Metadata not yet initialized.')
        return null
    }

}

// Predicate for 'filter' queries with data source as the composite table
export function getPredicateFilterComposite(filter: DataSelection) {

    /*----------------------------------------------

        Charts Using This Type of Predicate:
        

        Condition Chart
        Cell Attributes

    ----------------------------------------------*/

    const { plotName, type, range: unescapedRange } = filter;
    const range = _escapeRange(unescapedRange);

    const dataSetSelectionStore = useDatasetSelectionStore();
    const { currentExperimentMetadata } = storeToRefs(dataSetSelectionStore);

    // Get ID Column
    const idColumn =
        currentExperimentMetadata.value?.headerTransforms?.['id'];

    // Aggregate Table Name
    const aggTableName = `${currentExperimentMetadata.value?.name}_composite_experiment_cell_metadata_aggregate`;

    if (currentExperimentMetadata.value) {
        if (type === 'cell') {
            return range
                ? `"${idColumn}" IN (
                    SELECT tracking_id
                    FROM ${aggTableName}
                    WHERE NOT (
                        "Maximum ${plotName}" <= ${range[0]} 
                        OR "Minimum ${plotName}" >= ${range[1]}
                    )
                )`
                : null;
        } else if (type === 'track') {
            return range
                ? `"${idColumn}" IN (
                SELECT tracking_id
                FROM ${aggTableName}
                WHERE "${plotName}" >= ${range[0]} 
                    AND "${plotName}" <= ${range[1]}
            )`
                : null;
        } else {
            console.warn(`Type '${type}' not implemented.`)
            return null
        }
    } else {
        console.warn('Cell Metadata not yet initialized.')
        return null
    }


}

// Predicate for 'filter' queries with data source as the aggregate table
export function getPredicateFilterAgg(filter: DataSelection) {
    /*----------------------------------------------

        Charts Using This Type of Predicate:

        Image 
        Line Chart
        Track Attributes Plot

        Note: Image and Line chart use this type of filtering because they eventually just pull from a list of Ids -- they don't have the same idea of a mosaic data source. So, we just generate the list of ids by pulling from the aggregate table since it makes the most sense.
    ----------------------------------------------*/
    // Same as the selection. May re-write
    return getPredicateSelectionAgg(filter);

}
