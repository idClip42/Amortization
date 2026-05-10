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

type LumpSumProjection = {
    startDate: Date;
    paymentDate: number;
    dollars: number;
};

export function run(
    startDate: Date,
    optionalEndDate: Date | null,
    initialPrincipal: number,
    interestRate: number,
    monthlyPayment: number,
    monthlyPaymentDay: number,
    lumpSums: { date: Date; dollars: number }[],
    lumpSumProjection: LumpSumProjection
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
            const todaysPayment = monthlyPayment - interestAcc;
            paidInterest += interestAcc;
            remainingPrincipal -= todaysPayment;
            paidPrincipal += todaysPayment;

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
            remainingPrincipal -= lumpSum.dollars;
            paidPrincipal += lumpSum.dollars;
            paidPrincipalToday += lumpSum.dollars;
            paidPrincipalAdjusted += adjustForInflation({
                input: {
                    ...inflInput,
                    dollars: lumpSum.dollars,
                },
                target: inflTarget,
            });
            tag = "lumpSum";
        }

        if (day.getTime() > lumpSumProjection.startDate.getTime()) {
            if (day.getDate() === lumpSumProjection.paymentDate) {
                remainingPrincipal -= lumpSumProjection.dollars;
                paidPrincipal += lumpSumProjection.dollars;
                paidPrincipalToday += lumpSumProjection.dollars;
                paidPrincipalAdjusted += adjustForInflation({
                    input: {
                        ...inflInput,
                        dollars: lumpSumProjection.dollars,
                    },
                    target: inflTarget,
                });
                tag = "projectedLumpSum";
            }
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

        if (optionalEndDate && day.getTime() > optionalEndDate.getTime()) break;
    }

    // console.table(records);
    return records;
}
