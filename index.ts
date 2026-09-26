import config from "./config.json" with { type: "json" };
import { renderGraphs } from "./src/render.js";
import { run } from "./src/run.js";
import { GraphPointData } from "./src/types.js";
import { buildCumulativeCashFlow, buildMonthlyCashFlow } from "./src/cashFlow.js";
import { CashFlowLayerLabels } from "./src/makeCashFlowChartSpec.js";
import { createLoanPaymentSchedule } from "./src/loanPaymentSchedule.js";
import { buildMonthlyLumpSumHistory } from "./src/lumpSumHistory.js";
import { buildCashFlowProjection } from "./src/cashFlowProjection.js";
import fs from "fs";
import path from "path";

const projectionStartDate = new Date(config.projectedLumpSums.startDate);
if (Number.isNaN(projectionStartDate.getTime())) {
    throw new Error(`Invalid projected lump sum start date: ${config.projectedLumpSums.startDate}`);
}
if (projectionStartDate.getTime() < Date.now()) {
    throw new Error(
        `Projected lump sum date ${config.projectedLumpSums.startDate} is before today.`
    );
}

const loanPaymentSchedule = createLoanPaymentSchedule(
    config.loan.monthlyPaymentChanges
);
const initialMonthlyTowardLoan = loanPaymentSchedule.monthlyTowardLoanForDate(
    new Date(config.loan.startYear, config.loan.startMonth - 1, 1)
);

console.table([
    {
        Start: new Date(
            config.loan.startYear,
            config.loan.startMonth - 1
        ).toLocaleDateString(),
        "Principal ($)": config.loan.principal,
        "Interest (%)": config.loan.interest,
        "Monthly ($)": initialMonthlyTowardLoan,
    },
]);

const LUMP_SUMS = config.lumpSums.map(value => {
    const dateString = value[0];
    if (typeof dateString !== "string")
        throw new Error("Invalid lump sums type");
    const dollars = value[1];
    if (typeof dollars !== "number")
        throw new Error("Invalid lump sums type");
    const date = new Date(dateString);
    if (isNaN(date.getTime()))
        throw new Error(`Invalid date string: ${dateString}`);
    return {
        date,
        dollars,
    };
});
console.log("Lump Sums");
console.table(
    LUMP_SUMS.map(s => ({
        Date: s.date.toLocaleDateString(),
        Dollars: s.dollars,
    }))
);
console.log(
    "Total Lump Sum:",
    LUMP_SUMS.map(ls => ls.dollars).reduce((acc, curr) => curr + acc, 0)
);

const averageStartDate = new Date(config.projectedLumpSums.averageStartDate);
if (isNaN(averageStartDate.getTime()))
    throw new Error(
        `Invalid date string: ${config.projectedLumpSums.averageStartDate}`
    );
const lumpSumHistory = buildMonthlyLumpSumHistory(
    LUMP_SUMS,
    averageStartDate
);

const cashFlowProjection = config.cashFlowProjection.enabled
    ? buildCashFlowProjection({
          startAfter: projectionStartDate,
          paymentDay: config.projectedLumpSums.paymentDay,
          months: config.cashFlowProjection.months,
          creditCardAverageStartMonth:
              config.cashFlowProjection.creditCardAverageStartMonth,
          loanPaymentDay: config.loan.paymentDay,
          loanPaymentChanges: config.loan.monthlyPaymentChanges,
          income: config.cashFlow.income,
          monthlyCreditCardPayments: config.cashFlow.monthlyCreditCardPayments,
          recurringExpenses: config.cashFlow.recurringExpenses,
          gasPayments: config.cashFlow.gasPayments,
          electricPayments: config.cashFlow.electricPayments,
      })
    : null;
const cashFlowAmountsByDate = new Map(
    cashFlowProjection?.months.map(month => [month.date.getTime(), month.lumpSum]) ?? []
);
if (cashFlowProjection) {
    console.log(
        `Cash-flow forecast credit-card average: $${cashFlowProjection.creditCardAverage.toFixed(2)} ` +
            `from ${cashFlowProjection.creditCardSampleMonths.length} months.`
    );
}

const fixedProjectionForDate = (dollars: number) => (date: Date): number =>
    date.getTime() > projectionStartDate.getTime() &&
    date.getDate() === config.projectedLumpSums.paymentDay
        ? dollars
        : 0;

