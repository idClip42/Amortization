import type Config from "./../config.json";
import type { ExtraPayments, GraphPointData, LoanState } from "./types.js";

export function run(
    label: string | number,
    loan: (typeof Config)["loan"],
    extra: ExtraPayments
): GraphPointData[] {
    let state: LoanState = {
        year: loan.startYear,
        month: loan.startMonth,
        remainingPrincipal: loan.principal,
        interestPaid: 0,
    };
    const monthlyTowardsLoan = loan.monthlyPayment - loan.monthlyEscrow;
    const monthlyInterestRate = loan.interest / 12 / 100;
    const graphData: GraphPointData[] = [];

    while (state.remainingPrincipal > 0) {
        const thisMonthsInterest =
            state.remainingPrincipal * monthlyInterestRate;
        state.interestPaid += thisMonthsInterest;

        const thisMonthsScheduledPrincipal =
            monthlyTowardsLoan - thisMonthsInterest;
        state.remainingPrincipal -= thisMonthsScheduledPrincipal;

        const lumpSum =
            extra.lumpSums.find(
                test => test.year === state.year && test.month === state.month
            )?.amount || 0;
        state.remainingPrincipal -= lumpSum;

        if (
            state.year > extra.monthly.start.year ||
            (state.year === extra.monthly.start.year &&
                state.month >= extra.monthly.start.month)
        )
            state.remainingPrincipal -= extra.monthly.amount;

        graphData.push({
            label: label,
            date: new Date(state.year, state.month - 1, 1),
            remainingPrincipal: state.remainingPrincipal,
            principalPaid: loan.principal - state.remainingPrincipal,
            interestPaid: state.interestPaid,
            totalPaid:
                loan.principal - state.remainingPrincipal + state.interestPaid,
        });

        state.month++;
        if (state.month > 12) {
            state.year++;
            state.month -= 12;
        }
    }

    return graphData;
}
