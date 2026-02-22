import { adjustForInflation } from "./inflation.js";
import type { LoanState, ExtraPayments } from "./types.js";

export function calculateMonth(
    {
        year,
        month,
        principalPaid,
        principalPaidAdjusted,
        interestPaid,
        interestPaidAdjusted,
        loan,
    }: LoanState,
    extra: ExtraPayments,
    inflationDate: Date
): LoanState {
    const monthlyInterestRate = loan.interest / 12 / 100;

    const remainingPrincipal = loan.principal - principalPaid;
    const thisMonthsInterest = remainingPrincipal * monthlyInterestRate;

    const monthlyTowardsLoan = loan.monthlyPayment - loan.monthlyEscrow;
    let thisMonthsPrincipal = monthlyTowardsLoan - thisMonthsInterest;
    const lumpSum =
        extra.lumpSums.find(test => test.year === year && test.month === month)
            ?.amount || 0;
    thisMonthsPrincipal += lumpSum;
    if (
        year > extra.monthly.start.year ||
        (year === extra.monthly.start.year &&
            month >= extra.monthly.start.month)
    )
        thisMonthsPrincipal += extra.monthly.amount;

    interestPaid += thisMonthsInterest;
    principalPaid += thisMonthsPrincipal;

    const inflationYear = inflationDate.getFullYear();
    const inflationMonth = inflationDate.getMonth() + 1;
    const thisMonthsInterestAdjusted = adjustForInflation({
        input: {
            year,
            month,
            dollars: thisMonthsInterest,
        },
        target: {
            year: inflationYear,
            month: inflationMonth,
        },
    });
    const thisMonthsPrincipalAdjusted = adjustForInflation({
        input: {
            year,
            month,
            dollars: thisMonthsPrincipal,
        },
        target: {
            year: inflationYear,
            month: inflationMonth,
        },
    });

    return {
        year,
        month,
        principalPaid,
        principalPaidAdjusted:
            principalPaidAdjusted + thisMonthsPrincipalAdjusted,
        interestPaid,
        interestPaidAdjusted: interestPaidAdjusted + thisMonthsInterestAdjusted,
        loan,
    };
}