const runConfigs = (() => {
    const result: {
        name: string;
        lumpSums: typeof LUMP_SUMS;
        projectedLumpSumForDate: (date: Date) => number;
        forecastEndDate?: Date;
    }[] = [];

    if (config.graphs.includeRaw30Year) {
        result.push({
            name: "No Extra Payments",
            lumpSums: [],
            projectedLumpSumForDate: fixedProjectionForDate(0),
        });
    }

    result.push(
        ...config.projectedLumpSums.options.map(pls => ({
            name: `\$${pls}/month`,
            lumpSums: LUMP_SUMS,
            projectedLumpSumForDate: fixedProjectionForDate(pls),
        }))
    );

    if (config.projectedLumpSums.includeAverage) {
        console.log(
            `Calculating average lump sum after ${averageStartDate.toLocaleDateString()}...`
        );
        const lumpSumDatas = LUMP_SUMS.filter(
            s => s.date.getTime() > averageStartDate.getTime()
        );
        for (const d of lumpSumDatas)
            console.log("-", d.date.toLocaleDateString(), d.dollars);

        if (lumpSumHistory.length === 0)
            throw new Error("No lump sums after the average start date.");
        console.log(
            `${lumpSumHistory.length} months, ${lumpSumDatas.length} lump sums.`
        );

        const avgLumpSum =
            lumpSumHistory[lumpSumHistory.length - 1].runningAverage;
        console.log(`Average lump sum: \$${avgLumpSum}`);

        result.push({
            name: `\$${avgLumpSum}/month (Avg.)`,
            lumpSums: LUMP_SUMS,
            projectedLumpSumForDate: fixedProjectionForDate(avgLumpSum),
        });
    }

    if (cashFlowProjection) {
        result.push({
            name: "Cash Flow Forecast",
            lumpSums: LUMP_SUMS,
            projectedLumpSumForDate: date =>
                cashFlowAmountsByDate.get(date.getTime()) ?? 0,
            forecastEndDate:
                cashFlowProjection.months[cashFlowProjection.months.length - 1].date,
        });
    }

    return result;
})();

const dataSets = runConfigs.map(cfg => {
    const data = run(
        new Date(
            config.loan.startYear,
            config.loan.startMonth - 1,
            // First payment is one month after start date.
            // We want to accrue interest
            // but wait til next month to make a payment.
            config.loan.paymentDay + 1
        ),
        config.loan.principal,
        config.loan.interest,
        loanPaymentSchedule.monthlyTowardLoanForDate,
        config.loan.paymentDay,
        cfg.lumpSums,
        cfg.projectedLumpSumForDate
    );
    if (
        cfg.forecastEndDate &&
        data[data.length - 1].day.getTime() > cfg.forecastEndDate.getTime()
    ) {
        throw new Error(
            `Cash-flow forecast did not pay off the loan within ${config.cashFlowProjection.months} months.`
        );
    }
    return {
        name: cfg.name,
        data: data,
    };
});
const cashFlowProjectionOutput = (() => {
    if (!cashFlowProjection) return null;
    const cashFlowData = dataSets.find(ds => ds.name === "Cash Flow Forecast");
    if (!cashFlowData) throw new Error("Cash-flow forecast data is missing.");
    const cashFlowAppliedByDate = new Map(
        cashFlowData.data
            .filter(record => record.tag === "projectedLumpSum")
            .map(record => [record.day.getTime(), record.paidPrincipalToday])
    );
    return {
        ...cashFlowProjection,
        months: cashFlowProjection.months.map(month => ({
            ...month,
            appliedToLoan: Math.round(
                (cashFlowAppliedByDate.get(month.date.getTime()) ?? 0) * 100
            ) / 100,
        })),
    };
})();

const graphEndDate: Date | null = (() => {
    if (!config.graphs.optionalEndDate) return null;
    const end = new Date(config.graphs.optionalEndDate);
    if (isNaN(end.getTime())) throw new Error(`Invalid date string: ${end}`);
    return end;
})();

