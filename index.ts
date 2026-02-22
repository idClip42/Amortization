import config from "./config.json" with { type: "json" };
import fs from "fs/promises";
import { compile } from "vega-lite";
import { parse, View } from "vega";
import { makeLineChartSpec } from "./src/makeLineChartSpec.js";
import type { GraphLineData, GraphPointData } from "./src/types.d.ts";

// TODO: What about an adjusted-dollars version?
// TODO: Graphs per payoff-option that show everything on one graph?
// TODO: Break out into separate files?

const monthlyTowardsLoan =
    config.loan.monthlyPayment - config.loan.monthlyEscrow;
const monthlyInterestRate = config.loan.interest / 12 / 100;

const graphData: GraphLineData[] = [];

function runThing(includeLumpSums: boolean, extraMonthlyAmount: number) {
    let currentYear = config.loan.startYear;
    let currentMonth = config.loan.startMonth;
    let interestPaid = 0;
    let remainingPrincipal = config.loan.principal;
    let belowTarget = false;
    const thisData: GraphLineData = {
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

const flatData: GraphPointData[] = graphData.flatMap<GraphPointData>(series =>
    series.points.map<GraphPointData>(p => ({
        date: new Date(p.year, p.month - 1, 1),
        remainingPrincipal: p.remainingPrincipal,
        principalPaid: config.loan.principal - p.remainingPrincipal,
        interestPaid: p.interestPaid,
        totalPaid:
            config.loan.principal - p.remainingPrincipal + p.interestPaid,
        label: series.includeLumpSums
            ? series.extraMonthlyAmount.toString()
            : "30 Year",
    }))
);

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
