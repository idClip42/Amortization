import type { YearMonth } from "./types.js";
import * as cpi from "cpi-us";
import config from "./../config.json" with { type: "json" };

type InflationInput = {
    input: YearMonth & { dollars: number };
    target: YearMonth;
};

const [earliest, latest] = cpi.getDateRange();
const latestCpi = cpi.getCPI(latest.year, latest.month);
if (!latestCpi) throw new Error("Failed to get latest CPI?");
const earliestCpi = cpi.getCPI(earliest.year, earliest.month);
if (!earliestCpi) throw new Error("Failed to get earliest CPI?");

export function adjustForInflation({ input, target }: InflationInput): number {
    const cpiInput = getCpi(input);
    const cpiTarget = getCpi(target);
    const cpiRatio = cpiTarget / cpiInput;
    return input.dollars * cpiRatio;
}

/**
 *  Returns CPI for a date, using historical data when available,
 * clamping before range and estimating after range.
 */
function getCpi({ year, month }: YearMonth): number {
    // If the year is too early, we can't do anything with it.
    if (
        year < earliest.year ||
        (year === earliest.year && month < earliest.month)
    ) {
        console.warn(`WARN: ${year} ${month} is before CPI data set.`);
        return Number(earliestCpi);
    }

    // If the year is in range, we can get an actual historical CPI.
    if (year < latest.year || (year === latest.year && month <= latest.month)) {
        const cpiStr = cpi.getCPI(year, month);
        if (!cpiStr) {
            console.warn(`WARN: Failed to get CPI for ${year} ${month}.`);
            return Number(latestCpi);
        }
        return Number(cpiStr);
    }

    // If the year is after our data set, we calculate an estimate.
    const estimatedAnnualRate = config.inflation.estimatedRatePercentage / 100;
    const monthsDelta = (year - latest.year) * 12 + (month - latest.month);
    return (
        Number(latestCpi) * Math.pow(1 + estimatedAnnualRate, monthsDelta / 12)
    );
}
