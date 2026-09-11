import type { compile } from "vega-lite";
import type { MonthlyCashFlow } from "./cashFlow.js";

const width = 900;
const height = 450;

export type CashFlowLayerLabels = {
    categories: string[];
    minimumAmount: number;
};

type CashFlowChartOptions = {
    title: string;
    yTitle: string;
    yAxisMaximum?: number;
    layerLabels?: CashFlowLayerLabels;
    showIncomeAmounts: boolean;
};

function makeCashFlowChartSpec(
    data: MonthlyCashFlow,
    options: CashFlowChartOptions
): Parameters<typeof compile>[0] {
    if (
        options.yAxisMaximum !== undefined &&
        (!Number.isFinite(options.yAxisMaximum) || options.yAxisMaximum <= 0)
    ) {
        throw new Error(
            `cashFlow.yAxisMaximum must be a positive number; received ${options.yAxisMaximum}`
        );
    }
    if (
        options.layerLabels &&
        (!Number.isFinite(options.layerLabels.minimumAmount) ||
            options.layerLabels.minimumAmount < 0)
    ) {
        throw new Error(
            `cashFlow.layerLabels.minimumAmount must be a non-negative number; received ${options.layerLabels.minimumAmount}`
        );
    }
    const yScale = options.yAxisMaximum
        ? { domain: [0, options.yAxisMaximum], nice: false }
        : { zero: true, nice: true };
    const firstIncome = data.income.reduce<MonthlyCashFlow["income"][number] | null>(
        (first, entry) =>
            !first || entry.month.getTime() < first.month.getTime()
                ? entry
                : first,
        null
    );

    return {
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        title: options.title,
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
                        title: options.yTitle,
                        scale: yScale,
                    },
                    color: {
                        field: "category",
                        type: "nominal",
                        title: "Allocation",
                        sort: "ascending",
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
            ...(options.layerLabels
                ? [
                      {
                          data: { values: data.spending },
                          transform: [
                    {
                        timeUnit: "yearmonth",
                        field: "month",
                        as: "monthBucket",
                    },
                    {
                        aggregate: [
                            {
                                op: "sum",
                                field: "amount",
                                as: "monthlyAmount",
                            },
                        ],
                        groupby: ["monthBucket", "category"],
                    },
                    {
                        impute: "monthlyAmount",
                        key: "monthBucket",
                        groupby: ["category"],
                        value: 0,
                    },
                    {
                        stack: "monthlyAmount",
                        groupby: ["monthBucket"],
                        sort: [
                            {
                                field: "category",
                                order: "descending",
                            },
                        ],
                        as: ["layerStart", "layerEnd"],
                    },
                    {
                        filter: {
                            field: "category",
                            oneOf: options.layerLabels.categories,
                        },
                    },
                    {
                        filter: `datum.monthlyAmount >= ${options.layerLabels.minimumAmount}`,
                    },
                    {
                        calculate: "(datum.layerStart + datum.layerEnd) / 2",
                        as: "layerMiddle",
                    },
                    {
                        calculate:
                            "format(datum.monthlyAmount / 1000, '.1f') + 'k'",
                        as: "label",
                    },
                          ],
                          mark: {
                    type: "text",
                    align: "center",
                    baseline: "middle",
                    color: "#ffffff",
                    fontSize: 11,
                    fontWeight: "bold",
                    clip: true,
                          },
                          encoding: {
                    x: {
                        field: "monthBucket",
                        type: "temporal",
                    },
                    y: {
                        field: "layerMiddle",
                        type: "quantitative",
                        scale: yScale,
                    },
                    text: { field: "label" },
                          },
                      },
                  ]
                : []),
            {
                data: { values: data.income },
                mark: {
                    type: "line",
                    color: "#000000",
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
                        title: options.yTitle,
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
            ...(options.showIncomeAmounts
                ? [
                      {
                          data: { values: data.income },
                          transform: [
                    {
                        calculate: "format(datum.amount / 1000, '.1f') + 'k'",
                        as: "label",
                    },
                          ],
                          mark: {
                    type: "text",
                    align: "center",
                    baseline: "bottom",
                    dy: -6,
                    color: "#000000",
                    fontSize: 11,
                    fontWeight: "bold",
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
                        scale: yScale,
                    },
                    text: { field: "label" },
                          },
                      },
                  ]
                : []),
            ...(firstIncome
                ? [
                      {
                          data: { values: [firstIncome] },
                          mark: {
                              type: "text",
                              align: "left",
                              dx: 8,
                              dy: 18,
                              color: "#000000",
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

export function makeMonthlyCashFlowChartSpec(
    data: MonthlyCashFlow,
    yAxisMaximum: number,
    layerLabels: CashFlowLayerLabels
): Parameters<typeof compile>[0] {
    return makeCashFlowChartSpec(data, {
        title: "Monthly Cash Allocation (scheduled bills and recorded payments)",
        yTitle: "Cash leaving checking ($)",
        yAxisMaximum,
        layerLabels,
        showIncomeAmounts: true,
    });
}

export function makeCumulativeCashFlowChartSpec(
    data: MonthlyCashFlow
): Parameters<typeof compile>[0] {
    return makeCashFlowChartSpec(data, {
        title: "Cumulative Cash Allocation",
        yTitle: "Cumulative cash flow ($)",
        showIncomeAmounts: false,
    });
}
