import config from "./config.json" with { type: "json" };
import fs from "fs/promises";
import { compile } from "vega-lite";
import { parse, View } from "vega";
import { makeLineChartSpec } from "./src/makeLineChartSpec.js";

// TODO: What about an adjusted-dollars version?
// TODO: What about an "amount paid off" version?
// TODO: Graphs per payoff-option that show everything on one graph?
// TODO: Break out into separate files?
// TODO: Types?

const monthlyTowardsLoan =
    config.loan.monthlyPayment - config.loan.monthlyEscrow;
const monthlyInterestRate = config.loan.interest / 12 / 100;

const graphData = [];

function runThing(includeLumpSums, extraMonthlyAmount) {
    let currentYear = config.loan.startYear;
    let currentMonth = config.loan.startMonth;
    let interestPaid = 0;
    let remainingPrincipal = config.loan.principal;
    let belowTarget = false;
    const thisData = {
        includeLumpSums: includeLumpSums,
        extraMonthlyAmount: extraMonthlyAmount,
        points: [],
    };
    graphData.push(thisData);

    while (remainingPrincipal > 0) {
        const thisMonthsInterest = remainingPrincipal * monthlyInterestRate;
        const thisMonthsScheduledPrincipal =
            monthlyTowardsLoan - thisMonthsInterest;
        remainingPrincipal -= thisMonthsScheduledPrincipal;

        if (includeLumpSums) {
            const lumpSum = config.extraPayments.lumpSums.find(
                t => t[0] === currentYear && t[1] === currentMonth
            );
            if (lumpSum) {
                remainingPrincipal -= lumpSum[2];
            }

            if (
                currentYear > config.extraPayments.extraMonthlyStart[0] ||
                (currentYear === config.extraPayments.extraMonthlyStart[0] &&
                    currentMonth >= config.extraPayments.extraMonthlyStart[1])
            ) {
                remainingPrincipal -= extraMonthlyAmount;
            }
        }

        interestPaid += thisMonthsInterest;

        thisData.points.push({
            year: currentYear,
            month: currentMonth,
            remainingPrincipal: remainingPrincipal,
            interestPaid: interestPaid,
        });

        if (remainingPrincipal < config.target.principal && !belowTarget) {
            belowTarget = true;
            console.log(
                `[${extraMonthlyAmount}] [${includeLumpSums ? "x" : " "}] Principal is below \$${config.target.principal.toFixed(2)} in ${currentYear}/${currentMonth}. Total Interest Paid: \$${interestPaid.toFixed(2)}.`
            );
        }

        currentMonth++;
        if (currentMonth > 12) {
            currentYear++;
            currentMonth -= 12;
        }
    }

    console.log(
        `[${extraMonthlyAmount}] [${includeLumpSums ? "x" : " "}] Principal is $0 in ${currentYear}/${currentMonth}. Total Interest Paid: \$${interestPaid.toFixed(2)}.`
    );
}

if (config.graphs.includeRaw30Year) runThing(false, 0);

for (const extraMonthly of config.extraPayments.extraMonthlyOptions) {
    runThing(true, extraMonthly);
}

const flatData = graphData.flatMap(series =>
    series.points.map(p => ({
        date: new Date(p.year, p.month - 1, 1),
        remainingPrincipal: p.remainingPrincipal,
        interestPaid: p.interestPaid,
        label: series.includeLumpSums ? series.extraMonthlyAmount : "30 Year",
    }))
);

async function renderSvg(spec, outputPath) {
    const { spec: vegaSpec } = compile(spec);
    const view = new View(parse(vegaSpec), {
        renderer: "svg",
    });

    const svg = await view.toSVG();
    await fs.writeFile(outputPath, svg);
}

await fs.mkdir("./output", { recursive: true });

// Graph 1: Remaining principal
const principalSpec = makeLineChartSpec({
    data: flatData,
    yField: "remainingPrincipal",
    yTitle: "Remaining Principal ($)",
});
principalSpec.layer.push({
    mark: {
        type: "rule",
        color: "red",
        strokeDash: [6, 6],
    },
    encoding: {
        y: { datum: config.target.principal },
        x: {
            aggregate: "min",
            field: "date",
            type: "temporal",
        },
        x2: {
            aggregate: "max",
            field: "date",
        },
    },
});

await renderSvg(principalSpec, "./output/remaining_principal.svg");

// Graph 2: Total interest paid
const interestSpec = makeLineChartSpec({
    data: flatData,
    yField: "interestPaid",
    yTitle: "Total Interest Paid ($)",
});

await renderSvg(interestSpec, "./output/total_interest_paid.svg");
