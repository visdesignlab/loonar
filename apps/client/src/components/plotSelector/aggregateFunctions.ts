export interface AttributeSelection {
    label: string;
    type: 'existing_attribute' | 'numerical';
    max?: number;
    min?: number;
    step?: number;
}

export type AggregateFunction =
    | BasicAggregateFunction
    | StandardAggregateFunction
    | CustomAggregateFunction;

export interface CustomAggregateFunction extends BasicAggregateFunction {
    customQuery: string;
}

export interface StandardAggregateFunction extends BasicAggregateFunction {
    selections: Record<string, AttributeSelection>;
}

export interface BasicAggregateFunction {
    functionName: string;
    description: string;
}

export function isStandardAggregateFunction(
    aggFunction: AggregateFunction
): aggFunction is StandardAggregateFunction {
    return 'selections' in aggFunction;
}

export function isCustomAggregateFunction(
    aggFunction: AggregateFunction
): aggFunction is CustomAggregateFunction {
    return 'customQuery' in aggFunction;
}
export const aggregateFunctions: Record<string, AggregateFunction> = {
    Sum: {
        functionName: 'SUM',
        description: 'Sum of selected attribute over each track.',
        selections: {
            attr1: {
                label: 'Attribute',
                type: 'existing_attribute',
            },
        },
    },
    Average: {
        functionName: 'AVG',
        description: 'Average of selected attribute over each track.',
        selections: {
            attr1: {
                label: 'Attribute',
                type: 'existing_attribute',
            },
        },
    },
    'Track Length': {
        functionName: 'COUNT',
        description: 'Number of cells in each track.',
    },
    Minimum: {
        functionName: 'MIN',
        description: 'Minimum of selected attribute across each track.',
        selections: {
            attr1: {
                label: 'Attribute',
                type: 'existing_attribute',
            },
        },
    },
    Maximum: {
        functionName: 'MAX',
        description: 'Maximum of selected attribute across each track.',
        selections: {
            attr1: {
                label: 'Attribute',
                type: 'existing_attribute',
            },
        },
    },
    'Median Absolute Deviation': {
        functionName: 'MAD',
        description: 'Median of all absolute deviations.',
        selections: {
            attr1: {
                label: 'Attribute',
                type: 'existing_attribute',
            },
        },
    },
    'Continuous Quantile': {
        functionName: 'QUANTILE_CONT',
        description: 'The pth continuous quantile of the selected attribute.',
        selections: {
            attr1: {
                label: 'Attribute',
                type: 'existing_attribute',
            },
            var1: {
                label: 'Position',
                type: 'numerical',
                max: 1,
                min: 0,
                step: 0.1,
            },
        },
    },
    'Linear Regression Slope': {
        functionName: 'REGR_SLOPE',
        description:
            'Slope of the linear regression line between the two selected attributes.',
        selections: {
            attr1: {
                label: 'Attribute',
                type: 'existing_attribute',
            },
            attr2: {
                label: 'Attribute',
                type: 'existing_attribute',
            },
        },
    },
    /*
    Custom query must do the following:
    - Any string replacement needed uses the {item} syntax. This is the same syntax as typescripts syntax without the "$"
    - The result of the query must return a column aliased as the function name
    - The result of the query must return the tracking id aliased as "tracking_id"
    - There must only be one result per tracking id.
    */
    'Initial Mass': {
        functionName: 'init_mass',
        description:
            'The adjusted initial mass determined by linear regression.',
        customQuery: `
            SELECT 
                CASE 
                    WHEN COUNT(*) = 1 THEN MIN(t1."{massColumn}")
                    ELSE MIN(t1."{timeColumn}")*regr_line.slope + regr_line.intercept
                END as init_mass,
                t1."{idColumn}" as tracking_id
            FROM {compTable} as t1
            LEFT JOIN (
                SELECT 
                    CASE 
                        WHEN COUNT(*) > 1 THEN regr_slope("{massColumn}", "{timeColumn}")
                        ELSE NULL
                    END as slope,
                    CASE 
                        WHEN COUNT(*) > 1 THEN regr_intercept("{massColumn}", "{timeColumn}")
                        ELSE NULL
                    END as intercept,
                    "{idColumn}" as tracking_id
                FROM {compTable}
                GROUP BY "{idColumn}"
            ) as regr_line
            ON t1."{idColumn}" = regr_line.tracking_id
            GROUP BY t1."{idColumn}", regr_line.slope, regr_line.intercept
        `,
    },
    'Exponential Growth Rate Constant': {
        functionName: 'exp_growth_rate_constant',
        description:
            'The slope of the linear regression line divided by the initial mass.',
        customQuery: `
            SELECT 
                CASE 
                    WHEN COUNT(*) = 1 THEN 0
                    ELSE regr_line.slope/(MIN(t1."{timeColumn}")*regr_line.slope + regr_line.intercept)
                END as exp_growth_rate_constant,
                t1."{idColumn}" as tracking_id
            FROM {compTable} as t1
            LEFT JOIN (
                SELECT 
                    CASE 
                        WHEN COUNT(*) > 1 THEN regr_slope("{massColumn}", "{timeColumn}")
                        ELSE NULL
                    END as slope,
                    CASE 
                        WHEN COUNT(*) > 1 THEN regr_intercept("{massColumn}", "{timeColumn}")
                        ELSE NULL
                    END as intercept,
                    "{idColumn}" as tracking_id
                FROM {compTable}
                GROUP BY "{idColumn}"
            ) as regr_line
            ON t1."{idColumn}" = regr_line.tracking_id
            GROUP BY t1."{idColumn}", regr_line.slope, regr_line.intercept
        `,
    },
    'Growth Rate': {
        functionName: 'growth_rate',
        description:
            'The slope of the linear regression line where time is the independent variable and mass is the dependent variable.',
        customQuery: `
            SELECT 
                regr_slope("{massColumn}", "{timeColumn}") as growth_rate,
                "{idColumn}" as tracking_id
            FROM {compTable}
            GROUP BY "{idColumn}"
        `,
    },
};
