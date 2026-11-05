export type PrincipalTarget = {
    date: Date;
    remainingPrincipal: number;
};

export type SeriesPrincipalTarget = PrincipalTarget & { series: string };

/** Find the first payment that reaches the target in a chronological schedule. */
export function findPrincipalTarget(
    records: readonly { day: Date; remainingPrincipal: number }[],
    targetPrincipal: number
): PrincipalTarget | undefined {
    const record = records.find(record => record.remainingPrincipal <= targetPrincipal);
    return record && { date: record.day, remainingPrincipal: record.remainingPrincipal };
}

export function formatMonthsRemaining(targetDate: Date, asOf: Date): string {
    const remainingMilliseconds = targetDate.getTime() - asOf.getTime();
    if (remainingMilliseconds <= 0) return "Target reached";
    const averageMonthMilliseconds = (365.2425 / 12) * 24 * 60 * 60 * 1000;
    const months = Math.round(remainingMilliseconds / averageMonthMilliseconds);
    return `${months} ${months === 1 ? "month" : "months"} remaining`;
}
