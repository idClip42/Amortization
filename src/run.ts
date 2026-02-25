import type Config from "./../config.json";
import { calculateMonth } from "./calcMonth.js";
import type { ExtraPayments, GraphPointData, LoanState } from "./types.js";

export function run(
    label: string,
    loan: (typeof Config)["loan"],
    extra: ExtraPayments,
    inflationDate: Date
): GraphPointData[] {
    let state: LoanState = {
        year: loan.startYear,
        month: loan.startMonth,
        principalPaid: 0,
        principalPaidAdjusted: 0,
        interestPaid: 0,
        interestPaidAdjusted: 0,
        loan: loan,
    };
    const graphData: GraphPointData[] = [];

    while (state.principalPaid < loan.principal) {
        state = calculateMonth(state, extra, inflationDate);

        graphData.push({
            name: label,
            date: new Date(state.year, state.month - 1, 1),
            remainingPrincipal: loan.principal - state.principalPaid,
            principalPaid: state.principalPaid,
            principalPaidAdjusted: state.principalPaidAdjusted,
            interestPaid: state.interestPaid,
            interestPaidAdjusted: state.interestPaidAdjusted,
            totalPaid: state.principalPaid + state.interestPaid,
            totalPaidAdjusted:
                state.principalPaidAdjusted + state.interestPaidAdjusted,
        });

        state.month++;
        if (state.month > 12) {
            state.year++;
            state.month -= 12;
        }
    }

    return graphData;
}
