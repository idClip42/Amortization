import type { LoanState, ExtraPayments } from "./types.js";

export function calculateMonth(
    { year, month, remainingPrincipal, interestPaid }: LoanState,
    monthlyTowardsLoan: number,
    monthlyInterestRate: number,
    extra: ExtraPayments
): LoanState {
    const thisMonthsInterest = remainingPrincipal * monthlyInterestRate;
    interestPaid += thisMonthsInterest;

    const thisMonthsScheduledPrincipal =
        monthlyTowardsLoan - thisMonthsInterest;
    remainingPrincipal -= thisMonthsScheduledPrincipal;

    const lumpSum =
        extra.lumpSums.find(test => test.year === year && test.month === month)
            ?.amount || 0;
    remainingPrincipal -= lumpSum;

    if (
        year > extra.monthly.start.year ||
        (year === extra.monthly.start.year &&
            month >= extra.monthly.start.month)
    )
        remainingPrincipal -= extra.monthly.amount;

    return {
        year,
        month,
        remainingPrincipal,
        interestPaid,
    };
}
