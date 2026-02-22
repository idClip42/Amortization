import config from "./config.json" with { type: "json" };
import type { GraphPointData } from "./src/types.d.ts";
import { run } from "./src/run.js";
import { renderGraphs } from "./src/render.js";

// TODO: What about an adjusted-dollars version?
// TODO: Graphs per payoff-option that show everything on one graph?
// TODO: Break out into separate files?

const graphData: GraphPointData[][] = [];

if (config.graphs.includeRaw30Year) {
    graphData.push(
        run("No Extra Payments", config.loan, {
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

renderGraphs(graphData.flat<GraphPointData[][]>(), config.target.principal);
