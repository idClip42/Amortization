import config from "./config.json" with { type: "json" };
import { renderGraphs } from "./src/render.js";
import { run } from "./src/run.js";
import { GraphPointData } from "./src/types.js";
import fs from "fs";
import path from "path";

const runConfigs = (() => {
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

    const result: {
        name: string;
        lumpSums: typeof LUMP_SUMS;
        projectedLumpSumAmt: number;
    }[] = [];

    if (config.graphs.includeRaw30Year) {
        result.push({
            name: "No Extra Payments",
            lumpSums: [],
            projectedLumpSumAmt: 0,
        });
    }

    result.push(
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
        const lumpSums = LUMP_SUMS.filter(
            s => s.date.getTime() > startDate.getTime()
        ).map(s => s.dollars);
        const avgLumpSum = Math.round(
            lumpSums.reduce((acc, curr) => acc + curr, 0) / lumpSums.length
        );
        result.push({
            name: `\$${avgLumpSum}/month (Avg.)`,
            lumpSums: LUMP_SUMS,
            projectedLumpSumAmt: avgLumpSum,
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
            interestPaid: data.paidInterest,
            interestPaidAdjusted: data.paidInterestAdjusted,
            totalPaid: data.paidPrincipal + data.paidInterest,
            totalPaidAdjusted:
                data.paidPrincipalAdjusted + data.paidInterestAdjusted,
        }))
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
            config.output.folder
        )
    )
    .then(() =>
        fs.promises.writeFile(
            path.join(config.output.folder, "report.json"),
            JSON.stringify(table, null, 4)
        )
    );
