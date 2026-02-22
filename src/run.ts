import type Config from "./../config.json";
import { calculateMonth } from "./calcMonth.js";
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
    const graphData: GraphPointData[] = [];

    while (state.remainingPrincipal > 0) {
        state = calculateMonth(
            state,
            loan.monthlyPayment - loan.monthlyEscrow,
            loan.interest / 12 / 100,
            extra
        );

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
