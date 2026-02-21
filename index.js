// TODO: Break out config file.
// TODO: Generate a graph of balance over time, with multiple lines for multiple monthly extras.
// TODO: What other graphs can we generate... total interest paid over time?

const PRINCIPAL = 150000;
const INTEREST = 5.625;
const START_YEAR = 2025;
const START_MONTH = 8;
const MONTHLY = 1245.46;
const MONTHLY_ESCROW = 381.98;
const LUMP_SUMS = [
    [2025, 9, 15000],
    [2025, 10, 31500],
    [2025, 11, 4200],
    [2025, 12, 1500],
    [2026, 2, 6000],
];
const EXTRA_MONTHLY_START = [2026, 3];
const EXTRA_MONTHLY_OPTIONS = [0, 1000, 2000, 2500, 3000, 3500, 4000, 4500];
const TARGET_PRINCIPAL = 20000;

const monthlyTowardsLoan = MONTHLY - MONTHLY_ESCROW;
const monthlyInterest = INTEREST / 12;

function runThing(includeLumpSums, extraMonthlyAmount) {
    let currentYear = START_YEAR;
    let currentMonth = START_MONTH;
    let interestPaid = 0;
    let remainingPrincipal = PRINCIPAL;
    let belowTarget = false;

    while (remainingPrincipal > 0) {
        const thisMonthsInterest = remainingPrincipal * (monthlyInterest / 100);
        const thisMonthsScheduledPrincipal = MONTHLY - thisMonthsInterest;
        remainingPrincipal -= thisMonthsScheduledPrincipal;

        // console.log(
        //     `[${extraMonthly}] ${currentYear}/${currentMonth}: P=\$${thisMonthsPrincipal.toFixed(2)}, I=\$${thisMonthsInterest.toFixed(2)}, R=\$${remainingPrincipal.toFixed(2)}.`,
        // );

        if (includeLumpSums) {
            const lumpSum = LUMP_SUMS.find(
                t => t[0] === currentYear && t[1] === currentMonth,
            );
            if (lumpSum) {
                remainingPrincipal -= lumpSum[2];
                // console.log(
                //     `[${extraMonthly}] Lump Sum: \$${lumpSum[2].toFixed(2)}, R=\$${remainingPrincipal.toFixed(2)}.`,
                // );
            }

            if (
                currentYear > EXTRA_MONTHLY_START[0] ||
                (currentYear === EXTRA_MONTHLY_START[0] &&
                    currentMonth >= EXTRA_MONTHLY_START[1])
            ) {
                remainingPrincipal -= extraMonthlyAmount;
                // console.log(
                //     `[${extraMonthly}] Extra Monthly: \$${extraMonthly.toFixed(2)}, R=\$${remainingPrincipal.toFixed(2)}.`,
                // );
            }
        }

        interestPaid += thisMonthsInterest;
        currentMonth++;
        if (currentMonth > 12) {
            currentYear++;
            currentMonth -= 12;
        }

        if (remainingPrincipal < TARGET_PRINCIPAL && !belowTarget) {
            belowTarget = true;
            console.log(
                `[${extraMonthlyAmount}] [${includeLumpSums ? "x" : " "}] Principal is below \$${TARGET_PRINCIPAL.toFixed(2)} in ${currentYear}/${currentMonth}. Total Interest Paid: \$${interestPaid.toFixed(2)}.`,
            );
        }
    }

    console.log(
        `[${extraMonthlyAmount}] [${includeLumpSums ? "x" : " "}] Principal is $0 in ${currentYear}/${currentMonth}. Total Interest Paid: \$${interestPaid.toFixed(2)}.`,
    );
}

runThing(false, 0);
for (const extraMonthly of EXTRA_MONTHLY_OPTIONS) {
    runThing(true, extraMonthly);
}
