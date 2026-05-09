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
if (config.graphs.includeRaw30Year)
    configs.push({
        name: "No Extra Payments",
        lumpSums: [],
        projectedLumpSumAmt: 0,
    });
configs.push(
    ...config.projectedLumpSums.options.map(pls => ({
        name: `\$${pls}/month`,
        lumpSums: LUMP_SUMS,
        projectedLumpSumAmt: pls,
    }))
);

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
        config.graphs.optionalEndDate
            ? new Date(config.graphs.optionalEndDate)
            : null,
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

const graphPointData: GraphPointData[] = dataSets.flatMap(ds =>
    ds.data
        .filter(data => {
            if (!config.graphs.skipUneventfulDays) return true;
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
