/**
 * Bricklaying DES — discrete batches + mortar
 *
 * Helper (pool) jobs:
 *  A FETCH: jika temp stock ≤ threshold → ambil batch bata dari pile JAUIH (durasi fix lebih lama)
 *           isi temp (slot × batch). Temp max = temp_slots × batch_bricks.
 *  B LIFT bricks: bawa 1 batch (batch_bricks) ke scaffold HANYA jika ada slot kosong
 *                 (scaffold max = scaffold_slots × batch). Tidak partial unload.
 *  B' LIFT mortar: ambil ember mortar dari stasiun mortar (tim mortar selalu siap) ke scaffold.
 *                  Scaffold mortar max = mortar_buckets. 1 ember = mortar_covers_bricks bata.
 * Tukang C LAY: pasang bata; butuh 1 bata scaffold + mortar; output m² via bricks_per_m2.
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
  resolveDist,
} from "./engine";

export function isBrickOperation(op: string | undefined): boolean {
  return op === "bricklaying";
}

export type BrickConfigFields = {
  num_helpers: number;
  num_masons: number;
  /** Kapasitas angkat helper per trip (= 1 batch / 1 slot) */
  batch_bricks: number;
  /** Slot tumpukan di scaffold (default 3 → max 60 bila batch=20) */
  scaffold_slots: number;
  /** Slot di temp ground (default 10 → max 200) */
  temp_slots: number;
  /** Jika temp ≤ ini, fetch ke pile jauh (default 60) */
  temp_refill_threshold: number;
  /** Ember mortar di scaffold (default 3) */
  mortar_buckets_max: number;
  /** 1 ember mortar cukup untuk N bata (default 20) */
  mortar_covers_bricks: number;
  /** Bata per m² dinding (konversi hasil) */
  bricks_per_m2: number;
  /** Bata dipasang per siklus tukang */
  lay_bricks_per_cycle: number;
  // waktu (menit)
  /** Fetch jauh: travel ke pile jauh (fix) */
  far_travel_mean: number;
  far_load_mean: number;
  far_return_mean: number;
  far_unload_mean: number;
  /** Lift bata scaffold */
  lift_take_mean: number;
  lift_climb_mean: number;
  lift_unload_mean: number;
  lift_return_mean: number;
  /** Supply mortar ke scaffold */
  mortar_take_mean: number;
  mortar_climb_mean: number;
  mortar_place_mean: number;
  mortar_return_mean: number;
  /** Tukang lay */
  lay_take_mean: number;
  lay_place_mean: number;
  lay_finish_mean: number;
  // dists optional
  far_travel_dist?: DurationDist | null;
  far_load_dist?: DurationDist | null;
  far_return_dist?: DurationDist | null;
  far_unload_dist?: DurationDist | null;
  lift_take_dist?: DurationDist | null;
  lift_climb_dist?: DurationDist | null;
  lift_unload_dist?: DurationDist | null;
  lift_return_dist?: DurationDist | null;
  mortar_take_dist?: DurationDist | null;
  mortar_climb_dist?: DurationDist | null;
  mortar_place_dist?: DurationDist | null;
  mortar_return_dist?: DurationDist | null;
  lay_take_dist?: DurationDist | null;
  lay_place_dist?: DurationDist | null;
  lay_finish_dist?: DurationDist | null;
  // legacy aliases kept for applyBrick mapping
  fetch_payload_m2?: number;
  lift_payload_m2?: number;
  lay_payload_m2?: number;
  temp_buffer_m2?: number;
  scaffold_buffer_m2?: number;
};

export function brickDefaults(): BrickConfigFields {
  return {
    num_helpers: 3,
    num_masons: 2,
    batch_bricks: 20,
    scaffold_slots: 3,
    temp_slots: 10,
    temp_refill_threshold: 60,
    mortar_buckets_max: 3,
    mortar_covers_bricks: 20,
    bricks_per_m2: 50,
    lay_bricks_per_cycle: 1,
    far_travel_mean: 3.0,
    far_load_mean: 1.5,
    far_return_mean: 3.0,
    far_unload_mean: 1.0,
    lift_take_mean: 0.6,
    lift_climb_mean: 2.2,
    lift_unload_mean: 0.8,
    lift_return_mean: 1.8,
    mortar_take_mean: 0.5,
    mortar_climb_mean: 2.0,
    mortar_place_mean: 0.6,
    mortar_return_mean: 1.6,
    lay_take_mean: 0.15,
    lay_place_mean: 0.9,
    lay_finish_mean: 0.15,
  };
}

