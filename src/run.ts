import { adjustForInflation } from "./inflation.js";

const TODAYS_DATE = new Date();

type DateRecord = {
    day: Date;
    remainingPrincipal: number;
    paidPrincipal: number;
    paidPrincipalAdjusted: number;
    paidPrincipalToday: number;
    interestAccrued: number;
    paidInterest: number;
    paidInterestAdjusted: number;
    paidInterestToday: number;
    tag: "" | "payment" | "lumpSum" | "projectedLumpSum";
};

export function run(
    startDate: Date,
    initialPrincipal: number,
    interestRate: number,
    monthlyTowardLoanForDate: (date: Date) => number,
    monthlyPaymentDay: number,
    lumpSums: { date: Date; dollars: number }[],
    projectedLumpSumForDate: (date: Date) => number
): DateRecord[] {
    const day: Date = startDate;
    const dailyInterest = interestRate / 365 / 100;

    let remainingPrincipal = initialPrincipal;
    let interestAcc = 0;
    let paidPrincipal = 0;
    let paidInterest = 0;
    let paidPrincipalAdjusted = 0;
    let paidInterestAdjusted = 0;
    const records: DateRecord[] = [];

    while (remainingPrincipal > 0) {
        // Add to the interest accumulator
        interestAcc += remainingPrincipal * dailyInterest;
        const cachedInterest = interestAcc;

        let tag: DateRecord["tag"] = "";
        let paidPrincipalToday = 0;
        let paidInterestToday = 0;

        const inflInput = {
            year: day.getFullYear(),
            month: day.getMonth() + 1,
        };
        const inflTarget = {
            year: TODAYS_DATE.getFullYear(),
            month: TODAYS_DATE.getMonth() + 1,
        };

        if (day.getDate() === monthlyPaymentDay) {
            const todaysPayment = Math.min(
                remainingPrincipal,
                monthlyTowardLoanForDate(day) - interestAcc
            );

            paidPrincipalToday = todaysPayment;
            paidInterestToday = interestAcc;

            paidInterest += paidInterestToday;
            remainingPrincipal -= paidPrincipalToday;
            paidPrincipal += paidPrincipalToday;

            paidPrincipalAdjusted += adjustForInflation({
                input: {
                    ...inflInput,
                    dollars: todaysPayment,
                },
                target: inflTarget,
            });
            paidInterestAdjusted += adjustForInflation({
                input: {
                    ...inflInput,
                    dollars: interestAcc,
                },
                target: inflTarget,
            });

            interestAcc = 0;
            tag = "payment";
        }

        for (const lumpSum of lumpSums) {
            const sameDay =
                day.toLocaleDateString() === lumpSum.date.toLocaleDateString();
            if (!sameDay) continue;
            const applied = Math.min(Math.max(remainingPrincipal, 0), lumpSum.dollars);
            if (applied <= 0) continue;
            remainingPrincipal -= applied;
            paidPrincipal += applied;
            paidPrincipalToday += applied;
            paidPrincipalAdjusted += adjustForInflation({
                input: {
                    ...inflInput,
                    dollars: applied,
                },
                target: inflTarget,
            });
            tag = "lumpSum";
        }

        const projectedAmount = projectedLumpSumForDate(day);
        if (!Number.isFinite(projectedAmount) || projectedAmount < 0) {
            throw new Error(`Invalid projected lump sum on ${day.toLocaleDateString()}.`);
        }
        const projectedApplied = Math.min(Math.max(remainingPrincipal, 0), projectedAmount);
        if (projectedApplied > 0) {
            remainingPrincipal -= projectedApplied;
            paidPrincipal += projectedApplied;
            paidPrincipalToday += projectedApplied;
            paidPrincipalAdjusted += adjustForInflation({
                input: {
                    ...inflInput,
                    dollars: projectedApplied,
                },
                target: inflTarget,
            });
            tag = "projectedLumpSum";
        }

        records.push({
            day: new Date(day),
            remainingPrincipal,
            paidPrincipal,
            paidPrincipalToday,
            paidInterest,
            paidInterestToday,
            interestAccrued: cachedInterest,
            paidPrincipalAdjusted,
            paidInterestAdjusted,
            tag,
        });

        // Advance the date.
        day.setDate(day.getDate() + 1);
    }

    // console.table(records);
    return records;
}
