
interface AttributeSelection {
    label: string,
    type: 'existing_attribute' | 'numerical',
    max?: number,
    min?: number,
    step?: number
}

interface AggregationAttribute {
    functionName: string,
    description?: string,
    selections?: Record<string, AttributeSelection>
}

const aggregateFunctions: Record<string, AggregationAttribute> = {
    "Sum": {
        "functionName": "SUM",
        "description": "Sum of selected attribute over each track.",
        "selections": {
            "attr1": {
                "label": "Attribute",
                "type": "existing_attribute"
            }
        }
    },
    "Average": {
        "functionName": "AVG",
        "description": "Average of selected attribute over each track.",
        "selections": {
            "attr1": {
                "label": "Attribute",
                "type": "existing_attribute"
            }
        }
    },
    "Track Length": {
        "functionName": "COUNT",
        "description": "Number of cells in each track."
    },
    "Minimum": {
        "functionName": "MIN",
        "description": "Minimum of selected attribute across each track.",
        "selections": {
            "attr1": {
                "label": "Attribute",
                "type": "existing_attribute"
            }
        }
    },
    "Maximum": {
        "functionName": "MAX",
        "description": "Maximum of selected attribute across each track.",
        "selections": {
            "attr1": {
                "label": "Attribute",
                "type": "existing_attribute"
            }
        }
    },
    "Median Absolute Deviation": {
        "functionName": "MAD",
        "description": "Median of all absolute deviations.",
        "selections": {
            "attr1": {
                "label": "Attribute",
                "type": "existing_attribute"
            }
        }
    },
    "Continuous Quantile": {
        "functionName": "QUANTILE_CONT",
        "description": "The pth continuous quantile of the selected attribute.",
        "selections": {
            "attr1": {
                "label": "Attribute",
                "type": "existing_attribute"
            },
            "var1": {
                "label": "Position",
                "type": "numerical",
                "max": 1,
                "min": 0,
                "step": 0.1
            }
        }
    },
    "Linear Regression Slope": {
        "functionName": "REGR_SLOPE",
        "description": "Slope of the linear regression line between the two selected attributes.",
        "selections": {
            "attr1": {
                "label": "Attribute",
                "type": "existing_attribute"
            },
            "attr2": {
                "label": "Attribute",
                "type": "existing_attribute"
            }
        }
    }
}

export default aggregateFunctions;