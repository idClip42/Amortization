import config from "./config.json" with { type: "json" };
import fs from "fs/promises";
import { compile } from "vega-lite";
import { parse, View } from "vega";
import { makeLineChartSpec } from "./src/makeLineChartSpec.js";
import type { GraphPointData } from "./src/types.d.ts";
import { run } from "./src/run.js";

// TODO: What about an adjusted-dollars version?
// TODO: Graphs per payoff-option that show everything on one graph?
// TODO: Break out into separate files?

const graphData: GraphPointData[][] = [];

if (config.graphs.includeRaw30Year) {
    graphData.push(
        run("30 Year", config.loan, {
            lumpSums: [],
            monthly: { start: { year: 0, month: 0 }, amount: 0 },
        })
    );
}

for (const extraMonthly of config.extraPayments.extraMonthlyOptions) {
    graphData.push(
        run(extraMonthly, config.loan, {
            lumpSums: config.extraPayments.lumpSums.map(ls => ({
                year: ls[0],
                month: ls[1],
                amount: ls[2],
            })),
            monthly: {
                start: {
                    year: config.extraPayments.extraMonthlyStart[0],
                    month: config.extraPayments.extraMonthlyStart[1],
                },
                amount: extraMonthly,
            },
        })
    );
}

const flatData: GraphPointData[] = graphData.flat<GraphPointData[][]>();

async function renderSvg(
    spec: Parameters<typeof compile>[0],
    outputPath: string
) {
    const { spec: vegaSpec } = compile(spec);
    const view = new View(parse(vegaSpec), {
        renderer: "svg",
    });

    const svg = await view.toSVG();
    await fs.writeFile(outputPath, svg);
}

fs.mkdir("./output", { recursive: true })
    .then(() => {
        const renderPromises = [];

        const principalRemainingSpec = makeLineChartSpec({
            data: flatData,
            yField: "remainingPrincipal",
            yTitle: "Remaining Principal ($)",
            horizRule: config.target.principal,
        });
        renderPromises.push(
            renderSvg(
                principalRemainingSpec,
                "./output/principal_remaining.svg"
            )
        );

        const interestSpec = makeLineChartSpec({
            data: flatData,
            yField: "interestPaid",
            yTitle: "Total Interest Paid ($)",
        });
        renderPromises.push(
            renderSvg(interestSpec, "./output/interest_paid.svg")
        );

        const principalPaidSpec = makeLineChartSpec({
            data: flatData,
            yField: "principalPaid",
            yTitle: "Principal Paid ($)",
        });
        renderPromises.push(
            renderSvg(principalPaidSpec, "./output/principal_paid.svg")
        );

        const totalPaidSpec = makeLineChartSpec({
            data: flatData,
            yField: "totalPaid",
            yTitle: "Total Paid ($)",
        });
        renderPromises.push(
            renderSvg(totalPaidSpec, "./output/total_paid.svg")
        );

        return Promise.all(renderPromises);
    })
    .then(() => {
        console.log("All graphs rendered.");
    });
