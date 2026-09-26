import type { compile } from "vega-lite";
import type { MonthlyLumpSumHistory } from "./lumpSumHistory.js";

export function makeLumpSumHistoryChartSpec(
    history: MonthlyLumpSumHistory[],
    averageStartDate: Date
): Parameters<typeof compile>[0] {
    const series = ["Monthly lump sums", "Running monthly average"];
    const latest = history[history.length - 1];
    const barSize = Math.min(28, Math.max(2, Math.floor(600 / history.length)));
    const values = history.flatMap(entry => [
        {
            month: entry.month,
            amount: entry.monthlyTotal,
            series: series[0],
        },
        {
            month: entry.month,
            amount: entry.runningAverage,
            series: series[1],
        },
    ]);

    return {
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        title: {
            text: "Monthly Lump Sums and Running Average",
            subtitle: `Payments after ${averageStartDate.toLocaleDateString()}; months with no lump sum count toward the average`,
        },
        width: 800,
        height: 400,
        data: { values },
        encoding: {
            x: {
                field: "month",
                type: "temporal",
                title: "Month",
                axis: { format: "%b %Y", labelAngle: -45 },
            },
            y: {
                field: "amount",
                type: "quantitative",
                title: "Lump sum ($ per month)",
                axis: { format: "$,.0f" },
                scale: { domainMin: 0 },
            },
            color: {
                field: "series",
                type: "nominal",
                title: null,
                scale: {
                    domain: series,
                    range: ["#4C78A8", "#E45756"],
                },
            },
            tooltip: [
                { field: "month", type: "temporal", format: "%B %Y" },
                { field: "series", type: "nominal", title: "Series" },
                {
                    field: "amount",
                    type: "quantitative",
                    title: "Amount",
                    format: "$,.0f",
                },
            ],
        },
        layer: [
            {
                transform: [{ filter: "datum.series === 'Monthly lump sums'" }],
                mark: { type: "bar", size: barSize, opacity: 0.7 },
            },
            {
                transform: [{ filter: "datum.series === 'Running monthly average'" }],
                mark: {
                    type: "line",
                    strokeWidth: 3,
                    point: { filled: true, size: 65 },
                },
            },
            {
                data: {
                    values: [
                        {
                            month: latest.month,
                            amount: latest.runningAverage,
                            series: series[1],
                            label: `$${latest.runningAverage.toLocaleString()}`,
                        },
                    ],
                },
                mark: {
                    type: "text",
                    align: "right",
                    dx: -10,
                    dy: -12,
                    fontWeight: "bold",
                    fontSize: 13,
                },
                encoding: {
                    text: { field: "label", type: "nominal" },
                    tooltip: null,
                },
            },
        ],
    };
}
