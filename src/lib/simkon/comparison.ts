/**
 * Sweep fleet size untuk tab Perbandingan.
 * Excavator 1–3 × Dump truck 1–40, parameter lain dari config dasar.
 */

import {
  cycleTimeMean,
  expectedMean,
  fromMeanCv,
  resolveDist,
  runSimulation,
  type SimulationConfig,
  type SimulationResult,
} from "./engine";
import { computeCosts } from "./costs";
import { computeEmissions } from "./emissions";

export const COMPARE_LOADERS = [1, 2, 3] as const;
export const COMPARE_HAULERS_MAX = 40;

export type ComparisonCell = {
  num_loaders: number;
  num_haulers: number;
  throughput: number;
  /** Teoritis: min(kap. loading, kap. hauling) tanpa antrian/variasi */
  throughput_theory: number;
  loader_cap_theory: number;
  hauler_cap_theory: number;
  loader_util: number;
  hauler_util: number;
  avg_queue_wait: number;
  avg_queue_length: number;
  simulated_minutes: number;
  total_trips: number;
  total_volume: number;
  bottleneck: string;
  unit_cost: number;
  wait_cost: number;
  wait_unit_cost: number;
  cost_total: number;
  unit_emission: number;
  emission_wait: number;
  wait_unit_emission: number;
  emission_total: number;
};

export type ComparisonGrid = {
  cells: ComparisonCell[];
  /** baris chart: X = n_haulers, series per n_loaders */
  byHauler: Array<{
    haulers: number;
    [key: string]: number;
  }>;
  loaders: readonly number[];
  /** Kapasitas loading teoritis per n excavator (m³/jam), konstan vs n truck */
  loaderCeilings: Record<number, number>;
  cycleMeanMin: number;
};

/**
 * Kapasitas teoritis (tanpa antrian & tanpa variasi):
 * - Loading: n_L × (60 / t_load) × payload
 * - Hauling: n_H × (60 / t_cycle) × payload, t_cycle = load+haul+dump+return
 * - Sistem: min(loading, hauling)
 */
export function theoreticalThroughput(
  base: SimulationConfig,
  numLoaders: number,
  numHaulers: number,
): { system: number; loader: number; hauler: number; cycleMin: number } {
  const payload = Math.max(0.01, base.hauler_capacity_m3 ?? base.payload_per_trip ?? 1);
  const loadMean = expectedMean(
    resolveDist(base, base.load_dist, base.load_time_mean),
  );
  const cycleMin = cycleTimeMean({
    ...base,
    num_loaders: numLoaders,
    num_haulers: numHaulers,
  });
  const loader =
    loadMean > 0 ? (60 / loadMean) * Math.max(1, numLoaders) * payload : 0;
  const hauler =
    cycleMin > 0 ? (60 / cycleMin) * Math.max(1, numHaulers) * payload : 0;
  return {
    system: Math.min(loader, hauler),
    loader,
    hauler,
    cycleMin,
  };
}

function cellFromResult(
  nL: number,
  nH: number,
  r: SimulationResult,
  theory: ReturnType<typeof theoreticalThroughput>,
): ComparisonCell {
  const costs = computeCosts(r);
  const em = computeEmissions(r);
  return {
    num_loaders: nL,
    num_haulers: nH,
    throughput: r.throughput_per_hour,
    throughput_theory: theory.system,
    loader_cap_theory: theory.loader,
    hauler_cap_theory: theory.hauler,
    loader_util: r.loader_utilization * 100,
    hauler_util: r.hauler_utilization * 100,
    avg_queue_wait: r.avg_queue_wait,
    avg_queue_length: r.avg_queue_length,
    simulated_minutes: r.simulated_minutes,
    total_trips: r.total_trips,
    total_volume: r.total_volume,
    bottleneck: r.bottleneck,
    unit_cost: costs.unit_cost,
    wait_cost: costs.cost_wait,
    wait_unit_cost: costs.wait_unit_cost,
    cost_total: costs.cost_total,
    unit_emission: em.unit_emission,
    emission_wait: em.emission_wait,
    wait_unit_emission: em.wait_unit_emission,
    emission_total: em.emission_total,
  };
}

/**
 * Jalankan grid perbandingan. Seed digeser per sel agar tetap deterministic.
 */
