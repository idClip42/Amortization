export type LumpSum = {
    date: Date;
    dollars: number;
};

export type MonthlyLumpSumHistory = {
    month: Date;
    monthlyTotal: number;
    runningAverage: number;
};

/** Match the projection average: start with the first eligible payment month. */
export function buildMonthlyLumpSumHistory(
    lumpSums: LumpSum[],
    averageStartDate: Date
): MonthlyLumpSumHistory[] {
    const eligible = lumpSums.filter(
        lumpSum => lumpSum.date.getTime() > averageStartDate.getTime()
    );
    if (eligible.length === 0) return [];

    const monthIndex = (date: Date) => date.getFullYear() * 12 + date.getMonth();
    const firstMonth = Math.min(...eligible.map(item => monthIndex(item.date)));
    const lastMonth = Math.max(...eligible.map(item => monthIndex(item.date)));
    const totals = new Map<number, number>();

    for (const item of eligible) {
        const month = monthIndex(item.date);
        totals.set(month, (totals.get(month) ?? 0) + item.dollars);
    }

    let cumulativeTotal = 0;
    const history: MonthlyLumpSumHistory[] = [];
    for (let index = firstMonth; index <= lastMonth; index++) {
        const monthlyTotal = totals.get(index) ?? 0;
        cumulativeTotal += monthlyTotal;
        history.push({
            month: new Date(Math.floor(index / 12), index % 12, 1),
            monthlyTotal,
            runningAverage: Math.round(
                cumulativeTotal / (index - firstMonth + 1)
            ),
        });
    }

    return history;
}
