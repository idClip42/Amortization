import type { GraphPointData } from "./types.d.ts";
import type { compile } from "vega-lite";

type Input = {
    data: GraphPointData[];
    yField: keyof GraphPointData;
    yTitle: string;
    horizRule?: number;
};

export function makeLineChartSpec({
    data,
    yField,
    yTitle,
    horizRule,
}: Input): Parameters<typeof compile>[0] {
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
            {
                // TODO: Make optional
                mark: {
                    type: "rule",
                    color: "red",
                    strokeDash: [6, 6],
                },
                encoding: {
                    y: { datum: horizRule || -1 },
                    x: {
                        aggregate: "min",
                        field: "date",
                        type: "temporal",
                    },
                    x2: {
                        aggregate: "max",
                        field: "date",
                    },
                },
            },
        ],
    };
}
