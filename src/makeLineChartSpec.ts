import type { compile } from "vega-lite";
import CONFIG from "./../config.json" with { type: "json" };

const width = 800;
const height = 400;
const CALLOUT_HEADLINE_FONT_SIZE = 15;
const AXIS_LABEL_FONT_SIZE = 10;
const INTERPOLATE: "monotone" | "linear" = "linear";

type XYPoint = {
    x: Date;
    y: number;
};

export type Series = {
    name: string | number;
    data: XYPoint[];
};

type Input = {
    title: string;
    series: Series[];
    yTitle: string;
    /** Draw a horizontal rule if provided */
    horizRule: number;
    /** Fill between stacked series (area chart style) */
    stackedFill?: boolean;
    pointLabels?: PointLabel[];
    callout?: {
        series: string | number;
        headline: string;
        detail: string;
    };
};

type PointLabel = {
    /** Omit to annotate every series. */
    series?: string | number;
    x?: Date;
    y?: number;
    labelExpression: string;
};

function findClosestXPoint(referenceY: number, points: XYPoint[]): XYPoint {
    if (points.length === 0) throw new Error("No points!");
    let closest: XYPoint = points[0];
    let closestDist: number = Number.MAX_VALUE;
    for (const pt of points) {
        let dist = Math.abs(referenceY - pt.y);
        if (dist < closestDist) {
            closest = pt;
            closestDist = dist;
        }
    }
    return closest;
}

function findClosestYPoint(referenceX: Date, points: XYPoint[]): XYPoint {
    if (points.length === 0) throw new Error("No points!");
    let closest: XYPoint = points[0];
    let closestDist: number = Number.MAX_VALUE;
    const refXNum = referenceX.getTime();
    for (const pt of points) {
        let dist = Math.abs(refXNum - pt.x.getTime());
        if (dist < closestDist) {
            closest = pt;
            closestDist = dist;
        }
    }
    return closest;
}

function flattenSeries(series: Series[]) {
    return series.flatMap(s =>
        s.data.map(p => ({
            x: p.x,
            y: p.y,
            series: s.name,
        }))
    );
}

export function makeLineChartSpec({
    title,
    series,
    yTitle,
    horizRule,
    stackedFill = false,
    pointLabels = [],
    callout,
}: Input): Parameters<typeof compile>[0] {
    const values = flattenSeries(series);

    const baseLayer = stackedFill
        ? ({
              mark: {
                  type: "area",
                  interpolate: INTERPOLATE,
              },
              encoding: {
                  x: {
                      field: "x",
                      type: "temporal",
                      title: "Date",
                      axis: { format: "%Y-%m" },
                  },
                  y: {
                      field: "y",
                      type: "quantitative",
                      title: yTitle,
                      stack: "zero",
                      scale: { domainMin: 0 },
                  },
                  color: {
                      field: "series",
                      type: "nominal",
                      title: "Series",
                      scale: {
                          domain: series.map(s => s.name),
                      },
                  },
              },
          } as const)
        : ({
              mark: {
                  type: "line",
                  interpolate: INTERPOLATE,
              },
              encoding: {
                  x: {
                      field: "x",
                      type: "temporal",
                      title: "Date",
                      axis: { format: "%Y-%m" },
                  },
                  y: {
                      field: "y",
                      type: "quantitative",
                      title: yTitle,
                      scale: { domainMin: 0 },
                  },
                  color: {
                      field: "series",
                      type: "nominal",
                      title: "Series",
                      scale: {
                          domain: series.map(s => s.name),
                      },
                  },
              },
          } as const);

    let labelVertOffsetIndex = 0;

    return {
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        title,
        width,
        height,
        config: { axis: { labelFontSize: AXIS_LABEL_FONT_SIZE } },

        data: { values },

        layer: [
            baseLayer,
            {
                mark: {
                    type: "rule",
                    color: "red",
                    strokeDash: [6, 6],
                },
                encoding: {
                    y: { datum: horizRule },
                    x: {
                        aggregate: "min",
                        field: "x",
                        type: "temporal",
                    },
                    x2: {
                        aggregate: "max",
                        field: "x",
                    },
                },
            },
            {
                mark: {
                    type: "rule",
                    strokeDash: [6, 6],
                    color: "#666",
                },
                encoding: {
                    x: {
                        datum: new Date().getTime(),
                        type: "temporal",
                    },
                    y: {
                        aggregate: "min",
                        field: "y",
                        type: "quantitative",
                    },
                    y2: {
                        aggregate: "max",
                        field: "y",
                    },
                },
            },
            ...series.flatMap(s => {
                const pointLabelData = pointLabels
                    .filter(pl => pl.series === undefined || pl.series === s.name)
                    .map(pl => {
                        if (pl.x === undefined && pl.y === undefined)
                            throw new Error("Undefined x and y");

                        const x =
                            pl.x !== undefined
                                ? pl.x
                                : findClosestXPoint(pl.y!, s.data).x;
                        const y =
                            pl.y !== undefined
                                ? pl.y
                                : findClosestYPoint(pl.x!, s.data).y;

                        return {
                            x: x,
                            y: y,
                            series: s.name,
                            labelExpression: pl.labelExpression,
                        };
                    });

                return [
                    {
                        data: {
                            values: pointLabelData,
                        },
                        mark: {
                            type: "point" as const,
                            filled: true,
                            size: 100,
                        },
                        encoding: {
                            x: { field: "x", type: "temporal" as const },
                            y: { field: "y", type: "quantitative" as const },
                            color: {
                                field: "series",
                                type: "nominal" as const,
                            },
                        },
                    },
                    ...pointLabelData.map(pl => ({
                        transform: [
                            {
                                calculate: pl.labelExpression,
                                as: "label" as const,
                            },
                        ],
                        data: {
                            values: [pl],
                        },
                        mark: {
                            type: "text" as const,
                            dx: 12,
                            dy:
                                -12 -
                                CONFIG.graphs.labelVertOffset *
                                    labelVertOffsetIndex++,
                            fontSize: CONFIG.graphs.labelFontSize,
                        },
                        encoding: {
                            x: { field: "x", type: "temporal" as const },
                            y: { field: "y", type: "quantitative" as const },
                            text: { field: "label" },
                            color: {
                                field: "series",
                                type: "nominal" as const,
                            },
                        },
                    })),
                ];
            }),
            ...(callout ? [
                {
                    data: { values: [{ series: callout.series, text: callout.headline }] },
                    mark: {
                        type: "text" as const,
                        align: "right" as const,
                        baseline: "top" as const,
                        fontSize: CALLOUT_HEADLINE_FONT_SIZE,
                        fontWeight: "bold" as const,
                    },
                    encoding: {
                        x: { value: width - 20 },
                        y: { value: 20 },
                        text: { field: "text" },
                        color: { field: "series", type: "nominal" as const },
                    },
                },
                ...[callout.detail, String(callout.series)].map((text, index) => ({
                    data: { values: [{ text }] },
                    mark: {
                        type: "text" as const,
                        align: "right" as const,
                        baseline: "top" as const,
                        fontSize: AXIS_LABEL_FONT_SIZE,
                        color: "#666",
                    },
                    encoding: {
                        x: { value: width - 20 },
                        y: { value: 38 + index * 12 },
                        text: { field: "text" },
                    },
                })),
            ] : []),
        ],
    };
}