export function readBrickFields(cfg: SimulationConfig): BrickConfigFields {
  const d = brickDefaults();
  const c = cfg as SimulationConfig & Partial<BrickConfigFields>;
  return {
    num_helpers: Math.max(1, Math.floor(c.num_helpers ?? cfg.num_haulers ?? d.num_helpers)),
    num_masons: Math.max(1, Math.floor(c.num_masons ?? cfg.num_loaders ?? d.num_masons)),
    batch_bricks: Math.max(1, Math.floor(c.batch_bricks ?? d.batch_bricks)),
    scaffold_slots: Math.max(1, Math.floor(c.scaffold_slots ?? d.scaffold_slots)),
    temp_slots: Math.max(1, Math.floor(c.temp_slots ?? d.temp_slots)),
    temp_refill_threshold: Math.max(
      0,
      Math.floor(c.temp_refill_threshold ?? d.temp_refill_threshold),
    ),
    mortar_buckets_max: Math.max(1, Math.floor(c.mortar_buckets_max ?? d.mortar_buckets_max)),
    mortar_covers_bricks: Math.max(
      1,
      Math.floor(c.mortar_covers_bricks ?? d.mortar_covers_bricks),
    ),
    bricks_per_m2: Math.max(10, c.bricks_per_m2 ?? d.bricks_per_m2),
    lay_bricks_per_cycle: Math.max(1, Math.floor(c.lay_bricks_per_cycle ?? d.lay_bricks_per_cycle)),
    far_travel_mean: Math.max(0.1, c.far_travel_mean ?? d.far_travel_mean),
    far_load_mean: Math.max(0.1, c.far_load_mean ?? d.far_load_mean),
    far_return_mean: Math.max(0.1, c.far_return_mean ?? d.far_return_mean),
    far_unload_mean: Math.max(0.1, c.far_unload_mean ?? d.far_unload_mean),
    lift_take_mean: Math.max(0.1, c.lift_take_mean ?? d.lift_take_mean),
    lift_climb_mean: Math.max(0.1, c.lift_climb_mean ?? d.lift_climb_mean),
    lift_unload_mean: Math.max(0.1, c.lift_unload_mean ?? d.lift_unload_mean),
    lift_return_mean: Math.max(0.1, c.lift_return_mean ?? d.lift_return_mean),
    mortar_take_mean: Math.max(0.1, c.mortar_take_mean ?? d.mortar_take_mean),
    mortar_climb_mean: Math.max(0.1, c.mortar_climb_mean ?? d.mortar_climb_mean),
    mortar_place_mean: Math.max(0.1, c.mortar_place_mean ?? d.mortar_place_mean),
    mortar_return_mean: Math.max(0.1, c.mortar_return_mean ?? d.mortar_return_mean),
    lay_take_mean: Math.max(0.05, c.lay_take_mean ?? d.lay_take_mean),
    lay_place_mean: Math.max(0.05, c.lay_place_mean ?? d.lay_place_mean),
    lay_finish_mean: Math.max(0.05, c.lay_finish_mean ?? d.lay_finish_mean),
    far_travel_dist: c.far_travel_dist ?? null,
    far_load_dist: c.far_load_dist ?? null,
    far_return_dist: c.far_return_dist ?? null,
    far_unload_dist: c.far_unload_dist ?? null,
    lift_take_dist: c.lift_take_dist ?? null,
    lift_climb_dist: c.lift_climb_dist ?? null,
    lift_unload_dist: c.lift_unload_dist ?? null,
    lift_return_dist: c.lift_return_dist ?? null,
    mortar_take_dist: c.mortar_take_dist ?? null,
    mortar_climb_dist: c.mortar_climb_dist ?? null,
    mortar_place_dist: c.mortar_place_dist ?? null,
    mortar_return_dist: c.mortar_return_dist ?? null,
    lay_take_dist: c.lay_take_dist ?? null,
    lay_place_dist: c.lay_place_dist ?? null,
    lay_finish_dist: c.lay_finish_dist ?? null,
  };
}

