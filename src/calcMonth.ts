import type { LoanState, ExtraPayments } from "./types.js";

export function calculateMonth(
    { year, month, principalPaid, interestPaid, loan }: LoanState,
    extra: ExtraPayments
): LoanState {
    const monthlyTowardsLoan = loan.monthlyPayment - loan.monthlyEscrow;
    const monthlyInterestRate = loan.interest / 12 / 100;

    const remainingPrincipal = loan.principal - principalPaid;
    const thisMonthsInterest = remainingPrincipal * monthlyInterestRate;
    interestPaid += thisMonthsInterest;

    const thisMonthsScheduledPrincipal =
        monthlyTowardsLoan - thisMonthsInterest;
    principalPaid += thisMonthsScheduledPrincipal;

    const lumpSum =
        extra.lumpSums.find(test => test.year === year && test.month === month)
            ?.amount || 0;
    principalPaid += lumpSum;

    if (
        year > extra.monthly.start.year ||
        (year === extra.monthly.start.year &&
            month >= extra.monthly.start.month)
    )
        principalPaid += extra.monthly.amount;

    return {
        year,
        month,
        principalPaid,
        interestPaid,
        loan,
    };
}
