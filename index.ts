import config from "./config.json" with { type: "json" };
import { renderGraphs } from "./src/render.js";
// import type { GraphPointData, YearMonth } from "./src/types.d.ts";
// import { run } from "./src/run.js";
// import { renderGraphs } from "./src/render.js";
import { run2 } from "./src/run2.js";
import { GraphPointData } from "./src/types.js";

// // TODO: Vertical line on graph indicating today?

// const START_YEAR = 2025;
// const START_MONTH = 8;
// const PAYMENT_DAY = 1;

// const PRINCIPAL = 150000;
// const MONTHLY_PAYMENT = 1245.46;
// const MONTHLY_ESCROW = 381.98;
// const INTEREST = 5.625;

// const LUMP_SUMS_RAW: [string, number][] = [
//     ["September 4, 2025", 15000],
//     ["October 2, 2025", 1500],
//     ["October 8, 2025", 30000],
//     ["November 10, 2025", 4200],
//     ["December 10, 2025", 1500],
//     ["February 10, 2026", 6000],
//     ["March 11, 2026", 3000],
//     ["March 23, 2026", 2500],
//     ["April 10, 2026", 3000],
// ];

// const MONTHLY_PRINCIPAL = MONTHLY_PAYMENT - MONTHLY_ESCROW;
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
    const data = run2(
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
console.log(dataSets);

// const currentDate = new Date();
// const graphData: GraphPointData[][] = [];

// const configOptionalEndDate: number[] | null = config.graphs.optionalEndDate;
// const optionalEndDate: YearMonth | null = configOptionalEndDate
//     ? {
//           year: configOptionalEndDate[0],
//           month: configOptionalEndDate[1],
//       }
//     : null;

// if (config.graphs.includeRaw30Year) {
//     graphData.push(
//         run(
//             "No Extra Payments",
//             config.loan,
//             {
//                 lumpSums: [],
//                 monthly: { start: { year: 0, month: 0 }, amount: 0 },
//             },
//             currentDate,
//             optionalEndDate
//         )
//     );
// }

// const prevLumpSums = config.extraPayments.lumpSums.map(ls => ({
//     year: ls[0],
//     month: ls[1],
//     amount: ls[2],
// }));
// const lastLumpSum = prevLumpSums[prevLumpSums.length - 1];

// const extraMonthlyStart = {
//     year: lastLumpSum.year,
//     month: lastLumpSum.month,
// };
// if (extraMonthlyStart.month >= 12) {
//     extraMonthlyStart.month %= 12;
//     extraMonthlyStart.year++;
// }

// for (const extraMonthly of config.extraPayments.extraMonthlyOptions) {
//     graphData.push(
//         run(
//             `\$${extraMonthly} Extra Monthly`,
//             config.loan,
//             {
//                 lumpSums: prevLumpSums,
//                 monthly: {
//                     start: extraMonthlyStart,
//                     amount: extraMonthly,
//                 },
//             },
//             currentDate,
//             optionalEndDate
//         )
//     );
// }

// renderGraphs(
//     graphData.flat<GraphPointData[][]>(),
//     config.loan,
//     config.target.principal,
//     currentDate
// );

const graphPointData: GraphPointData[] = dataSets.flatMap(ds =>
    ds.data.map<GraphPointData>(data => ({
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
