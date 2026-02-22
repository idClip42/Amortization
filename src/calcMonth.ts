import type { LoanState, ExtraPayments } from "./types.js";

export function calculateMonth(
    { year, month, principalPaid, interestPaid, loan }: LoanState,
    extra: ExtraPayments
): LoanState {
    const monthlyInterestRate = loan.interest / 12 / 100;

    const remainingPrincipal = loan.principal - principalPaid;
    const thisMonthsInterest = remainingPrincipal * monthlyInterestRate;
    interestPaid += thisMonthsInterest;

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

    principalPaid += thisMonthsPrincipal;

    return {
        year,
        month,
        principalPaid,
        interestPaid,
        loan,
    };
}
