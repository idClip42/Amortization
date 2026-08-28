import type { compile } from "vega-lite";
import type { MonthlyCashFlow } from "./cashFlow.js";

const width = 900;
const height = 450;

export function makeCashFlowChartSpec(
    data: MonthlyCashFlow
): Parameters<typeof compile>[0] {
    return {
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        title: "Monthly Cash Allocation (scheduled bills and recorded payments)",
        width,
        height,
        layer: [
            {
                data: { values: data.spending },
                mark: {
                    type: "area",
                    interpolate: "linear",
                },
                encoding: {
                    x: {
                        field: "month",
                        type: "temporal",
                        timeUnit: "yearmonth",
                        title: "Month",
                        axis: { format: "%b %Y", labelAngle: -35 },
                    },
                    y: {
                        field: "amount",
                        type: "quantitative",
                        aggregate: "sum",
                        stack: "zero",
                        title: "Cash leaving checking ($)",
                        scale: { domainMin: 0 },
                    },
                    color: {
                        field: "category",
                        type: "nominal",
                        title: "Allocation",
                    },
                    tooltip: [
                        {
                            field: "month",
                            type: "temporal",
                            timeUnit: "yearmonth",
                            title: "Month",
                        },
                        {
                            field: "category",
                            type: "nominal",
                            title: "Allocation",
                        },
                        {
                            field: "amount",
                            type: "quantitative",
                            aggregate: "sum",
                            title: "Amount",
                            format: "$.2f",
                        },
                    ],
                },
            },
            {
                data: { values: data.income },
                mark: {
                    type: "line",
                    color: "#2563eb",
                    strokeDash: [8, 5],
                    strokeWidth: 3,
                },
                encoding: {
                    x: {
                        field: "month",
                        type: "temporal",
                        timeUnit: "yearmonth",
                    },
                    y: {
                        field: "amount",
                        type: "quantitative",
                        aggregate: "sum",
                        title: "Cash leaving checking ($)",
                        scale: { domainMin: 0 },
                    },
                    tooltip: [
                        {
                            field: "month",
                            type: "temporal",
                            timeUnit: "yearmonth",
                            title: "Month",
                        },
                        {
                            field: "amount",
                            type: "quantitative",
                            aggregate: "sum",
                            title: "Income",
                            format: "$.2f",
                        },
                    ],
                },
            },
        ],
    } as Parameters<typeof compile>[0];
}
