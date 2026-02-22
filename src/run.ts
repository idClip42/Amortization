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
        principalPaid: 0,
        interestPaid: 0,
        loan: loan,
    };
    const graphData: GraphPointData[] = [];

    while (state.principalPaid < loan.principal) {
        state = calculateMonth(state, extra);

        graphData.push({
            label: label,
            date: new Date(state.year, state.month - 1, 1),
            remainingPrincipal: loan.principal - state.principalPaid,
            principalPaid: state.principalPaid,
            interestPaid: state.interestPaid,
            totalPaid: state.principalPaid + state.interestPaid,
        });

        state.month++;
        if (state.month > 12) {
            state.year++;
            state.month -= 12;
        }
    }

    return graphData;
}
