// TODO: Generate a graph of balance over time, with multiple lines for multiple monthly extras.
// TODO: What other graphs can we generate... total interest paid over time?

import config from "./config.json" with { type: "json" };

const monthlyTowardsLoan =
    config.loan.monthlyPayment - config.loan.monthlyEscrow;
const monthlyInterestRate = config.loan.interest / 12 / 100;

const graphData = [];

function runThing(includeLumpSums, extraMonthlyAmount) {
    let currentYear = config.loan.startYear;
    let currentMonth = config.loan.startMonth;
    let interestPaid = 0;
    let remainingPrincipal = config.loan.principal;
    let belowTarget = false;
    const thisData = {
        extraMonthlyAmount: extraMonthlyAmount,
        points: [],
    };
    graphData.push(thisData);

    while (remainingPrincipal > 0) {
        const thisMonthsInterest = remainingPrincipal * monthlyInterestRate;
        const thisMonthsScheduledPrincipal =
            monthlyTowardsLoan - thisMonthsInterest;
        remainingPrincipal -= thisMonthsScheduledPrincipal;

        if (includeLumpSums) {
            const lumpSum = config.extraPayments.lumpSums.find(
                t => t[0] === currentYear && t[1] === currentMonth
            );
            if (lumpSum) {
                remainingPrincipal -= lumpSum[2];
            }

            if (
                currentYear > config.extraPayments.extraMonthlyStart[0] ||
                (currentYear === config.extraPayments.extraMonthlyStart[0] &&
                    currentMonth >= config.extraPayments.extraMonthlyStart[1])
            ) {
                remainingPrincipal -= extraMonthlyAmount;
            }
        }

        interestPaid += thisMonthsInterest;

        thisData.points.push({
            year: currentYear,
            month: currentMonth,
            remainingPrincipal: remainingPrincipal,
            interestPaid: interestPaid,
        });

        if (remainingPrincipal < config.target.principal && !belowTarget) {
            belowTarget = true;
            console.log(
                `[${extraMonthlyAmount}] [${includeLumpSums ? "x" : " "}] Principal is below \$${config.target.principal.toFixed(2)} in ${currentYear}/${currentMonth}. Total Interest Paid: \$${interestPaid.toFixed(2)}.`
            );
        }

        currentMonth++;
        if (currentMonth > 12) {
            currentYear++;
            currentMonth -= 12;
        }
    }

    console.log(
        `[${extraMonthlyAmount}] [${includeLumpSums ? "x" : " "}] Principal is $0 in ${currentYear}/${currentMonth}. Total Interest Paid: \$${interestPaid.toFixed(2)}.`
    );
}

runThing(false, 0);
for (const extraMonthly of config.extraPayments.extraMonthlyOptions) {
    runThing(true, extraMonthly);
}
