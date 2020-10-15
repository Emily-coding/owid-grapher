#! /usr/bin/env yarn jest

import {
    SampleColumnSlugs,
    SynthesizeGDPTable,
} from "coreTable/OwidTableSynthesizers"
import { Grapher } from "grapher/core/Grapher"
import { legacyMapGrapher } from "./MapChart.sample"
import { MapChartManager } from "./MapChartConstants"
import { MapChart } from "./MapChart"

const table = SynthesizeGDPTable({
    timeRange: [2000, 2010],
    entityNames: ["France", "Germany"],
})
const manager: MapChartManager = {
    table,
    mapColumnSlug: SampleColumnSlugs.Population,
}

test("can create a new Map chart", () => {
    const chart = new MapChart({ manager })
    expect(Object.keys(chart.series).length).toEqual(2)

    const legends = chart.colorScale.legendBins
    expect(Object.keys(legends).length).toBeGreaterThan(1)
})

it("times work with a map chart", () => {
    const grapher = new Grapher(legacyMapGrapher)
    expect(grapher.mapColumnSlug).toBe("3512")
    expect(grapher.inputTable.minTime).toBe(2000)
    expect(grapher.inputTable.maxTime).toBe(2010)
    expect(grapher.startTime).toBe(2000)
    expect(grapher.endTime).toBe(2000)
    expect(grapher.times).toEqual([2000, 2010])
})

it("can change time and see more points", () => {
    const manager = new Grapher(legacyMapGrapher)
    const chart = new MapChart({ manager })

    expect(Object.keys(chart.series).length).toEqual(1)
    manager.timelineFilterEnd = 2010
    expect(Object.keys(chart.series).length).toEqual(2)
})