const table = dataSets.map(ds => {
    const last = ds.data[ds.data.length - 1];
    const target = ds.data.find(
        d => d.remainingPrincipal < config.target.principal
    );
    if (!target) throw new Error("Could not find target date.");
    const cutoff = (() => {
        if (!graphEndDate) return null;
        const endExclusiveIndex = ds.data.findIndex(
            d => d.day.getTime() > graphEndDate?.getTime()
        );
        return ds.data[endExclusiveIndex - 1];
    })();

    const interestPaid = Math.round(last.paidInterest * 100) / 100;

    return {
        Name: ds.name,
        "End Date": last.day.toLocaleDateString(),
        [`\$${config.target.principal} Date`]: target?.day.toLocaleDateString(),
        "Interest Paid ($)": interestPaid,
        ...(graphEndDate && {
            [`Interest Paid by ${graphEndDate?.toLocaleDateString()} (\$)`]:
                cutoff
                    ? Math.round(cutoff.paidInterest * 100) / 100
                    : interestPaid,
        }),
    };
});
console.table(table);

const graphPointData: GraphPointData[] = dataSets.flatMap(ds =>
    ds.data
        .filter(data => {
            if (config.graphs.skipUneventfulDays && data.tag === "")
                return false;
            if (graphEndDate && data.day.getTime() > graphEndDate.getTime())
                return false;
            return true;
        })
        .map<GraphPointData>(data => ({
            name: ds.name,
            date: data.day,
            remainingPrincipal: data.remainingPrincipal,
            principalPaid: data.paidPrincipal,
            principalPaidAdjusted: data.paidPrincipalAdjusted,
            principalPaidToday: data.paidPrincipalToday,
            interestPaid: data.paidInterest,
            interestPaidAdjusted: data.paidInterestAdjusted,
            interestPaidToday: data.paidInterestToday,
            totalPaid: data.paidPrincipal + data.paidInterest,
            totalPaidAdjusted:
                data.paidPrincipalAdjusted + data.paidInterestAdjusted,
            tag: data.tag,
        }))
);

const monthlyCashFlow = buildMonthlyCashFlow(config, new Date());
const cumulativeCashFlow = buildCumulativeCashFlow(
    monthlyCashFlow,
    config.cashFlow.cumulativeStartMonth
);

fs.promises
    .rm(config.output.folder, { recursive: true, force: true })
    .then(() => fs.promises.mkdir(config.output.folder))
    .then(() =>
        renderGraphs(
            graphPointData,
            config.loan,
            config.target.principal,
            new Date(),
            config.output.folder,
            lumpSumHistory,
            averageStartDate,
            monthlyCashFlow,
            cumulativeCashFlow,
            config.cashFlow.yAxisMaximum,
            config.cashFlow.layerLabels as CashFlowLayerLabels
        )
    )
    .then(() => {
        const dataPromise = fs.promises.writeFile(
            path.join(config.output.folder, "data.json"),
            JSON.stringify(dataSets, null, 4)
        );
        const reportPromise = fs.promises.writeFile(
            path.join(config.output.folder, "report.json"),
            JSON.stringify(table, null, 4)
        );
        const lumpSumHistoryPromise = fs.promises
            .mkdir(path.join(config.output.folder, "lump-sums"), {
                recursive: true,
            })
            .then(() =>
                fs.promises.writeFile(
                    path.join(
                        config.output.folder,
                        "lump-sums/monthly-and-average.json"
                    ),
                    JSON.stringify(
                        lumpSumHistory.map(entry => ({
                            month: `${entry.month.getFullYear()}-${String(
                                entry.month.getMonth() + 1
                            ).padStart(2, "0")}`,
                            monthlyTotal: entry.monthlyTotal,
                            runningAverage: entry.runningAverage,
                        })),
                        null,
                        4
                    )
                )
            );
        const cashFlowPromise = fs.promises.writeFile(
            path.join(config.output.folder, "cash-flow/monthly-cash-allocation.json"),
            JSON.stringify(monthlyCashFlow, null, 4)
        );
        const cumulativeCashFlowPromise = fs.promises.writeFile(
            path.join(config.output.folder, "cash-flow/cumulative-cash-allocation.json"),
            JSON.stringify(cumulativeCashFlow, null, 4)
        );
        const cashFlowProjectionPromise = cashFlowProjectionOutput
            ? fs.promises.writeFile(
                  path.join(config.output.folder, "cash-flow/projected-lump-sums.json"),
                  JSON.stringify(cashFlowProjectionOutput, null, 4)
              )
            : Promise.resolve();
        return Promise.all([
            dataPromise,
            reportPromise,
            lumpSumHistoryPromise,
            cashFlowPromise,
            cumulativeCashFlowPromise,
            cashFlowProjectionPromise,
        ]);
    });
