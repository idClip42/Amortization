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
    series,
    yTitle,
    horizRule,
    stackedFill = false,
}: Input): Parameters<typeof compile>[0] {
    const values = flattenSeries(series);

    const baseLayer = stackedFill
        ? ({
              mark: {
                  type: "area",
                  interpolate: "monotone",
              },
              encoding: {
                  y: {
                      field: "y",
                      type: "quantitative",
                      stack: "zero",
                      scale: { domainMin: 0 },
                  },
              },
          } as const)
        : ({
              mark: {
                  type: "line",
                  interpolate: "monotone",
              },
              encoding: {
                  y: {
                      field: "y",
                      type: "quantitative",
                      scale: { domainMin: 0 },
                  },
              },
          } as const);

    return {
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        width,
        height,

        data: { values },

        encoding: {
            x: {
                field: "x",
                type: "temporal",
                title: "Date",
                axis: { format: "%Y-%m" },
            },
            y: {
                title: yTitle,
            },
            color: {
                field: "series",
                type: "nominal",
                title: "Series",
            },
        },

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
        ],
    };
}
