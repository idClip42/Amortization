import config from "./config.json" with { type: "json" };
import { renderGraphs } from "./src/render.js";
import { run } from "./src/run.js";
import { GraphPointData } from "./src/types.js";

const LUMP_SUMS = config.lumpSums.map(value => {
    const dateString = value[0];
    if (typeof dateString !== "string")
        throw new Error("Invalid lump sums type");
    const dollars = value[1];
    if (typeof dollars !== "number") throw new Error("Invalid lump sums type");
    const date = new Date(dateString);
    if (isNaN(date.getTime()))
        throw new Error(`Invalid date string: ${dateString}`);
    return {
        date,
        dollars,
    };
});

const configs: {
    name: string;
    lumpSums: typeof LUMP_SUMS;
    projectedLumpSumAmt: number;
}[] = [];

if (config.graphs.includeRaw30Year) {
    configs.push({
        name: "No Extra Payments",
        lumpSums: [],
        projectedLumpSumAmt: 0,
    });
}

configs.push(
    ...config.projectedLumpSums.options.map(pls => ({
        name: `\$${pls}/month`,
        lumpSums: LUMP_SUMS,
        projectedLumpSumAmt: pls,
    }))
);

if (config.projectedLumpSums.includeAverage) {
    const startDate = new Date(config.projectedLumpSums.averageStartDate);
    if (isNaN(startDate.getTime()))
        throw new Error(`Invalid date string: ${startDate}`);
    const lumpSumsToAvg = LUMP_SUMS.filter(
        s => s.date.getTime() > startDate.getTime()
    ).map(s => s.dollars);
    const avgLumpSum = Math.round(
        lumpSumsToAvg.reduce((acc, curr) => acc + curr, 0) /
            lumpSumsToAvg.length
    );
    configs.push({
        name: `\$${avgLumpSum}/month (Avg.)`,
        lumpSums: LUMP_SUMS,
        projectedLumpSumAmt: avgLumpSum,
    });
}

const dataSets = configs.map(cfg => {
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
        config.loan.monthlyPayment - config.loan.monthlyEscrow,
        config.loan.paymentDay,
        cfg.lumpSums,
        {
            startDate: new Date(config.projectedLumpSums.startDate),
            paymentDate: config.projectedLumpSums.paymentDay,
            dollars: cfg.projectedLumpSumAmt,
        }
    );
    return {
        name: cfg.name,
        data: data,
    };
});

console.table(
    dataSets.map(ds => {
        const last = ds.data[ds.data.length - 1];
        const target = ds.data.find(
            ds => ds.remainingPrincipal < config.target.principal
        );
        return {
            Name: ds.name,
            "End Date": last.day.toLocaleDateString(),
            "Target Date": target?.day.toLocaleDateString(),
            "Interest Paid ($)": Math.round(last.paidInterest * 100) / 100,
            Payments: ds.data.filter(d => d.tag === "payment").length,
            "Lump Sums": ds.data.filter(
                d =>
                    (d.tag === "lumpSum" || d.tag === "projectedLumpSum") &&
                    d.paidPrincipalToday > 0
            ).length,
        };
    })
);

const graphPointData: GraphPointData[] = dataSets.flatMap(ds =>
    ds.data
        .filter(data => {
            if (!config.graphs.skipUneventfulDays) return true;
            if (config.graphs.optionalEndDate) {
                const end = new Date(config.graphs.optionalEndDate);
                if (isNaN(end.getTime()))
                    throw new Error(`Invalid date string: ${end}`);
                if (data.day.getTime() > end.getTime()) return false;
            }
            return data.tag !== "";
        })
        .map<GraphPointData>(data => ({
            name: ds.name,
            date: data.day,
            remainingPrincipal: data.remainingPrincipal,
            principalPaid: data.paidPrincipal,
            principalPaidAdjusted: data.paidPrincipalAdjusted,
            interestPaid: data.paidInterest,
            interestPaidAdjusted: data.paidInterestAdjusted,
            totalPaid: data.paidPrincipal + data.paidInterest,
            totalPaidAdjusted:
                data.paidPrincipalAdjusted + data.paidInterestAdjusted,
        }))
);

renderGraphs(graphPointData, config.loan, config.target.principal, new Date());