export function applyBrickToConfig(
  base: SimulationConfig,
  fields?: Partial<BrickConfigFields>,
): SimulationConfig {
  const f = { ...readBrickFields(base), ...fields };
  const layM2 = f.lay_bricks_per_cycle / f.bricks_per_m2;
  const liftM2 = f.batch_bricks / f.bricks_per_m2;
  return {
    ...base,
    operation: "bricklaying",
    ...f,
    num_loaders: f.num_masons,
    num_haulers: f.num_helpers,
    loader_bucket_m3: layM2,
    hauler_capacity_m3: liftM2,
    payload_per_trip: layM2,
    load_time_mean: f.lay_place_mean,
    haul_time_mean: f.lift_climb_mean,
    dump_time_mean: f.lay_finish_mean,
    return_time_mean: f.lay_take_mean,
    load_dist: fromMeanCv(f.lay_place_mean, base.cv ?? 0.15, base.default_dist_kind ?? "normal"),
    haul_dist: fromMeanCv(f.lift_climb_mean, base.cv ?? 0.15, base.default_dist_kind ?? "normal"),
    dump_dist: fromMeanCv(f.lay_finish_mean, base.cv ?? 0.15, base.default_dist_kind ?? "normal"),
    return_dist: fromMeanCv(f.lay_take_mean, base.cv ?? 0.15, base.default_dist_kind ?? "normal"),
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

type Job = "fetch" | "lift" | "mortar" | null;
type EvKind =
  | "helper_free"
  | "fetch_travel_done"
  | "fetch_load_done"
  | "fetch_return_done"
  | "fetch_unload_done"
  | "lift_take_done"
  | "lift_climb_done"
  | "lift_unload_done"
  | "lift_return_done"
  | "mortar_take_done"
  | "mortar_climb_done"
  | "mortar_place_done"
  | "mortar_return_done"
  | "mason_free"
  | "lay_take_done"
  | "lay_place_done"
  | "lay_finish_done";

type Ev = { t: number; kind: EvKind; id: number; seq: number; n?: number };

function sample(
  rng: Rng,
  config: SimulationConfig,
  mean: number,
  dist?: DurationDist | null,
): number {
  return sampleDuration(resolveDist(config, dist ?? null, mean), rng);
}

export function runBrickTripleSimulation(configIn: SimulationConfig): SimulationResult {
  const f = readBrickFields(configIn);
  const config = applyBrickToConfig(configIn, f);
  const rng = new Rng(config.seed);

  let maxHorizon = config.simulation_duration > 0 ? config.simulation_duration : 7 * 24 * 60;
  let targetCycles = Math.max(0, Math.floor(config.target_cycles || 0));
  let targetVolume = Math.max(0, Number(config.target_volume) || 0);
  if (targetCycles <= 0 && targetVolume <= 0) {
    targetCycles = 200;
    targetVolume = 10;
  }

  const batch = f.batch_bricks;
  const tempMax = f.temp_slots * batch;
  const scafMax = f.scaffold_slots * batch;
  const mortarMax = f.mortar_buckets_max;
  const mortarCap = f.mortar_covers_bricks; // bricks per bucket
  const layN = f.lay_bricks_per_cycle;
  const bpm2 = f.bricks_per_m2;

  const nH = f.num_helpers;
  const nM = f.num_masons;

  // stocks (discrete)
  let tempBricks = tempMax; // start full
  let scafBricks = 0;
  /** mortar remaining in bricks-equivalent on scaffold */
  let scafMortarBricks = 0;
  let scafBuckets = 0;

  const events: Ev[] = [];
  let seq = 0;
  const push = (e: Omit<Ev, "seq">) => {
    seq += 1;
    events.push({ ...e, seq });
    events.sort((a, b) => a.t - b.t || a.seq - b.seq);
  };

  const helperBusy: boolean[] = Array(nH).fill(false);
  const masonBusy: boolean[] = Array(nM).fill(false);
  const helperJob: Job[] = Array(nH).fill(null);
  const helperBusyInt: [number, number][][] = Array.from({ length: nH }, () => []);
  const masonBusyInt: [number, number][][] = Array.from({ length: nM }, () => []);
  const masonWaitInt: [number, number][][] = Array.from({ length: nM }, () => []);
  const helperWaitInt: [number, number][][] = Array.from({ length: nH }, () => []);
  const masonWaitStart: number[] = Array(nM).fill(-1);

  const waitSamples: number[] = [];
  const arrivalTimes: number[] = [];
  const serviceTimes: number[] = [];
  let totalTrips = 0;
  let totalBricks = 0;
  let totalVolume = 0;
  let stopReason = "duration";
  let endTime = maxHorizon;
  let reached = false;
  let masonsWaiting = 0;

  const timelineVolume: [number, number][] = [[0, 0]];
  const queueOverTime: [number, number][] = [[0, 0]];
  const activityLog: ActivityLog[] = [];
  const cycleLog: CycleLog[] = [];

  let lastChange = 0;
  let qIntegral = 0;
  let maxQueue = 0;

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
  const markBusy = (ints: [number, number][][], id: number, start: number, dur: number) => {
    const s = Math.max(0, start);
    const e = Math.min(maxHorizon, start + dur);
    if (e > s) ints[id].push([s, e]);
  };
  const recAct = (hid: number, phase: string, start: number, dur: number) => {
    const s = Math.max(0, start);
    const e = Math.min(maxHorizon, start + dur);
    if (e > s) activityLog.push({ hauler_id: hid, phase, start: s, end: e, duration: e - s });
  };

  const freeScafSlots = () => Math.floor((scafMax - scafBricks) / batch);
  const freeTempSlots = () => Math.floor((tempMax - tempBricks) / batch);
  const needFetch = () =>
    tempBricks <= f.temp_refill_threshold && freeTempSlots() > 0;
  const canLiftBrick = () => tempBricks >= batch && freeScafSlots() > 0;
  const canLiftMortar = () => scafBuckets < mortarMax;
  const canLay = () => scafBricks >= layN && scafMortarBricks >= layN;

  const tryStartHelpers = (now: number) => {
    if (reached) return;
    for (let id = 0; id < nH; id++) {
      if (helperBusy[id]) continue;

      // Prioritas: (1) mortar jika scaffold hampir kosong mortar
      // (2) lift bata jika slot kosong
      // (3) fetch jauh jika temp ≤ threshold
      const mortarLow = scafMortarBricks < layN * nM || scafBuckets < 1;
      let job: Job = null;
      if (mortarLow && canLiftMortar()) job = "mortar";
      else if (canLiftBrick()) job = "lift";
      else if (needFetch()) job = "fetch";
      else if (canLiftMortar() && scafBuckets < mortarMax) job = "mortar";
      else if (canLiftBrick()) job = "lift";
      if (!job) continue;

      helperBusy[id] = true;
      helperJob[id] = job;

      if (job === "fetch") {
        const d = sample(rng, config, f.far_travel_mean, f.far_travel_dist);
        markBusy(helperBusyInt, id, now, d);
        recAct(id, "fetch_far_travel", now, d);
        push({ t: now + d, kind: "fetch_travel_done", id });
      } else if (job === "lift") {
        tempBricks -= batch; // reserve batch from temp
        const d = sample(rng, config, f.lift_take_mean, f.lift_take_dist);
        markBusy(helperBusyInt, id, now, d);
        recAct(id, "lift_take", now, d);
        push({ t: now + d, kind: "lift_take_done", id, n: batch });
      } else {
        // mortar — ground unlimited
        const d = sample(rng, config, f.mortar_take_mean, f.mortar_take_dist);
        markBusy(helperBusyInt, id, now, d);
        recAct(id, "mortar_take", now, d);
        push({ t: now + d, kind: "mortar_take_done", id, n: 1 });
      }
    }
  };

  const tryStartMasons = (now: number) => {
    if (reached) return;
    for (let id = 0; id < nM; id++) {
      if (masonBusy[id]) continue;
      if (!canLay()) {
        if (masonWaitStart[id] < 0) {
          masonWaitStart[id] = now;
          masonsWaiting += 1;
          integrateQ(now);
          snapQ(now);
        }
        continue;
      }
      if (masonWaitStart[id] >= 0) {
        const w = Math.max(0, now - masonWaitStart[id]);
        waitSamples.push(w);
        if (w > 1e-9) markBusy(masonWaitInt, id, masonWaitStart[id], w);
        masonWaitStart[id] = -1;
        masonsWaiting = Math.max(0, masonsWaiting - 1);
        integrateQ(now);
        snapQ(now);
      }
      // consume resources at start of lay
      scafBricks -= layN;
      scafMortarBricks -= layN;
      // free bucket slots when mortar fully used
      scafBuckets = Math.min(mortarMax, Math.ceil(scafMortarBricks / mortarCap));

      masonBusy[id] = true;
      arrivalTimes.push(now);
      const d = sample(rng, config, f.lay_take_mean, f.lay_take_dist);
      markBusy(masonBusyInt, id, now, d);
      recAct(1000 + id, "lay_take", now, d);
      push({ t: now + d, kind: "lay_take_done", id, n: layN });
    }
  };

  for (let id = 0; id < nH; id++) push({ t: 0, kind: "helper_free", id });
  for (let id = 0; id < nM; id++) push({ t: 0, kind: "mason_free", id });

  let safety = 0;
  while (events.length > 0 && safety < 3_000_000) {
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
        const d = sample(rng, config, f.far_load_mean, f.far_load_dist);
        markBusy(helperBusyInt, ev.id, now, d);
        recAct(ev.id, "fetch_far_load", now, d);
        push({ t: now + d, kind: "fetch_load_done", id: ev.id, n: batch });
        break;
      }
      case "fetch_load_done": {
        const d = sample(rng, config, f.far_return_mean, f.far_return_dist);
        markBusy(helperBusyInt, ev.id, now, d);
        recAct(ev.id, "fetch_far_return", now, d);
        push({ t: now + d, kind: "fetch_return_done", id: ev.id, n: batch });
        break;
      }
      case "fetch_return_done": {
        // wait if no free temp slot
        if (freeTempSlots() <= 0) {
          const wait = 0.3;
          markBusy(helperWaitInt, ev.id, now, wait);
          push({ t: now + wait, kind: "fetch_return_done", id: ev.id, n: batch });
          break;
        }
        const d = sample(rng, config, f.far_unload_mean, f.far_unload_dist);
        markBusy(helperBusyInt, ev.id, now, d);
        recAct(ev.id, "fetch_unload_temp", now, d);
        push({ t: now + d, kind: "fetch_unload_done", id: ev.id, n: batch });
        break;
      }
      case "fetch_unload_done": {
        tempBricks = Math.min(tempMax, tempBricks + (ev.n ?? batch));
        helperBusy[ev.id] = false;
        helperJob[ev.id] = null;
        tryStartHelpers(now);
        tryStartMasons(now);
        break;
      }

      case "lift_take_done": {
        const d = sample(rng, config, f.lift_climb_mean, f.lift_climb_dist);
        markBusy(helperBusyInt, ev.id, now, d);
        recAct(ev.id, "lift_climb", now, d);
        push({ t: now + d, kind: "lift_climb_done", id: ev.id, n: ev.n });
        break;
      }
      case "lift_climb_done": {
        // only unload if a full slot is free; else wait on scaffold
        if (freeScafSlots() <= 0) {
          const wait = 0.3;
          markBusy(helperWaitInt, ev.id, now, wait);
          push({ t: now + wait, kind: "lift_climb_done", id: ev.id, n: ev.n });
          break;
        }
        const d = sample(rng, config, f.lift_unload_mean, f.lift_unload_dist);
        markBusy(helperBusyInt, ev.id, now, d);
        recAct(ev.id, "lift_unload", now, d);
        push({ t: now + d, kind: "lift_unload_done", id: ev.id, n: ev.n });
        break;
      }
      case "lift_unload_done": {
        scafBricks = Math.min(scafMax, scafBricks + (ev.n ?? batch));
        const d = sample(rng, config, f.lift_return_mean, f.lift_return_dist);
        markBusy(helperBusyInt, ev.id, now, d);
        recAct(ev.id, "lift_return", now, d);
        push({ t: now + d, kind: "lift_return_done", id: ev.id });
        tryStartMasons(now);
        break;
      }
      case "lift_return_done":
        helperBusy[ev.id] = false;
        helperJob[ev.id] = null;
        tryStartHelpers(now);
        tryStartMasons(now);
        break;

      case "mortar_take_done": {
        const d = sample(rng, config, f.mortar_climb_mean, f.mortar_climb_dist);
        markBusy(helperBusyInt, ev.id, now, d);
        recAct(ev.id, "mortar_climb", now, d);
        push({ t: now + d, kind: "mortar_climb_done", id: ev.id, n: 1 });
        break;
      }
      case "mortar_climb_done": {
        if (scafBuckets >= mortarMax) {
          const wait = 0.3;
          markBusy(helperWaitInt, ev.id, now, wait);
          push({ t: now + wait, kind: "mortar_climb_done", id: ev.id, n: 1 });
          break;
        }
        const d = sample(rng, config, f.mortar_place_mean, f.mortar_place_dist);
        markBusy(helperBusyInt, ev.id, now, d);
        recAct(ev.id, "mortar_place", now, d);
        push({ t: now + d, kind: "mortar_place_done", id: ev.id, n: 1 });
        break;
      }
      case "mortar_place_done": {
        scafBuckets = Math.min(mortarMax, scafBuckets + 1);
        scafMortarBricks = Math.min(mortarMax * mortarCap, scafMortarBricks + mortarCap);
        const d = sample(rng, config, f.mortar_return_mean, f.mortar_return_dist);
        markBusy(helperBusyInt, ev.id, now, d);
        recAct(ev.id, "mortar_return", now, d);
        push({ t: now + d, kind: "mortar_return_done", id: ev.id });
        tryStartMasons(now);
        break;
      }
      case "mortar_return_done":
        helperBusy[ev.id] = false;
        helperJob[ev.id] = null;
        tryStartHelpers(now);
        tryStartMasons(now);
        break;

      case "mason_free":
        masonBusy[ev.id] = false;
        tryStartMasons(now);
        tryStartHelpers(now);
        break;

      case "lay_take_done": {
        const d = sample(rng, config, f.lay_place_mean, f.lay_place_dist);
        markBusy(masonBusyInt, ev.id, now, d);
        recAct(1000 + ev.id, "lay_place", now, d);
        serviceTimes.push(d);
        push({ t: now + d, kind: "lay_place_done", id: ev.id, n: ev.n });
        break;
      }
      case "lay_place_done": {
        const d = sample(rng, config, f.lay_finish_mean, f.lay_finish_dist);
        markBusy(masonBusyInt, ev.id, now, d);
        recAct(1000 + ev.id, "lay_finish", now, d);
        push({ t: now + d, kind: "lay_finish_done", id: ev.id, n: ev.n });
        break;
      }
      case "lay_finish_done": {
        const bricks = ev.n ?? layN;
        const vol = bricks / bpm2;
        totalTrips += 1;
        totalBricks += bricks;
        totalVolume += vol;
        timelineVolume.push([now, totalVolume]);
        const cyc = f.lay_take_mean + f.lay_place_mean + f.lay_finish_mean;
        cycleLog.push({
          hauler_id: 1000 + ev.id,
          trip: totalTrips,
          wait: 0,
          load: f.lay_take_mean,
          haul: f.lay_place_mean,
          dump: f.lay_finish_mean,
          return: 0,
          cycle_time: cyc,
          productive_time: cyc,
          finish_time: now,
          return_finish: now,
          volume: vol,
          productivity: vol > 0 ? vol / Math.max(1e-9, cyc / 60) : 0,
        });

        if (!reached) {
          const hitC = targetCycles > 0 && totalTrips >= targetCycles;
          const hitV = targetVolume > 0 && totalVolume >= targetVolume - 1e-9;
          const mode = config.stop_mode ?? "either";
          if (hitC && hitV) {
            reached = true;
            stopReason = "target_both";
            endTime = now;
          } else if (mode === "either" && (hitC || hitV)) {
            reached = true;
            stopReason = hitC ? "target_cycles" : "target_volume";
            endTime = now;
          } else if (mode === "cycles" && hitC) {
            reached = true;
            stopReason = "target_cycles";
            endTime = now;
          } else if (mode === "volume" && hitV) {
            reached = true;
            stopReason = "target_volume";
            endTime = now;
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
      (s, rows) =>
        s + rows.reduce((a, [x, y]) => a + Math.max(0, Math.min(y, horizon) - Math.max(x, 0)), 0),
      0,
    );
  const masonBusyMin = sumBusy(masonBusyInt);
  const helperBusyMin = sumBusy(helperBusyInt);
  const masonWaitMin = sumBusy(masonWaitInt);
  const helperWaitMin = sumBusy(helperWaitInt);
  const loaderUtil = Math.min(1, masonBusyMin / (nM * horizon));
  const haulerUtil = Math.min(1, helperBusyMin / (nH * horizon));
  const avgWait = waitSamples.length
    ? waitSamples.reduce((a, b) => a + b, 0) / waitSamples.length
    : 0;
  const avgQ = qIntegral / horizon;
  const throughput = (totalVolume / horizon) * 60;

  let bottleneck = "Seimbang";
  let bottleneck_reason = "Supply bata/mortar dan tukang relatif seimbang.";
  if (loaderUtil > 0.85 && avgWait < 0.3) {
    bottleneck = "Tukang";
    bottleneck_reason = "Tukang jenuh — tambah tukang atau percepat pasang.";
  } else if (haulerUtil > 0.85 && loaderUtil < 0.7) {
    bottleneck = "Helper";
    bottleneck_reason =
      "Helper sibuk (fetch jauh / lift bata / mortar). Tambah helper atau perbesar slot scaffold.";
  } else if (avgWait > 1 || avgQ > 0.4) {
    bottleneck = "Scaffold stock / mortar";
    bottleneck_reason =
      "Tukang menunggu bata atau mortar di scaffold — isi slot (max 3×batch) atau ember mortar (3).";
  }

  return {
    operation: "bricklaying",
    config: { ...config, num_loaders: nM, num_haulers: nH },
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
    avg_cycle_components: {
      wait: avgWait,
      load: f.lay_take_mean,
      haul: f.lay_place_mean,
      dump: f.lay_finish_mean,
      return: 0,
    },
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

export function brickTheoreticalThroughput(cfg: SimulationConfig): {
  fetch: number;
  lift: number;
  lay: number;
  mortar: number;
  system: number;
} {
  const f = readBrickFields(cfg);
  const batch = f.batch_bricks;
  const bpm2 = f.bricks_per_m2;
  const farCyc =
    f.far_travel_mean + f.far_load_mean + f.far_return_mean + f.far_unload_mean;
  const liftCyc =
    f.lift_take_mean + f.lift_climb_mean + f.lift_unload_mean + f.lift_return_mean;
  const mortCyc =
    f.mortar_take_mean + f.mortar_climb_mean + f.mortar_place_mean + f.mortar_return_mean;
  const layCyc = f.lay_take_mean + f.lay_place_mean + f.lay_finish_mean;
  // helpers split ~3 ways among fetch/lift/mortar when all needed
  const share = f.num_helpers / 3;
  const fetch = farCyc > 0 ? (60 / farCyc) * share * (batch / bpm2) : 0;
  const lift = liftCyc > 0 ? (60 / liftCyc) * share * (batch / bpm2) : 0;
  const mortar =
    mortCyc > 0
      ? (60 / mortCyc) * share * (f.mortar_covers_bricks / bpm2)
      : 0;
  const lay =
    layCyc > 0
      ? (60 / layCyc) * f.num_masons * (f.lay_bricks_per_cycle / bpm2)
      : 0;
  const system = Math.min(fetch, lift, mortar, lay);
  return { fetch, lift, lay, mortar, system };
}
