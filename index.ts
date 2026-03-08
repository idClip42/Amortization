import config from "./config.json" with { type: "json" };
import type { GraphPointData, YearMonth } from "./src/types.d.ts";
import { run } from "./src/run.js";
import { renderGraphs } from "./src/render.js";

// TODO: Vertical line on graph indicating today?

const currentDate = new Date();
const graphData: GraphPointData[][] = [];

const configOptionalEndDate: number[] | null = config.graphs.optionalEndDate;
const optionalEndDate: YearMonth | null = configOptionalEndDate
    ? {
          year: configOptionalEndDate[0],
          month: configOptionalEndDate[1],
      }
    : null;

if (config.graphs.includeRaw30Year) {
    graphData.push(
        run(
            "No Extra Payments",
            config.loan,
            {
                lumpSums: [],
                monthly: { start: { year: 0, month: 0 }, amount: 0 },
            },
            currentDate,
            optionalEndDate
        )
    );
}

const prevLumpSums = config.extraPayments.lumpSums.map(ls => ({
    year: ls[0],
    month: ls[1],
    amount: ls[2],
}));
const lastLumpSum = prevLumpSums[prevLumpSums.length - 1];

const extraMonthlyStart = {
    year: lastLumpSum.year,
    month: lastLumpSum.month,
};
if (extraMonthlyStart.month >= 12) {
    extraMonthlyStart.month %= 12;
    extraMonthlyStart.year++;
}

for (const extraMonthly of config.extraPayments.extraMonthlyOptions) {
    graphData.push(
        run(
            `\$${extraMonthly} Extra Monthly`,
            config.loan,
            {
                lumpSums: prevLumpSums,
                monthly: {
                    start: extraMonthlyStart,
                    amount: extraMonthly,
                },
            },
            currentDate,
            optionalEndDate
        )
    );
}

renderGraphs(
    graphData.flat<GraphPointData[][]>(),
    config.loan,
    config.target.principal,
    currentDate
);
