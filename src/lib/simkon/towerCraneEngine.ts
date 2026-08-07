/**
 * Tower Crane — single server, multi-front priority DES
 *
 * Satu tower crane melayani 1–5 front pekerjaan. Material di ground yard diangkat
 * ke masing-masing front. Antrian request memakai prioritas (1 = tertinggi).
 * Tujuan: util crane, waktu tunggu per front, apakah crane jadi bottleneck.
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

export function isTowerCraneOperation(op: string | undefined): boolean {
  return op === "tower_crane";
}

export type CraneFront = {
  id: number;
  name: string;
  /** 1 = prioritas tertinggi */
  priority: number;
  /** volume/unit kerja per lift */
  volume_per_lift: number;
  /** beban (ton) — dibandingkan kapasitas crane */
  payload_ton: number;
  /** waktu di ground hook+sling (menit) */
  hook_mean: number;
  hoist_mean: number;
  swing_mean: number;
  lower_mean: number;
  unhook_mean: number;
  return_empty_mean: number;
  /** kerja lokal di front sebelum minta lift berikutnya */
  local_work_mean: number;
  enabled: boolean;
};

export type TowerCraneFields = {
  num_cranes: number;
  capacity_ton: number;
  /** sedikit lebih lambat jika payload > 70% kapasitas */
  heavy_load_factor: number;
  fronts: CraneFront[];
  hook_dist?: DurationDist | null;
  hoist_dist?: DurationDist | null;
  swing_dist?: DurationDist | null;
  lower_dist?: DurationDist | null;
  unhook_dist?: DurationDist | null;
  return_dist?: DurationDist | null;
  local_dist?: DurationDist | null;
};

export function defaultFronts(): CraneFront[] {
  return [
    {
      id: 0,
      name: "Front A · formwork",
      priority: 1,
      volume_per_lift: 1.2,
      payload_ton: 1.5,
      hook_mean: 1.2,
      hoist_mean: 1.8,
      swing_mean: 1.0,
      lower_mean: 1.2,
      unhook_mean: 0.8,
      return_empty_mean: 1.5,
      local_work_mean: 8,
      enabled: true,
    },
    {
      id: 1,
      name: "Front B · rebar",
      priority: 2,
      volume_per_lift: 0.8,
      payload_ton: 1.0,
      hook_mean: 1.0,
      hoist_mean: 1.5,
      swing_mean: 0.9,
      lower_mean: 1.0,
      unhook_mean: 0.7,
      return_empty_mean: 1.3,
      local_work_mean: 6,
      enabled: true,
    },
    {
      id: 2,
      name: "Front C · concrete bucket",
      priority: 1,
      volume_per_lift: 1.0,
      payload_ton: 2.5,
      hook_mean: 1.5,
      hoist_mean: 2.2,
      swing_mean: 1.2,
      lower_mean: 1.5,
      unhook_mean: 1.0,
      return_empty_mean: 1.8,
      local_work_mean: 5,
      enabled: true,
    },
    {
      id: 3,
      name: "Front D · MEP",
      priority: 3,
      volume_per_lift: 0.5,
      payload_ton: 0.6,
      hook_mean: 0.8,
      hoist_mean: 1.2,
      swing_mean: 0.8,
      lower_mean: 0.9,
      unhook_mean: 0.6,
      return_empty_mean: 1.1,
      local_work_mean: 10,
      enabled: false,
    },
    {
      id: 4,
      name: "Front E · finishing",
      priority: 4,
      volume_per_lift: 0.4,
      payload_ton: 0.4,
      hook_mean: 0.7,
      hoist_mean: 1.0,
      swing_mean: 0.7,
      lower_mean: 0.8,
      unhook_mean: 0.5,
      return_empty_mean: 1.0,
      local_work_mean: 12,
      enabled: false,
    },
  ];
}

export function towerCraneDefaults(): TowerCraneFields {
  return {
    num_cranes: 1,
    capacity_ton: 5,
    heavy_load_factor: 1.15,
    fronts: defaultFronts(),
  };
}

