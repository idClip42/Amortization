export function makeLineChartSpec({ data, yField, yTitle }) {
    return {
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        width: 800,
        height: 400,
        data: { values: data },

        encoding: {
            x: {
                field: "date",
                type: "temporal",
                title: "Date",
                axis: {
                    format: "%Y-%m",
                    tickCount: {},
                },
            },
            color: {
                field: "label",
                type: "nominal",
                title: "Extra Monthly Payment ($)",
            },
        },

        layer: [
            {
                mark: { type: "line" },
                encoding: {
                    y: {
                        field: yField,
                        type: "quantitative",
                        title: yTitle,
                        scale: { domainMin: 0 },
                    },
                },
            },
        ],
    };
}
