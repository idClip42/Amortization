import config from "./config.json" with { type: "json" };
import type { GraphPointData } from "./src/types.d.ts";
import { run } from "./src/run.js";
import { renderGraphs } from "./src/render.js";

const currentDate = new Date();
const graphData: GraphPointData[][] = [];

if (config.graphs.includeRaw30Year) {
    graphData.push(
        run(
            "No Extra Payments",
            config.loan,
            {
                lumpSums: [],
                monthly: { start: { year: 0, month: 0 }, amount: 0 },
            },
            currentDate
        )
    );
}

for (const extraMonthly of config.extraPayments.extraMonthlyOptions) {
    graphData.push(
        run(
            `\$${extraMonthly} Extra Monthly`,
            config.loan,
            {
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
            },
            currentDate
        )
    );
}

renderGraphs(
    graphData.flat<GraphPointData[][]>(),
    config.loan,
    config.target.principal,
    currentDate
);