export function readTowerCraneFields(cfg: SimulationConfig): TowerCraneFields {
  const d = towerCraneDefaults();
  const c = cfg as SimulationConfig & Partial<TowerCraneFields> & {
    crane_fronts_json?: string;
  };
  let fronts = d.fronts;
  if (Array.isArray(c.fronts) && c.fronts.length) fronts = c.fronts;
  else if (typeof c.crane_fronts_json === "string") {
    try {
      const parsed = JSON.parse(c.crane_fronts_json) as CraneFront[];
      if (Array.isArray(parsed) && parsed.length) fronts = parsed;
    } catch {
      /* keep default */
    }
  }
  return {
    num_cranes: Math.max(1, Math.min(2, Math.floor(c.num_cranes ?? 1))),
    capacity_ton: Math.max(0.5, c.capacity_ton ?? d.capacity_ton),
    heavy_load_factor: Math.max(1, c.heavy_load_factor ?? d.heavy_load_factor),
    fronts: fronts.map((f, i) => ({
      ...defaultFronts()[i] ?? defaultFronts()[0],
      ...f,
      id: i,
      priority: Math.max(1, Math.min(9, Math.floor(f.priority || i + 1))),
      enabled: f.enabled !== false,
    })),
  };
}

export function applyTowerCraneToConfig(
  base: SimulationConfig,
  fields?: Partial<TowerCraneFields>,
): SimulationConfig {
  const f = { ...readTowerCraneFields(base), ...fields };
  if (fields?.fronts) f.fronts = fields.fronts;
  const active = f.fronts.filter((x) => x.enabled);
  const avgVol =
    active.length > 0
      ? active.reduce((s, x) => s + x.volume_per_lift, 0) / active.length
      : 1;
  const avgCycle =
    active.length > 0
      ? active.reduce(
          (s, x) =>
            s +
            x.hook_mean +
            x.hoist_mean +
            x.swing_mean +
            x.lower_mean +
            x.unhook_mean +
            x.return_empty_mean,
          0,
        ) / active.length
      : 8;
  return {
    ...base,
    operation: "tower_crane",
    num_loaders: f.num_cranes,
    num_haulers: Math.max(1, active.length),
    loader_bucket_m3: avgVol,
    hauler_capacity_m3: avgVol,
    payload_per_trip: avgVol,
    load_time_mean: avgCycle * 0.35,
    haul_time_mean: avgCycle * 0.25,
    dump_time_mean: avgCycle * 0.2,
    return_time_mean: avgCycle * 0.2,
    load_dist: fromMeanCv(avgCycle * 0.35, base.cv ?? 0.15, base.default_dist_kind ?? "normal"),
    haul_dist: fromMeanCv(avgCycle * 0.25, base.cv ?? 0.15, base.default_dist_kind ?? "normal"),
    dump_dist: fromMeanCv(avgCycle * 0.2, base.cv ?? 0.15, base.default_dist_kind ?? "normal"),
    return_dist: fromMeanCv(avgCycle * 0.2, base.cv ?? 0.15, base.default_dist_kind ?? "normal"),
    num_cranes: f.num_cranes,
    capacity_ton: f.capacity_ton,
    heavy_load_factor: f.heavy_load_factor,
    crane_fronts_json: JSON.stringify(f.fronts),
    fronts: f.fronts,
    cost_loader_per_hour: base.cost_loader_per_hour || 500_000,
    cost_hauler_per_hour: base.cost_hauler_per_hour || 0,
    fuel_loader_work_lph: base.fuel_loader_work_lph || 12,
    fuel_loader_idle_lph: base.fuel_loader_idle_lph || 4,
    fuel_hauler_work_lph: 0,
    fuel_hauler_idle_lph: 0,
  } as SimulationConfig;
}

type Req = {
  frontId: number;
  priority: number;
  tRequest: number;
  seq: number;
};

type EvKind =
  | "front_request"
  | "crane_hook_done"
  | "crane_hoist_done"
  | "crane_swing_done"
  | "crane_lower_done"
  | "crane_unhook_done"
  | "crane_return_done"
  | "front_local_done";

type Ev = {
  t: number;
  kind: EvKind;
  frontId: number;
  craneId: number;
  seq: number;
  vol?: number;
};

function sample(
  rng: Rng,
  config: SimulationConfig,
  mean: number,
  dist?: DurationDist | null,
): number {
  return sampleDuration(resolveDist(config, dist ?? null, mean), rng);
}

