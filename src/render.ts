import fs from "fs/promises";
import { compile } from "vega-lite";
import { parse, View } from "vega";
import { GraphPointData } from "./types.js";
import { makeLineChartSpec, type Series } from "./makeLineChartSpec.js";
import type Config from "./../config.json";

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

function quickSeriesUtil(
    data: GraphPointData[],
    yKey: keyof GraphPointData
): Series[] {
    const datasetNames = [...new Set(data.map(d => d.name))];
    return datasetNames.map(name => ({
        name: name,
        data: data
            .filter(d => d.name === name)
            .map(d => ({
                x: d.date,
                y: Number(d[yKey]),
            })),
    }));
}

export function renderGraphs(
    data: GraphPointData[],
    loan: (typeof Config)["loan"],
    targetPrincipal: number,
    inflationDate: Date
): Promise<void> {
    return fs
        .mkdir("./output", { recursive: true })
        .then(() => {
            const renderPromises: Promise<void>[] = [];

            // REMAINING PRINCIPAL

            const principalRemainingSpec = makeLineChartSpec({
                title: "Principal Remaning Over Time",
                series: quickSeriesUtil(data, "remainingPrincipal"),
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
                title: "Total Interest Paid Over Time",
                series: quickSeriesUtil(data, "interestPaid"),
                yTitle: "Total Interest Paid ($)",
                horizRule: 0,
            });
            renderPromises.push(
                renderSvg(interestSpec, "./output/interest_paid.svg")
            );

            const principalPaidSpec = makeLineChartSpec({
                title: "Total Principal Paid Over Time",
                series: quickSeriesUtil(data, "principalPaid"),
                yTitle: "Principal Paid ($)",
                horizRule: loan.principal,
            });
            renderPromises.push(
                renderSvg(principalPaidSpec, "./output/principal_paid.svg")
            );

            const totalPaidSpec = makeLineChartSpec({
                title: "Total Paid Over Time",
                series: quickSeriesUtil(data, "totalPaid"),
                yTitle: "Total Paid ($)",
                horizRule: loan.principal,
            });
            renderPromises.push(
                renderSvg(totalPaidSpec, "./output/total_paid.svg")
            );

            const datasetNames = [...new Set(data.map(d => d.name))];
            for (const datasetName of datasetNames) {
                const setData = data.filter(d => d.name === datasetName);
                const pAndISpec = makeLineChartSpec({
                    title: `Total Paid Over Time ("${datasetName}")`,
                    series: [
                        {
                            name: "Principal",
                            data: setData.map(d => ({
                                x: d.date,
                                y: d.principalPaid,
                            })),
                        },
                        {
                            name: "Interest",
                            data: setData.map(d => ({
                                x: d.date,
                                y: d.interestPaid,
                            })),
                        },
                    ],
                    yTitle: "Total Paid ($)",
                    horizRule: loan.principal,
                    stackedFill: true,
                });
                renderPromises.push(
                    renderSvg(pAndISpec, `./output/pAndI_${datasetName}.svg`)
                );
            }

            // AMOUNT PAID (ADJUSTED)

            const interestAdjSpec = makeLineChartSpec({
                title: `Total Interest Paid Over Time (in ${inflationDate.getFullYear()} dollars)`,
                series: quickSeriesUtil(data, "interestPaidAdjusted"),
                yTitle: `Total Interest Paid (${inflationDate.getFullYear()}$)`,
                horizRule: 0,
            });
            renderPromises.push(
                renderSvg(
                    interestAdjSpec,
                    "./output/adjusted_interest_paid.svg"
                )
            );

            const principalPaidAdjSpec = makeLineChartSpec({
                title: `Total Principal Paid Over Time (in ${inflationDate.getFullYear()} dollars)`,
                series: quickSeriesUtil(data, "principalPaidAdjusted"),
                yTitle: `Principal Paid (${inflationDate.getFullYear()}$)`,
                horizRule: 0,
            });
            renderPromises.push(
                renderSvg(
                    principalPaidAdjSpec,
                    "./output/adjusted_principal_paid.svg"
                )
            );

            const totalPaidAdjSpec = makeLineChartSpec({
                title: `Total Paid Over Time (in ${inflationDate.getFullYear()} dollars)`,
                series: quickSeriesUtil(data, "totalPaidAdjusted"),
                yTitle: `Total Paid (${inflationDate.getFullYear()}$)`,
                horizRule: 0,
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
