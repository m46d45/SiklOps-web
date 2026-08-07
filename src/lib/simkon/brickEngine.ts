/**
 * Triple-cycle DES: Bricklaying
 *
 * Cycle A (Helper · fetch): pile → load bata → temp stock (ground buffer, limited)
 * Cycle B (Helper · lift):  temp stock → climb/carry → scaffold stock (limited space)
 * Cycle C (Tukang · lay):   scaffold stock → pasang bata → output m²
 *
 * Satu pool helper mengerjakan A dan B (prioritas jaga scaffold terisi).
 * Coupling: temp_buffer + scaffold_buffer (m² ekuivalen).
 */

import { Rng } from "./rng";
import {
  fromMeanCv,
  type SimulationConfig,
  type SimulationResult,
  type CycleLog,
  type ActivityLog,
  type DurationDist,
  sampleDuration,
  resolveDist
} from "./engine";

export function isBrickOperation(op: string | undefined): boolean {
  return op === "bricklaying";
}

export type BrickConfigFields = {
  num_helpers: number;
  num_masons: number;
  /** muatan helper per trip fetch (m² ekuivalen) */
  fetch_payload_m2: number;
  /** muatan helper per trip ke scaffold */
  lift_payload_m2: number;
  /** output tukang per siklus pasang */
  lay_payload_m2: number;
  temp_buffer_m2: number;
  scaffold_buffer_m2: number;
  // Cycle A — helper fetch (menit)
  fetch_travel_mean: number;
  fetch_load_mean: number;
  fetch_unload_mean: number;
  fetch_return_mean: number;
  // Cycle B — helper lift
  lift_take_mean: number;
  lift_climb_mean: number;
  lift_unload_mean: number;
  lift_return_mean: number;
  // Cycle C — mason lay
  lay_take_mean: number;
  lay_place_mean: number;
  lay_finish_mean: number;
  // optional dists
  fetch_travel_dist?: DurationDist | null;
  fetch_load_dist?: DurationDist | null;
  fetch_unload_dist?: DurationDist | null;
  fetch_return_dist?: DurationDist | null;
  lift_take_dist?: DurationDist | null;
  lift_climb_dist?: DurationDist | null;
  lift_unload_dist?: DurationDist | null;
  lift_return_dist?: DurationDist | null;
  lay_take_dist?: DurationDist | null;
  lay_place_dist?: DurationDist | null;
  lay_finish_dist?: DurationDist | null;
};

export function brickDefaults(): BrickConfigFields {
  return {
    num_helpers: 3,
    num_masons: 2,
    fetch_payload_m2: 0.5,
    lift_payload_m2: 0.35,
    lay_payload_m2: 0.25,
    temp_buffer_m2: 2.5,
    scaffold_buffer_m2: 0.9,
    // A fetch ~ 6.5 mnt
    fetch_travel_mean: 1.5,
    fetch_load_mean: 1.2,
    fetch_unload_mean: 0.8,
    fetch_return_mean: 1.2,
    // B lift ~ 7 mnt (naik scaffolding lebih lama)
    lift_take_mean: 0.8,
    lift_climb_mean: 2.5,
    lift_unload_mean: 0.8,
    lift_return_mean: 2.0,
    // C lay ~ 4 mnt
    lay_take_mean: 0.4,
    lay_place_mean: 2.8,
    lay_finish_mean: 0.5,
  };
}