export function runComparisonGrid(base: SimulationConfig): ComparisonGrid {
  const loaders = COMPARE_LOADERS;
  const cells: ComparisonCell[] = [];
  const loaderCeilings: Record<number, number> = {};

  for (const nL of loaders) {
    const t0 = theoreticalThroughput(base, nL, 1);
    loaderCeilings[nL] = Math.round(t0.loader * 10) / 10;

    for (let nH = 1; nH <= COMPARE_HAULERS_MAX; nH++) {
      const seedBase = base.seed ?? 12345;
      const cv = base.cv ?? 0.2;
      const kind = base.default_dist_kind ?? "normal";
      const cfg: SimulationConfig = {
        ...base,
        num_loaders: nL,
        num_haulers: nH,
        cv,
        seed: seedBase + nL * 100 + nH,
        load_dist: fromMeanCv(base.load_time_mean, cv, kind),
        haul_dist: fromMeanCv(base.haul_time_mean, cv, kind),
        dump_dist: fromMeanCv(base.dump_time_mean, cv, kind),
        return_dist: fromMeanCv(base.return_time_mean, cv, kind),
      };
      const theory = theoreticalThroughput(base, nL, nH);
      const r = runSimulation(cfg);
      cells.push(cellFromResult(nL, nH, r, theory));
    }
  }

  const cycleMeanMin = cycleTimeMean(base);

  const byHauler: ComparisonGrid["byHauler"] = [];
  for (let nH = 1; nH <= COMPARE_HAULERS_MAX; nH++) {
    const row: ComparisonGrid["byHauler"][number] = { haulers: nH };
    for (const nL of loaders) {
      const c = cells.find((x) => x.num_loaders === nL && x.num_haulers === nH)!;
      row[`thr_${nL}`] = Math.round(c.throughput * 10) / 10;
      row[`thrT_${nL}`] = Math.round(c.throughput_theory * 10) / 10;
      row[`capL_${nL}`] = Math.round(c.loader_cap_theory * 10) / 10;
      row[`utilL_${nL}`] = Math.round(c.loader_util * 10) / 10;
      row[`utilH_${nL}`] = Math.round(c.hauler_util * 10) / 10;
      row[`wait_${nL}`] = Math.round(c.avg_queue_wait * 100) / 100;
      row[`qlen_${nL}`] = Math.round(c.avg_queue_length * 100) / 100;
      row[`ucost_${nL}`] = Math.round(c.unit_cost);
      row[`wcost_${nL}`] = Math.round(c.wait_cost);
      row[`wucost_${nL}`] = Math.round(c.wait_unit_cost);
      row[`uemi_${nL}`] = Math.round(c.unit_emission * 1000) / 1000;
      row[`wemi_${nL}`] = Math.round(c.emission_wait * 10) / 10;
      row[`wuemi_${nL}`] = Math.round(c.wait_unit_emission * 1000) / 1000;
    }
    byHauler.push(row);
  }

  return { cells, byHauler, loaders, loaderCeilings, cycleMeanMin };
}

/** Hint puncak throughput, min biaya satuan, min emisi satuan per n excavator. */
export function bestFleetHints(grid: ComparisonGrid): string[] {
  const tips: string[] = [];
  for (const nL of grid.loaders) {
    const subset = grid.cells.filter((c) => c.num_loaders === nL);
    if (!subset.length) continue;
    let bestThr = subset[0];
    let bestCost = subset[0];
    let bestEmi = subset[0];
    for (const c of subset) {
      if (c.throughput > bestThr.throughput) bestThr = c;
      if (c.unit_cost > 0 && (bestCost.unit_cost <= 0 || c.unit_cost < bestCost.unit_cost))
        bestCost = c;
      if (
        c.unit_emission > 0 &&
        (bestEmi.unit_emission <= 0 || c.unit_emission < bestEmi.unit_emission)
      )
        bestEmi = c;
    }
    const gap =
      bestThr.throughput_theory > 0
        ? (1 - bestThr.throughput / bestThr.throughput_theory) * 100
        : 0;
    tips.push(
      `Excavator ${nL}: throughput puncak ≈ ${bestThr.throughput.toFixed(1)} m³/jam @ ${bestThr.num_haulers} truck` +
        ` (teori ${bestThr.throughput_theory.toFixed(1)}${gap > 1 ? `, gap ~${gap.toFixed(0)}%` : ""}).` +
        ` Min biaya satuan @ ${bestCost.num_haulers} truck` +
        ` (≈ ${Math.round(bestCost.unit_cost).toLocaleString("id-ID")}/m³).` +
        ` Min emisi satuan @ ${bestEmi.num_haulers} truck` +
        ` (≈ ${bestEmi.unit_emission.toFixed(3)} kg CO₂e/m³).`,
    );
  }
  return tips;
}
