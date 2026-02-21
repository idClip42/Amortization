import config from "./config.json" with { type: "json" };
import fs from "fs/promises";
import { compile } from "vega-lite";
import { parse, View } from "vega";

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

runThing(false, 0);
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

function makeLineChartSpec({ data, yField, yTitle, targetValue }) {
    return {
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        width: 800,
        height: 400,
        data: { values: data },

        encoding: {
            x: {
                field: "date",
                type: "temporal",
                title: "Date",
            },
            color: {
                field: "label",
                type: "nominal",
                title: "Extra Monthly Payment ($)",
            },
        },

        layer: [
            {
                mark: { type: "line" },
                encoding: {
                    y: {
                        field: yField,
                        type: "quantitative",
                        title: yTitle,
                        scale: { domainMin: 0 },
                    },
                },
            },
        ],
    };
}

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
    targetValue: config.target.principal,
});

await renderSvg(principalSpec, "./output/remaining_principal.svg");

// Graph 2: Total interest paid
const interestSpec = makeLineChartSpec({
    data: flatData,
    yField: "interestPaid",
    yTitle: "Total Interest Paid ($)",
    targetValue: config.target.principal,
});

await renderSvg(interestSpec, "./output/total_interest_paid.svg");