export function readBrickFields(cfg: SimulationConfig): BrickConfigFields {
  const d = brickDefaults();
  const c = cfg as SimulationConfig & Partial<BrickConfigFields>;
  return {
    num_helpers: Math.max(1, Math.floor(c.num_helpers ?? cfg.num_haulers ?? d.num_helpers)),
    num_masons: Math.max(1, Math.floor(c.num_masons ?? cfg.num_loaders ?? d.num_masons)),
    fetch_payload_m2: Math.max(0.05, c.fetch_payload_m2 ?? d.fetch_payload_m2),
    lift_payload_m2: Math.max(0.05, c.lift_payload_m2 ?? d.lift_payload_m2),
    lay_payload_m2: Math.max(0.05, c.lay_payload_m2 ?? cfg.payload_per_trip ?? d.lay_payload_m2),
    temp_buffer_m2: Math.max(0.2, c.temp_buffer_m2 ?? d.temp_buffer_m2),
    scaffold_buffer_m2: Math.max(0.15, c.scaffold_buffer_m2 ?? d.scaffold_buffer_m2),
    fetch_travel_mean: Math.max(0.1, c.fetch_travel_mean ?? d.fetch_travel_mean),
    fetch_load_mean: Math.max(0.1, c.fetch_load_mean ?? d.fetch_load_mean),
    fetch_unload_mean: Math.max(0.1, c.fetch_unload_mean ?? d.fetch_unload_mean),
    fetch_return_mean: Math.max(0.1, c.fetch_return_mean ?? d.fetch_return_mean),
    lift_take_mean: Math.max(0.1, c.lift_take_mean ?? d.lift_take_mean),
    lift_climb_mean: Math.max(0.1, c.lift_climb_mean ?? d.lift_climb_mean),
    lift_unload_mean: Math.max(0.1, c.lift_unload_mean ?? d.lift_unload_mean),
    lift_return_mean: Math.max(0.1, c.lift_return_mean ?? d.lift_return_mean),
    lay_take_mean: Math.max(0.1, c.lay_take_mean ?? d.lay_take_mean),
    lay_place_mean: Math.max(0.1, c.lay_place_mean ?? cfg.load_time_mean ?? d.lay_place_mean),
    lay_finish_mean: Math.max(0.1, c.lay_finish_mean ?? d.lay_finish_mean),
    fetch_travel_dist: c.fetch_travel_dist ?? null,
    fetch_load_dist: c.fetch_load_dist ?? null,
    fetch_unload_dist: c.fetch_unload_dist ?? null,
    fetch_return_dist: c.fetch_return_dist ?? null,
    lift_take_dist: c.lift_take_dist ?? null,
    lift_climb_dist: c.lift_climb_dist ?? null,
    lift_unload_dist: c.lift_unload_dist ?? null,
    lift_return_dist: c.lift_return_dist ?? null,
    lay_take_dist: c.lay_take_dist ?? null,
    lay_place_dist: c.lay_place_dist ?? null,
    lay_finish_dist: c.lay_finish_dist ?? null,
  };
}

/** Map brick triple-cycle → shared loader/hauler fields for costs & ResultsPanel */
export function applyBrickToConfig(
  base: SimulationConfig,
  fields?: Partial<BrickConfigFields>,
): SimulationConfig {
  const f = { ...readBrickFields(base), ...fields };
  return {
    ...base,
    operation: "bricklaying",
    num_loaders: f.num_masons,
    num_haulers: f.num_helpers,
    num_masons: f.num_masons,
    num_helpers: f.num_helpers,
    loader_bucket_m3: f.lay_payload_m2,
    hauler_capacity_m3: f.lift_payload_m2,
    payload_per_trip: f.lay_payload_m2,
    load_time_mean: f.lay_place_mean,
    haul_time_mean: f.lift_climb_mean,
    dump_time_mean: f.lay_finish_mean,
    return_time_mean: f.lay_take_mean,
    load_dist: fromMeanCv(f.lay_place_mean, base.cv ?? 0.2, base.default_dist_kind ?? "normal"),
    haul_dist: fromMeanCv(f.lift_climb_mean, base.cv ?? 0.2, base.default_dist_kind ?? "normal"),
    dump_dist: fromMeanCv(f.lay_finish_mean, base.cv ?? 0.2, base.default_dist_kind ?? "normal"),
    return_dist: fromMeanCv(f.lay_take_mean, base.cv ?? 0.2, base.default_dist_kind ?? "normal"),
    // brick fields
    fetch_payload_m2: f.fetch_payload_m2,
    lift_payload_m2: f.lift_payload_m2,
    lay_payload_m2: f.lay_payload_m2,
    temp_buffer_m2: f.temp_buffer_m2,
    scaffold_buffer_m2: f.scaffold_buffer_m2,
    fetch_travel_mean: f.fetch_travel_mean,
    fetch_load_mean: f.fetch_load_mean,
    fetch_unload_mean: f.fetch_unload_mean,
    fetch_return_mean: f.fetch_return_mean,
    lift_take_mean: f.lift_take_mean,
    lift_climb_mean: f.lift_climb_mean,
    lift_unload_mean: f.lift_unload_mean,
    lift_return_mean: f.lift_return_mean,
    lay_take_mean: f.lay_take_mean,
    lay_place_mean: f.lay_place_mean,
    lay_finish_mean: f.lay_finish_mean,
    // keep costs from base (tukang=loader, helper=hauler)
    cost_loader_per_hour: base.cost_loader_per_hour || 75_000,
    cost_hauler_per_hour: base.cost_hauler_per_hour || 50_000,
    fuel_loader_work_lph: 0,
    fuel_loader_idle_lph: 0,
    fuel_hauler_work_lph: 0,
    fuel_hauler_idle_lph: 0,
    emission_loader_work_kg_per_h: 0,
    emission_loader_idle_kg_per_h: 0,
    emission_hauler_work_kg_per_h: 0,
    emission_hauler_idle_kg_per_h: 0,
  } as SimulationConfig;
}

