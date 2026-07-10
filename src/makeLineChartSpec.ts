import type { compile } from "vega-lite";

const width = 800;
const height = 400;
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
};

type PointLabel = {
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

    return {
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        title,
        width,
        height,

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
                const pointLabelData = pointLabels.map(pl => {
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
                            color: "red",
                        },
                        encoding: {
                            x: { field: "x", type: "temporal" as const },
                            y: { field: "y", type: "quantitative" as const },
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
                            dy: -12,
                            color: "red",
                        },
                        encoding: {
                            x: { field: "x", type: "temporal" as const },
                            y: { field: "y", type: "quantitative" as const },
                            text: { field: "label" },
                        },
                    })),
                ];
            }),
        ],
    };
}
