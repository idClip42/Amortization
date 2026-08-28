import type { compile } from "vega-lite";
import type { MonthlyCashFlow } from "./cashFlow.js";

const width = 900;
const height = 450;

export function makeCashFlowChartSpec(
    data: MonthlyCashFlow,
    incomeScaleMultiplier: number
): Parameters<typeof compile>[0] {
    if (!Number.isFinite(incomeScaleMultiplier) || incomeScaleMultiplier <= 0) {
        throw new Error(
            `cashFlow.incomeScaleMultiplier must be a positive number; received ${incomeScaleMultiplier}`
        );
    }
    const maxIncome = Math.max(...data.income.map(entry => entry.amount), 0);
    const yMax = maxIncome * incomeScaleMultiplier;
    const yScale = yMax > 0 ? { domain: [0, yMax], nice: false } : { domainMin: 0 };
    const firstIncome = data.income.reduce<MonthlyCashFlow["income"][number] | null>(
        (first, entry) =>
            !first || entry.month.getTime() < first.month.getTime()
                ? entry
                : first,
        null
    );

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
                    clip: true,
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
                        scale: yScale,
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
                    clip: true,
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
                        scale: yScale,
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
            ...(firstIncome
                ? [
                      {
                          data: { values: [firstIncome] },
                          mark: {
                              type: "text",
                              align: "left",
                              dx: 8,
                              dy: -8,
                              color: "#2563eb",
                              fontSize: 13,
                              fontWeight: "bold",
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
                                  scale: yScale,
                              },
                              text: { value: "Income" },
                          },
                      },
                  ]
                : []),
        ],
    } as Parameters<typeof compile>[0];
}