function loadFactor(payload: number, cap: number, heavy: number): number {
  if (payload > cap + 1e-9) return -1; // overload — skip / reject
  if (payload > cap * 0.7) return heavy;
  return 1;
}

export type FrontStats = {
  id: number;
  name: string;
  priority: number;
  lifts: number;
  volume: number;
  wait_total: number;
  wait_avg: number;
  busy_local: number;
  waiting_for_crane: number;
};

export function runTowerCraneSimulation(configIn: SimulationConfig): SimulationResult & {
  front_stats?: FrontStats[];
} {
  const f = readTowerCraneFields(configIn);
  const config = applyTowerCraneToConfig(configIn, f);
  const rng = new Rng(config.seed);

  let maxHorizon = config.simulation_duration > 0 ? config.simulation_duration : 8 * 60;
  let targetCycles = Math.max(0, Math.floor(config.target_cycles || 0));
  let targetVolume = Math.max(0, Number(config.target_volume) || 0);
  // Tower crane default stop: waktu operasi maksimum (bukan volume).
  // target_cycles/volume only if explicitly > 0.
  if (targetCycles <= 0 && targetVolume <= 0 && !(config.simulation_duration > 0)) {
    maxHorizon = 8 * 60;
  }

  const fronts = f.fronts.filter((x) => x.enabled);
  const nCrane = f.num_cranes;
  const nFront = fronts.length;
  if (nFront === 0) {
    // degenerate empty
    return runEmpty(config, maxHorizon);
  }

  const frontById = new Map(fronts.map((x) => [x.id, x]));
  const events: Ev[] = [];
  let seq = 0;
  const push = (e: Omit<Ev, "seq">) => {
    seq += 1;
    events.push({ ...e, seq });
    events.sort((a, b) => a.t - b.t || a.seq - b.seq);
  };

  const craneFree: boolean[] = Array(nCrane).fill(true);
  const queue: Req[] = [];
  let reqSeq = 0;

  // per front
  const waitingSince: number[] = Array(5).fill(-1);
  const stats: FrontStats[] = fronts.map((fr) => ({
    id: fr.id,
    name: fr.name,
    priority: fr.priority,
    lifts: 0,
    volume: 0,
    wait_total: 0,
    wait_avg: 0,
    busy_local: 0,
    waiting_for_crane: 0,
  }));
  const statIdx = new Map(stats.map((s, i) => [s.id, i]));

  const craneBusyInt: [number, number][][] = Array.from({ length: nCrane }, () => []);
  const activityLog: ActivityLog[] = [];
  const cycleLog: CycleLog[] = [];
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
  let lastChange = 0;
  let qIntegral = 0;
  let maxQueue = 0;

  const integrateQ = (t: number) => {
    t = Math.min(t, maxHorizon);
    if (t > lastChange) {
      qIntegral += queue.length * (t - lastChange);
      lastChange = t;
    }
  };
  const snapQ = (t: number) => {
    maxQueue = Math.max(maxQueue, queue.length);
    const last = queueOverTime[queueOverTime.length - 1];
    if (!last || last[1] !== queue.length) {
      queueOverTime.push([Math.min(t, maxHorizon), queue.length]);
    }
  };

  const markBusy = (cid: number, start: number, dur: number) => {
    const s = Math.max(0, start);
    const e = Math.min(maxHorizon, start + dur);
    if (e > s) craneBusyInt[cid].push([s, e]);
  };
  const recAct = (hid: number, phase: string, start: number, dur: number) => {
    const s = Math.max(0, start);
    const e = Math.min(maxHorizon, start + dur);
    if (e > s) activityLog.push({ hauler_id: hid, phase, start: s, end: e, duration: e - s });
  };

  const pickRequest = (): Req | null => {
    if (!queue.length) return null;
    // priority ASC (1 first), then earliest request
    queue.sort((a, b) => a.priority - b.priority || a.tRequest - b.tRequest || a.seq - b.seq);
    return queue.shift()!;
  };

  const tryDispatch = (now: number) => {
    if (reached) return;
    for (let cid = 0; cid < nCrane; cid++) {
      if (!craneFree[cid]) continue;
      const req = pickRequest();
      if (!req) return;
      integrateQ(now);
      snapQ(now);
      const fr = frontById.get(req.frontId);
      if (!fr) continue;
      const lf = loadFactor(fr.payload_ton, f.capacity_ton, f.heavy_load_factor);
      if (lf < 0) {
        // overload: reject, front retries after short delay as new request
        push({
          t: now + 0.5,
          kind: "front_request",
          frontId: fr.id,
          craneId: -1,
        });
        continue;
      }
      craneFree[cid] = false;
      const wait = Math.max(0, now - req.tRequest);
      waitSamples.push(wait);
      const si = statIdx.get(fr.id);
      if (si != null) {
        stats[si].wait_total += wait;
        if (waitingSince[fr.id] >= 0) {
          stats[si].waiting_for_crane += Math.max(0, now - waitingSince[fr.id]);
          waitingSince[fr.id] = -1;
        }
      }
      arrivalTimes.push(now);
      const d = sample(rng, config, fr.hook_mean, f.hook_dist) * lf;
      markBusy(cid, now, d);
      recAct(cid, "hook", now, d);
      push({
        t: now + d,
        kind: "crane_hook_done",
        frontId: fr.id,
        craneId: cid,
        vol: fr.volume_per_lift,
      });
    }
  };

  const enqueue = (now: number, frontId: number) => {
    const fr = frontById.get(frontId);
    if (!fr || reached) return;
    reqSeq += 1;
    queue.push({
      frontId,
      priority: fr.priority,
      tRequest: now,
      seq: reqSeq,
    });
    waitingSince[frontId] = now;
    integrateQ(now);
    snapQ(now);
    tryDispatch(now);
  };

  // bootstrap: each front requests first lift at t=0 (+ tiny stagger)
  fronts.forEach((fr, i) => {
    push({ t: i * 0.01, kind: "front_request", frontId: fr.id, craneId: -1 });
  });

  let safety = 0;
  while (events.length > 0 && safety < 2_000_000) {
    safety += 1;
    const ev = events.shift()!;
    const now = ev.t;
    if (now > maxHorizon + 1e-9) break;
    const fr = frontById.get(ev.frontId);

    switch (ev.kind) {
      case "front_request":
        enqueue(now, ev.frontId);
        break;

      case "crane_hook_done": {
        if (!fr) break;
        const lf = Math.max(1, loadFactor(fr.payload_ton, f.capacity_ton, f.heavy_load_factor));
        const d = sample(rng, config, fr.hoist_mean, f.hoist_dist) * lf;
        markBusy(ev.craneId, now, d);
        recAct(ev.craneId, "hoist", now, d);
        push({
          t: now + d,
          kind: "crane_hoist_done",
          frontId: fr.id,
          craneId: ev.craneId,
          vol: ev.vol,
        });
        break;
      }
      case "crane_hoist_done": {
        if (!fr) break;
        const d = sample(rng, config, fr.swing_mean, f.swing_dist);
        markBusy(ev.craneId, now, d);
        recAct(ev.craneId, "swing", now, d);
        push({
          t: now + d,
          kind: "crane_swing_done",
          frontId: fr.id,
          craneId: ev.craneId,
          vol: ev.vol,
        });
        break;
      }
      case "crane_swing_done": {
        if (!fr) break;
        const lf = Math.max(1, loadFactor(fr.payload_ton, f.capacity_ton, f.heavy_load_factor));
        const d = sample(rng, config, fr.lower_mean, f.lower_dist) * lf;
        markBusy(ev.craneId, now, d);
        recAct(ev.craneId, "lower", now, d);
        push({
          t: now + d,
          kind: "crane_lower_done",
          frontId: fr.id,
          craneId: ev.craneId,
          vol: ev.vol,
        });
        break;
      }
      case "crane_lower_done": {
        if (!fr) break;
        const d = sample(rng, config, fr.unhook_mean, f.unhook_dist);
        markBusy(ev.craneId, now, d);
        recAct(ev.craneId, "unhook", now, d);
        serviceTimes.push(d);
        push({
          t: now + d,
          kind: "crane_unhook_done",
          frontId: fr.id,
          craneId: ev.craneId,
          vol: ev.vol,
        });
        break;
      }
      case "crane_unhook_done": {
        // material delivered — count production; front starts local work; crane returns empty
        if (fr) {
          const vol = ev.vol ?? fr.volume_per_lift;
          totalTrips += 1;
          totalVolume += vol;
          timelineVolume.push([now, totalVolume]);
          const si = statIdx.get(fr.id);
          if (si != null) {
            stats[si].lifts += 1;
            stats[si].volume += vol;
          }
          const cycle =
            fr.hook_mean +
            fr.hoist_mean +
            fr.swing_mean +
            fr.lower_mean +
            fr.unhook_mean +
            fr.return_empty_mean;
          cycleLog.push({
            hauler_id: fr.id,
            trip: totalTrips,
            wait: 0,
            load: fr.hook_mean,
            haul: fr.hoist_mean + fr.swing_mean,
            dump: fr.lower_mean + fr.unhook_mean,
            return: fr.return_empty_mean,
            cycle_time: cycle,
            productive_time: cycle - fr.return_empty_mean,
            finish_time: now,
            return_finish: now,
            volume: vol,
            productivity: vol > 0 ? vol / Math.max(1e-9, cycle / 60) : 0,
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

          if (!reached) {
            const ld = sample(rng, config, fr.local_work_mean, f.local_dist);
            const si2 = statIdx.get(fr.id);
            if (si2 != null) stats[si2].busy_local += ld;
            push({
              t: now + ld,
              kind: "front_local_done",
              frontId: fr.id,
              craneId: -1,
            });
          }
        }
        const d = fr
          ? sample(rng, config, fr.return_empty_mean, f.return_dist)
          : 1;
        markBusy(ev.craneId, now, d);
        recAct(ev.craneId, "return_empty", now, d);
        push({
          t: now + d,
          kind: "crane_return_done",
          frontId: ev.frontId,
          craneId: ev.craneId,
        });
        break;
      }
      case "crane_return_done":
        craneFree[ev.craneId] = true;
        tryDispatch(now);
        break;

      case "front_local_done":
        if (!reached) enqueue(now, ev.frontId);
        break;
    }
    if (reached && events.every((e) => e.kind === "crane_return_done" || e.t > endTime)) {
      // allow crane to finish return
    }
  }

  if (!reached) {
    endTime = maxHorizon;
    stopReason = targetCycles > 0 || targetVolume > 0 ? "duration_cap" : "duration";
  }
  integrateQ(endTime);
  snapQ(endTime);

  const horizon = Math.max(endTime, 1e-9);
  const craneBusyMin = craneBusyInt.reduce(
    (s, rows) =>
      s + rows.reduce((a, [x, y]) => a + Math.max(0, Math.min(y, horizon) - Math.max(x, 0)), 0),
    0,
  );
  const loaderUtil = Math.min(1, craneBusyMin / (nCrane * horizon));
  // "hauler" util ≈ fraction of time fronts not waiting — approximate from local busy
  const frontLocal = stats.reduce((s, x) => s + x.busy_local, 0);
  const haulerUtil = Math.min(1, frontLocal / (Math.max(1, nFront) * horizon));
  const avgWait = waitSamples.length
    ? waitSamples.reduce((a, b) => a + b, 0) / waitSamples.length
    : 0;
  const avgQ = qIntegral / horizon;
  const throughput = (totalVolume / horizon) * 60;

  for (const s of stats) {
    s.wait_avg = s.lifts > 0 ? s.wait_total / s.lifts : 0;
  }

  let bottleneck = "Seimbang";
  let bottleneck_reason =
    "Crane dan front relatif seimbang; cek prioritas jika salah satu front menunggu lama.";
  if (loaderUtil > 0.88) {
    bottleneck = "Tower crane";
    bottleneck_reason =
      "Tower crane hampir jenuh — bottleneck distribusi. Naikkan prioritas front kritis, kurangi front aktif, atau tambah crane / percepat cycle angkat.";
  } else if (avgWait > 5 || avgQ > 1.5) {
    bottleneck = "Antrian lift";
    bottleneck_reason =
      "Antrian request panjang — sesuaikan prioritas (1=penting) atau kurangi frekuensi minta lift front rendah.";
  } else if (loaderUtil < 0.45 && haulerUtil > 0.6) {
    bottleneck = "Under-utilized crane";
    bottleneck_reason =
      "Crane longgar; front banyak kerja lokal — crane bukan bottleneck utama.";
  }

  return {
    operation: "tower_crane",
    config: {
      ...config,
      num_loaders: nCrane,
      num_haulers: nFront,
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
    loader_busy_minutes: craneBusyMin,
    hauler_busy_minutes: frontLocal,
    avg_queue_wait: avgWait,
    avg_queue_length: avgQ,
    max_queue_length: maxQueue,
    total_wait_time: waitSamples.reduce((a, b) => a + b, 0),
    hauler_wait_ratio: 0,
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
      load: fronts.reduce((s, x) => s + x.hook_mean, 0) / nFront,
      haul: fronts.reduce((s, x) => s + x.hoist_mean + x.swing_mean, 0) / nFront,
      dump: fronts.reduce((s, x) => s + x.lower_mean + x.unhook_mean, 0) / nFront,
      return: fronts.reduce((s, x) => s + x.return_empty_mean, 0) / nFront,
    },
    hauler_trips: stats.map((s) => s.lifts),
    hauler_busy_per_unit: stats.map((s) => s.busy_local),
    hauler_wait_per_unit: stats.map((s) => s.wait_total),
    arrival_times: arrivalTimes,
    service_times: serviceTimes,
    wait_samples: waitSamples,
    front_stats: stats,
  };
}

function runEmpty(config: SimulationConfig, horizon: number): SimulationResult {
  return {
    operation: "tower_crane",
    config,
    total_trips: 0,
    total_volume: 0,
    throughput_per_hour: 0,
    simulated_minutes: horizon,
    stop_reason: "duration",
    target_cycles: 0,
    target_volume: 0,
    loader_utilization: 0,
    hauler_utilization: 0,
    loader_busy_minutes: 0,
    hauler_busy_minutes: 0,
    avg_queue_wait: 0,
    avg_queue_length: 0,
    max_queue_length: 0,
    total_wait_time: 0,
    hauler_wait_ratio: 0,
    completed_load_requests: 0,
    censored_waits: 0,
    bottleneck: "—",
    bottleneck_reason: "Tidak ada front aktif.",
    timeline_volume: [[0, 0]],
    queue_over_time: [[0, 0]],
    activity_log: [],
    cycle_log: [],
    avg_cycle_components: {},
    hauler_trips: [],
    hauler_busy_per_unit: [],
    hauler_wait_per_unit: [],
    arrival_times: [],
    service_times: [],
    wait_samples: [],
  };
}

/** Teori kasar: kapasitas crane vs demand front */
export function towerCraneTheory(fields: TowerCraneFields): {
  crane_cap: number;
  demand: number;
  util_theory: number;
  per_front: Array<{ name: string; demand: number; cycle: number }>;
} {
  const active = fields.fronts.filter((x) => x.enabled);
  const per_front = active.map((fr) => {
    const lift =
      fr.hook_mean +
      fr.hoist_mean +
      fr.swing_mean +
      fr.lower_mean +
      fr.unhook_mean +
      fr.return_empty_mean;
    const cycle = lift + fr.local_work_mean;
    const demand = cycle > 0 ? (60 / cycle) * fr.volume_per_lift : 0;
    return { name: fr.name, demand, cycle };
  });
  // crane capacity: if it only served equal share — mean lift cycle
  const meanLift =
    active.length > 0
      ? active.reduce(
          (s, fr) =>
            s +
            fr.hook_mean +
            fr.hoist_mean +
            fr.swing_mean +
            fr.lower_mean +
            fr.unhook_mean +
            fr.return_empty_mean,
          0,
        ) / active.length
      : 8;
  const meanVol =
    active.length > 0
      ? active.reduce((s, fr) => s + fr.volume_per_lift, 0) / active.length
      : 1;
  const crane_cap =
    meanLift > 0 ? (60 / meanLift) * fields.num_cranes * meanVol : 0;
  const demand = per_front.reduce((s, x) => s + x.demand, 0);
  return {
    crane_cap,
    demand,
    util_theory: crane_cap > 0 ? Math.min(1.5, demand / crane_cap) : 0,
    per_front,
  };
}
