import config from "./config.json" with { type: "json" };
import fs from "fs/promises";
import { compile } from "vega-lite";
import { parse, View } from "vega";
import { makeLineChartSpec } from "./src/makeLineChartSpec.js";
import type {
    ExtraPayments,
    GraphPointData,
    LoanState,
} from "./src/types.d.ts";

// TODO: What about an adjusted-dollars version?
// TODO: Graphs per payoff-option that show everything on one graph?
// TODO: Break out into separate files?

const monthlyTowardsLoan =
    config.loan.monthlyPayment - config.loan.monthlyEscrow;
const monthlyInterestRate = config.loan.interest / 12 / 100;

const graphData: GraphPointData[] = [];

function runThing(includeLumpSums: boolean, extraMonthlyAmount: number) {
    let state: LoanState = {
        year: config.loan.startYear,
        month: config.loan.startMonth,
        remainingPrincipal: config.loan.principal,
        interestPaid: 0,
    };

    const extra: ExtraPayments = {
        lumpSums: includeLumpSums
            ? config.extraPayments.lumpSums.map(ls => ({
                  year: ls[0],
                  month: ls[1],
                  amount: ls[2],
              }))
            : [],
        monthly: includeLumpSums
            ? {
                  start: {
                      year: config.extraPayments.extraMonthlyStart[0],
                      month: config.extraPayments.extraMonthlyStart[1],
                  },
                  amount: extraMonthlyAmount,
              }
            : { start: { year: 0, month: 0 }, amount: 0 },
    };

    const label = includeLumpSums ? extraMonthlyAmount : "30 Year";

    while (state.remainingPrincipal > 0) {
        const thisMonthsInterest =
            state.remainingPrincipal * monthlyInterestRate;
        state.interestPaid += thisMonthsInterest;

        const thisMonthsScheduledPrincipal =
            monthlyTowardsLoan - thisMonthsInterest;
        state.remainingPrincipal -= thisMonthsScheduledPrincipal;

        const lumpSum =
            extra.lumpSums.find(
                test => test.year === state.year && test.month === state.month
            )?.amount || 0;
        state.remainingPrincipal -= lumpSum;

        if (
            state.year > extra.monthly.start.year ||
            (state.year === extra.monthly.start.year &&
                state.month >= extra.monthly.start.month)
        )
            state.remainingPrincipal -= extra.monthly.amount;

        graphData.push({
            label: label,
            date: new Date(state.year, state.month - 1, 1),
            remainingPrincipal: state.remainingPrincipal,
            principalPaid: config.loan.principal - state.remainingPrincipal,
            interestPaid: state.interestPaid,
            totalPaid:
                config.loan.principal -
                state.remainingPrincipal +
                state.interestPaid,
        });

        state.month++;
        if (state.month > 12) {
            state.year++;
            state.month -= 12;
        }
    }
}

if (config.graphs.includeRaw30Year) runThing(false, 0);

for (const extraMonthly of config.extraPayments.extraMonthlyOptions) {
    runThing(true, extraMonthly);
}

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
            data: graphData,
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
            data: graphData,
            yField: "interestPaid",
            yTitle: "Total Interest Paid ($)",
        });
        renderPromises.push(
            renderSvg(interestSpec, "./output/interest_paid.svg")
        );

        const principalPaidSpec = makeLineChartSpec({
            data: graphData,
            yField: "principalPaid",
            yTitle: "Principal Paid ($)",
        });
        renderPromises.push(
            renderSvg(principalPaidSpec, "./output/principal_paid.svg")
        );

        const totalPaidSpec = makeLineChartSpec({
            data: graphData,
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
