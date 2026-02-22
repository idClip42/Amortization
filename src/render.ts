import fs from "fs/promises";
import { compile } from "vega-lite";
import { parse, View } from "vega";
import { GraphPointData } from "./types.js";
import { makeLineChartSpec } from "./makeLineChartSpec.js";

async function renderSvg(
    spec: Parameters<typeof compile>[0],
    outputPath: string
): Promise<void> {
    const { spec: vegaSpec } = compile(spec);
    const view = new View(parse(vegaSpec), {
        renderer: "svg",
    });

    const svg = await view.toSVG();
    await fs.writeFile(outputPath, svg);
}

export function renderGraphs(
    data: GraphPointData[],
    targetPrincipal: number,
    inflationDate: Date
): Promise<void> {
    return fs
        .mkdir("./output", { recursive: true })
        .then(() => {
            const renderPromises = [];

            // REMAINING PRINCIPAL

            const principalRemainingSpec = makeLineChartSpec({
                data: data,
                yField: "remainingPrincipal",
                yTitle: "Remaining Principal ($)",
                horizRule: targetPrincipal,
            });
            renderPromises.push(
                renderSvg(
                    principalRemainingSpec,
                    "./output/principal_remaining.svg"
                )
            );

            // AMOUNT PAID

            const interestSpec = makeLineChartSpec({
                data: data,
                yField: "interestPaid",
                yTitle: "Total Interest Paid ($)",
            });
            renderPromises.push(
                renderSvg(interestSpec, "./output/interest_paid.svg")
            );

            const principalPaidSpec = makeLineChartSpec({
                data: data,
                yField: "principalPaid",
                yTitle: "Principal Paid ($)",
            });
            renderPromises.push(
                renderSvg(principalPaidSpec, "./output/principal_paid.svg")
            );

            const totalPaidSpec = makeLineChartSpec({
                data: data,
                yField: "totalPaid",
                yTitle: "Total Paid ($)",
            });
            renderPromises.push(
                renderSvg(totalPaidSpec, "./output/total_paid.svg")
            );

            // AMOUNT PAID (ADJUSTED)

            const interestAdjSpec = makeLineChartSpec({
                data: data,
                yField: "interestPaidAdjusted",
                yTitle: `Total Interest Paid (${inflationDate.getFullYear()}$)`,
            });
            renderPromises.push(
                renderSvg(
                    interestAdjSpec,
                    "./output/adjusted_interest_paid.svg"
                )
            );

            const principalPaidAdjSpec = makeLineChartSpec({
                data: data,
                yField: "principalPaidAdjusted",
                yTitle: `Principal Paid (${inflationDate.getFullYear()}$)`,
            });
            renderPromises.push(
                renderSvg(
                    principalPaidAdjSpec,
                    "./output/adjusted_principal_paid.svg"
                )
            );

            const totalPaidAdjSpec = makeLineChartSpec({
                data: data,
                yField: "totalPaidAdjusted",
                yTitle: `Total Paid (${inflationDate.getFullYear()}$)`,
            });
            renderPromises.push(
                renderSvg(totalPaidAdjSpec, "./output/adjusted_total_paid.svg")
            );

            // WAIT FOR ALL

            return Promise.all(renderPromises);
        })
        .then(() => {
            console.log("All graphs rendered.");
        });
}
