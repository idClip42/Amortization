import type { compile } from "vega-lite";

const width = 800;
const height = 400;

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
};

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
}: Input): Parameters<typeof compile>[0] {
    const values = flattenSeries(series);

    const baseLayer = stackedFill
        ? ({
              mark: { type: "area", interpolate: "monotone" },
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
              mark: { type: "line", interpolate: "monotone" },
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
        ],
    };
}