type EvKind =
  | "helper_free"
  | "fetch_travel_done"
  | "fetch_load_done"
  | "fetch_unload_done"
  | "fetch_return_done"
  | "lift_take_done"
  | "lift_climb_done"
  | "lift_unload_done"
  | "lift_return_done"
  | "mason_free"
  | "lay_take_done"
  | "lay_place_done"
  | "lay_finish_done";

type Ev = { t: number; kind: EvKind; id: number; seq: number; vol?: number };

function samplePhase(
  rng: Rng,
  config: SimulationConfig,
  mean: number,
  dist?: DurationDist | null,
): number {
  const resolved = resolveDist(config, dist ?? null, mean);
  return sampleDuration(resolved, rng);
}

export function runBrickTripleSimulation(configIn: SimulationConfig): SimulationResult {
  const f = readBrickFields(configIn);
  const config = applyBrickToConfig(configIn, f);
  const rng = new Rng(config.seed);

  let maxHorizon = config.simulation_duration > 0 ? config.simulation_duration : 7 * 24 * 60;
  let targetCycles = Math.max(0, Math.floor(config.target_cycles || 0));
  let targetVolume = Math.max(0, Number(config.target_volume) || 0);
  if (targetCycles <= 0 && targetVolume <= 0) {
    targetCycles = 40;
    targetVolume = 20;
  }

  const nH = f.num_helpers;
  const nM = f.num_masons;
  const tempMax = Math.max(f.fetch_payload_m2, f.temp_buffer_m2);
  const scafMax = Math.max(f.lift_payload_m2, f.scaffold_buffer_m2);

  const events: Ev[] = [];
  let seq = 0;
  const push = (e: Omit<Ev, "seq">) => {
    seq += 1;
    events.push({ ...e, seq });
    events.sort((a, b) => a.t - b.t || a.seq - b.seq);
  };

  let temp = 0;
  let scaffold = 0;

  const helperBusy: boolean[] = Array(nH).fill(false);
  const masonBusy: boolean[] = Array(nM).fill(false);
  // helper carrying volume mid-cycle
  const helperVol: number[] = Array(nH).fill(0);
  const helperJob: ("fetch" | "lift" | null)[] = Array(nH).fill(null);

  const helperBusyInt: [number, number][][] = Array.from({ length: nH }, () => []);
  const masonBusyInt: [number, number][][] = Array.from({ length: nM }, () => []);
  const helperWaitInt: [number, number][][] = Array.from({ length: nH }, () => []);
  const masonWaitInt: [number, number][][] = Array.from({ length: nM }, () => []);

  const waitSamples: number[] = [];
  const arrivalTimes: number[] = [];
  const serviceTimes: number[] = [];
  let totalTrips = 0;
  let totalVolume = 0;
  let stopReason = "duration";
  let endTime = maxHorizon;
  let reached = false;

  const timelineVolume: [number, number][] = [[0, 0]];
  const queueOverTime: [number, number][] = [[0, 0]];
  const activityLog: ActivityLog[] = [];
  const cycleLog: CycleLog[] = [];

  // queue proxy: masons waiting for scaffold material
  let masonsWaiting = 0;
  let lastQ = 0;
  let qIntegral = 0;
  let maxQueue = 0;
  let lastChange = 0;
  const masonWaitStart: number[] = Array(nM).fill(-1);

  const integrateQ = (t: number) => {
    t = Math.min(t, maxHorizon);
    if (t > lastChange) {
      qIntegral += masonsWaiting * (t - lastChange);
      lastChange = t;
    }
  };
  const snapQ = (t: number) => {
    maxQueue = Math.max(maxQueue, masonsWaiting);
    const last = queueOverTime[queueOverTime.length - 1];
    if (!last || last[1] !== masonsWaiting) {
      queueOverTime.push([Math.min(t, maxHorizon), masonsWaiting]);
    }
  };

  const recAct = (hid: number, phase: string, start: number, dur: number) => {
    const s = Math.max(0, start);
    const e = Math.min(maxHorizon, start + dur);
    if (e > s) activityLog.push({ hauler_id: hid, phase, start: s, end: e, duration: e - s });
  };

  const markBusy = (intervals: [number, number][][], id: number, start: number, dur: number) => {
    const s = Math.max(0, start);
    const e = Math.min(maxHorizon, start + dur);
    if (e > s) intervals[id].push([s, e]);
  };

  const tryStartHelpers = (now: number) => {
    if (reached) return;
    // Priority: keep scaffold fed (B), else fetch to temp (A)
    for (let id = 0; id < nH; id++) {
      if (helperBusy[id]) continue;

      const canLift =
        temp + 1e-9 >= f.lift_payload_m2 &&
        scaffold + f.lift_payload_m2 <= scafMax + 1e-9;
      const canFetch = temp + f.fetch_payload_m2 <= tempMax + 1e-9;

      // Prefer lift if scaffold below half OR temp almost full
      const scaffoldLow = scaffold < scafMax * 0.45;
      const tempHigh = temp > tempMax * 0.7;
      let job: "lift" | "fetch" | null = null;
      if (canLift && (scaffoldLow || tempHigh || !canFetch)) job = "lift";
      else if (canFetch) job = "fetch";
      else if (canLift) job = "lift";
      if (!job) continue;

      helperBusy[id] = true;
      helperJob[id] = job;
      if (job === "fetch") {
        helperVol[id] = f.fetch_payload_m2;
        const d = samplePhase(rng, config, f.fetch_travel_mean, f.fetch_travel_dist);
        markBusy(helperBusyInt, id, now, d);
        recAct(id, "fetch_travel", now, d);
        push({ t: now + d, kind: "fetch_travel_done", id });
      } else {
        // reserve from temp immediately
        temp = Math.max(0, temp - f.lift_payload_m2);
        helperVol[id] = f.lift_payload_m2;
        const d = samplePhase(rng, config, f.lift_take_mean, f.lift_take_dist);
        markBusy(helperBusyInt, id, now, d);
        recAct(id, "lift_take", now, d);
        push({ t: now + d, kind: "lift_take_done", id });
      }
    }
  };

  const tryStartMasons = (now: number) => {
    if (reached) return;
    for (let id = 0; id < nM; id++) {
      if (masonBusy[id]) continue;
      if (scaffold + 1e-9 < f.lay_payload_m2) {
        // waiting for material
        if (masonWaitStart[id] < 0) {
          masonWaitStart[id] = now;
          masonsWaiting += 1;
          integrateQ(now);
          snapQ(now);
          helperWaitInt; // silence
          markBusy(masonWaitInt, id, now, 0); // open wait marker handled below
        }
        continue;
      }
      // start lay — consume scaffold
      if (masonWaitStart[id] >= 0) {
        const w = Math.max(0, now - masonWaitStart[id]);
        waitSamples.push(w);
        if (w > 1e-9) markBusy(masonWaitInt, id, masonWaitStart[id], w);
        masonWaitStart[id] = -1;
        masonsWaiting = Math.max(0, masonsWaiting - 1);
        integrateQ(now);
        snapQ(now);
      }
      scaffold = Math.max(0, scaffold - f.lay_payload_m2);
      masonBusy[id] = true;
      arrivalTimes.push(now);
      const d = samplePhase(rng, config, f.lay_take_mean, f.lay_take_dist);
      markBusy(masonBusyInt, id, now, d);
      recAct(1000 + id, "lay_take", now, d);
      push({ t: now + d, kind: "lay_take_done", id, vol: f.lay_payload_m2 });
    }
  };

  // bootstrap: all free at t=0
  for (let id = 0; id < nH; id++) push({ t: 0, kind: "helper_free", id });
  for (let id = 0; id < nM; id++) push({ t: 0, kind: "mason_free", id });

  let safety = 0;
  while (events.length > 0 && safety < 2_000_000) {
    safety += 1;
    const ev = events.shift()!;
    const now = ev.t;
    if (now > maxHorizon + 1e-9) break;

    switch (ev.kind) {
      case "helper_free":
        helperBusy[ev.id] = false;
        helperJob[ev.id] = null;
        tryStartHelpers(now);
        tryStartMasons(now);
        break;

      case "fetch_travel_done": {
        const d = samplePhase(rng, config, f.fetch_load_mean, f.fetch_load_dist);
        markBusy(helperBusyInt, ev.id, now, d);
        recAct(ev.id, "fetch_load", now, d);
        push({ t: now + d, kind: "fetch_load_done", id: ev.id });
        break;
      }
      case "fetch_load_done": {
        // travel back to temp
        const d = samplePhase(rng, config, f.fetch_travel_mean * 0.85, f.fetch_travel_dist);
        markBusy(helperBusyInt, ev.id, now, d);
        recAct(ev.id, "fetch_haul_temp", now, d);
        push({ t: now + d, kind: "fetch_unload_done", id: ev.id });
        break;
      }
      case "fetch_unload_done": {
        // may wait if temp full (shouldn't reserve yet)
        const vol = helperVol[ev.id];
        if (temp + vol > tempMax + 1e-9) {
          // brief wait then retry unload
          const wait = 0.25;
          markBusy(helperWaitInt, ev.id, now, wait);
          push({ t: now + wait, kind: "fetch_unload_done", id: ev.id });
          break;
        }
        const d = samplePhase(rng, config, f.fetch_unload_mean, f.fetch_unload_dist);
        markBusy(helperBusyInt, ev.id, now, d);
        recAct(ev.id, "fetch_unload", now, d);
        // complete unload at end of unload — schedule return after adding buffer
        push({ t: now + d, kind: "fetch_return_done", id: ev.id, vol });
        // add to temp when unload finishes (at now+d handled in return_done start)
        // Actually add now after unload duration via return_done carrying vol
        break;
      }
      case "fetch_return_done": {
        if (ev.vol != null && ev.vol > 0 && helperJob[ev.id] === "fetch") {
          // first arrival to this kind after unload: deposit then return travel
          if (helperVol[ev.id] > 0) {
            temp = Math.min(tempMax, temp + helperVol[ev.id]);
            helperVol[ev.id] = 0;
            const d = samplePhase(rng, config, f.fetch_return_mean, f.fetch_return_dist);
            markBusy(helperBusyInt, ev.id, now, d);
            recAct(ev.id, "fetch_return", now, d);
            push({ t: now + d, kind: "helper_free", id: ev.id });
            tryStartHelpers(now);
            tryStartMasons(now);
            break;
          }
        }
        helperBusy[ev.id] = false;
        helperJob[ev.id] = null;
        tryStartHelpers(now);
        tryStartMasons(now);
        break;
      }

      case "lift_take_done": {
        const d = samplePhase(rng, config, f.lift_climb_mean, f.lift_climb_dist);
        markBusy(helperBusyInt, ev.id, now, d);
        recAct(ev.id, "lift_climb", now, d);
        push({ t: now + d, kind: "lift_climb_done", id: ev.id });
        break;
      }
      case "lift_climb_done": {
        const vol = helperVol[ev.id];
        if (scaffold + vol > scafMax + 1e-9) {
          const wait = 0.25;
          markBusy(helperWaitInt, ev.id, now, wait);
          push({ t: now + wait, kind: "lift_climb_done", id: ev.id });
          break;
        }
        const d = samplePhase(rng, config, f.lift_unload_mean, f.lift_unload_dist);
        markBusy(helperBusyInt, ev.id, now, d);
        recAct(ev.id, "lift_unload", now, d);
        push({ t: now + d, kind: "lift_unload_done", id: ev.id, vol });
        break;
      }
      case "lift_unload_done": {
        if (ev.vol != null) {
          scaffold = Math.min(scafMax, scaffold + ev.vol);
          helperVol[ev.id] = 0;
        }
        const d = samplePhase(rng, config, f.lift_return_mean, f.lift_return_dist);
        markBusy(helperBusyInt, ev.id, now, d);
        recAct(ev.id, "lift_return", now, d);
        push({ t: now + d, kind: "lift_return_done", id: ev.id });
        tryStartMasons(now);
        break;
      }
      case "lift_return_done": {
        helperBusy[ev.id] = false;
        helperJob[ev.id] = null;
        tryStartHelpers(now);
        tryStartMasons(now);
        break;
      }

      case "mason_free":
        masonBusy[ev.id] = false;
        tryStartMasons(now);
        tryStartHelpers(now);
        break;

      case "lay_take_done": {
        const d = samplePhase(rng, config, f.lay_place_mean, f.lay_place_dist);
        markBusy(masonBusyInt, ev.id, now, d);
        recAct(1000 + ev.id, "lay_place", now, d);
        serviceTimes.push(d);
        push({ t: now + d, kind: "lay_place_done", id: ev.id, vol: f.lay_payload_m2 });
        break;
      }
      case "lay_place_done": {
        const d = samplePhase(rng, config, f.lay_finish_mean, f.lay_finish_dist);
        markBusy(masonBusyInt, ev.id, now, d);
        recAct(1000 + ev.id, "lay_finish", now, d);
        push({ t: now + d, kind: "lay_finish_done", id: ev.id, vol: ev.vol });
        break;
      }
      case "lay_finish_done": {
        const vol = ev.vol ?? f.lay_payload_m2;
        totalTrips += 1;
        totalVolume += vol;
        timelineVolume.push([now, totalVolume]);
        const placeDur = f.lay_place_mean;
        cycleLog.push({
          hauler_id: 1000 + ev.id,
          trip: totalTrips,
          wait: 0,
          load: f.lay_take_mean,
          haul: placeDur,
          dump: f.lay_finish_mean,
          return: 0,
          cycle_time: f.lay_take_mean + placeDur + f.lay_finish_mean,
          productive_time: f.lay_take_mean + placeDur + f.lay_finish_mean,
          finish_time: now,
          return_finish: now,
          volume: vol,
          productivity: vol > 0 ? vol / Math.max(1e-9, (f.lay_take_mean + placeDur + f.lay_finish_mean) / 60) : 0,
        });

        if (!reached) {
          const hitC = targetCycles > 0 && totalTrips >= targetCycles;
          const hitV = targetVolume > 0 && totalVolume >= targetVolume - 1e-9;
          if (hitC && hitV) {
            reached = true;
            stopReason = "target_both";
            endTime = now;
          } else if (hitC && targetVolume <= 0) {
            reached = true;
            stopReason = "target_cycles";
            endTime = now;
          } else if (hitV && targetCycles <= 0) {
            reached = true;
            stopReason = "target_volume";
            endTime = now;
          } else if (hitC || hitV) {
            // either mode default
            if ((config.stop_mode ?? "either") === "either") {
              reached = true;
              stopReason = hitC ? "target_cycles" : "target_volume";
              endTime = now;
            }
          }
        }

        masonBusy[ev.id] = false;
        if (!reached) {
          tryStartMasons(now);
          tryStartHelpers(now);
        }
        break;
      }
    }

    if (reached) break;
  }

  if (!reached) {
    endTime = maxHorizon;
    stopReason = targetCycles > 0 || targetVolume > 0 ? "duration_cap" : "duration";
  }
  integrateQ(endTime);
  snapQ(endTime);

  const horizon = Math.max(endTime, 1e-9);
  const sumBusy = (ints: [number, number][][]) =>
    ints.reduce(
      (s, rows) => s + rows.reduce((a, [x, y]) => a + Math.max(0, Math.min(y, horizon) - Math.max(x, 0)), 0),
      0,
    );
  const masonBusyMin = sumBusy(masonBusyInt);
  const helperBusyMin = sumBusy(helperBusyInt);
  const masonWaitMin = sumBusy(masonWaitInt);
  const helperWaitMin = sumBusy(helperWaitInt);

  const loaderUtil = Math.min(1, masonBusyMin / (nM * horizon));
  const haulerUtil = Math.min(1, helperBusyMin / (nH * horizon));
  const avgWait = waitSamples.length ? waitSamples.reduce((a, b) => a + b, 0) / waitSamples.length : 0;
  const avgQ = qIntegral / horizon;
  const throughput = (totalVolume / horizon) * 60;

  // avg cycle components from mason lay
  const avg_cycle_components: Record<string, number> = {
    wait: avgWait,
    load: f.lay_take_mean,
    haul: f.lay_place_mean,
    dump: f.lay_finish_mean,
    return: 0,
  };

  let bottleneck = "Seimbang";
  let bottleneck_reason = "Util tukang dan helper seimbang relatif terhadap buffer.";
  if (loaderUtil > 0.85 && avgWait < 0.5) {
    bottleneck = "Tukang";
    bottleneck_reason = "Tukang hampir jenuh — tambah tukang atau percepat siklus pasang.";
  } else if (haulerUtil > 0.85 && loaderUtil < 0.7) {
    bottleneck = "Helper";
    bottleneck_reason = "Helper sibuk supply — tambah helper atau perbesar buffer scaffold/temp.";
  } else if (avgWait > 1.5 || avgQ > 0.5) {
    bottleneck = "Scaffold stock";
    bottleneck_reason = "Tukang sering menunggu material di scaffold — perbanyak trip lift (helper) atau kapasitas scaffold.";
  } else if (loaderUtil < 0.5 && haulerUtil < 0.5) {
    bottleneck = "Under-utilized";
    bottleneck_reason = "Armada longgar terhadap target — kurangi resource atau naikkan target volume.";
  }

  return {
    operation: "bricklaying",
    config: {
      ...config,
      num_loaders: nM,
      num_haulers: nH,
    },
    total_trips: totalTrips,
    total_volume: totalVolume,
    throughput_per_hour: throughput,
    simulated_minutes: horizon,
    stop_reason: stopReason,
    target_cycles: targetCycles,
    target_volume: targetVolume,
    loader_utilization: loaderUtil,
    hauler_utilization: haulerUtil,
    loader_busy_minutes: masonBusyMin,
    hauler_busy_minutes: helperBusyMin,
    avg_queue_wait: avgWait,
    avg_queue_length: avgQ,
    max_queue_length: maxQueue,
    total_wait_time: masonWaitMin + helperWaitMin,
    hauler_wait_ratio: helperBusyMin > 0 ? helperWaitMin / (helperBusyMin + helperWaitMin) : 0,
    completed_load_requests: totalTrips,
    censored_waits: 0,
    bottleneck,
    bottleneck_reason,
    timeline_volume: timelineVolume,
    queue_over_time: queueOverTime,
    activity_log: activityLog,
    cycle_log: cycleLog,
    avg_cycle_components,
    hauler_trips: Array(nH).fill(0),
    hauler_busy_per_unit: helperBusyInt.map((rows) =>
      rows.reduce((a, [x, y]) => a + Math.max(0, Math.min(y, horizon) - Math.max(x, 0)), 0),
    ),
    hauler_wait_per_unit: helperWaitInt.map((rows) =>
      rows.reduce((a, [x, y]) => a + Math.max(0, Math.min(y, horizon) - Math.max(x, 0)), 0),
    ),
    arrival_times: arrivalTimes,
    service_times: serviceTimes,
    wait_samples: waitSamples,
  };
}

/** Teoritis rough: min(helper supply chain, mason) */
export function brickTheoreticalThroughput(cfg: SimulationConfig): {
  fetch: number;
  lift: number;
  lay: number;
  system: number;
} {
  const f = readBrickFields(cfg);
  const fetchCycle =
    f.fetch_travel_mean + f.fetch_load_mean + f.fetch_unload_mean + f.fetch_return_mean + f.fetch_travel_mean * 0.85;
  const liftCycle =
    f.lift_take_mean + f.lift_climb_mean + f.lift_unload_mean + f.lift_return_mean;
  const layCycle = f.lay_take_mean + f.lay_place_mean + f.lay_finish_mean;
  // helpers split time between A and B — approx half each if both needed
  const fetch = fetchCycle > 0 ? (60 / fetchCycle) * f.num_helpers * 0.5 * f.fetch_payload_m2 : 0;
  const lift = liftCycle > 0 ? (60 / liftCycle) * f.num_helpers * 0.5 * f.lift_payload_m2 : 0;
  const lay = layCycle > 0 ? (60 / layCycle) * f.num_masons * f.lay_payload_m2 : 0;
  const helperChain = Math.min(fetch, lift);
  return { fetch, lift, lay, system: Math.min(helperChain, lay) };
}
