/**
 * Kontrak operasi SiklOps — template standar untuk semua operasi.
 * Earthmoving · Bricklaying · Concreting (3 metode place) memakai interface yang sama.
 */

export type OperationId =
  | "earthmoving"
  | "bricklaying"
  | "concreting"
  | "tower_crane";

/** Alias lama skenario tersimpan (RMC 3-op → concreting) */
const LEGACY_OP: Record<string, OperationId> = {
  rmc_dolly: "concreting",
  rmc_crane: "concreting",
  rmc_pump: "concreting",
  "rmc-delivery": "concreting",
  concreting_dolly: "concreting",
};

export type OperationTask = {
  key: "load" | "haul" | "dump" | "return";
  label: string;
};

export type OperationInfo = {
  id: OperationId;
  title: string;
  shortTitle: string;
  description: string;
  tasks: OperationTask[];
  /** Alias string labels for badges */
  taskLabels: string[];
  loaderLabel: string;
  haulerLabel: string;
  loaderCapacityLabel: string;
  haulerCapacityLabel: string;
  unit: string;
  durationUnit: string;
  sinceVersion: string;
  available: boolean;
  comingIn?: string;
  /** Default cycle means (menit) */
  defaults: {
    num_loaders: number;
    num_haulers: number;
    loader_bucket: number;
    hauler_capacity: number;
    load: number;
    haul: number;
    dump: number;
    return: number;
    target_cycles: number;
    target_volume: number;
    cost_loader: number;
    cost_hauler: number;
    cost_loader_operator: number;
    cost_hauler_operator: number;
    fuel_loader_work: number;
    fuel_loader_idle: number;
    fuel_hauler_work: number;
    fuel_hauler_idle: number;
  };
  manual: {
    summary: string;
    howTo: string[];
    notes: string;
  };
  /** Path public ilustrasi proses lapangan (opsional) */
  illustration?: string;
  illustrationCaption?: string;
};

export const OPERATIONS: OperationInfo[] = [
  {
    id: "earthmoving",
    title: "Earthmoving (galian & angkut)",
    shortTitle: "Earthmoving",
    description:
      "Excavator menggali/memuat material ke dump truck di area cut, truck mengangkut ke spoil/disposal, membongkar (dump), lalu kembali ke area galian untuk dimuat lagi.",
    tasks: [
      { key: "load", label: "Load" },
      { key: "haul", label: "Haul" },
      { key: "dump", label: "Dump" },
      { key: "return", label: "Return" },
    ],
    taskLabels: ["Load", "Haul", "Dump", "Return"],
    loaderLabel: "Excavator",
    haulerLabel: "Dump Truck",
    loaderCapacityLabel: "Kapasitas bucket",
    haulerCapacityLabel: "Kapasitas bak",
    unit: "m³",
    durationUnit: "menit",
    sinceVersion: "1.0",
    available: true,
    defaults: {
      num_loaders: 1,
      num_haulers: 4,
      loader_bucket: 0.5,
      hauler_capacity: 4,
      load: 2.5,
      haul: 10,
      dump: 1.5,
      return: 9,
      target_cycles: 50,
      target_volume: 100,
      cost_loader: 160_000,
      cost_hauler: 125_000,
      cost_loader_operator: 80_000,
      cost_hauler_operator: 60_000,
      fuel_loader_work: 4.1,
      fuel_loader_idle: 1.5,
      fuel_hauler_work: 7.1,
      fuel_hauler_idle: 1.5,
    },
    manual: {
      summary:
        "DES armada galian-angkut. Bottleneck biasanya excavator (load) atau dump truck (haul).",
      howTo: [
        "Atur jumlah excavator & dump truck plus kapasitas volume.",
        "Isi mean cycle Load–Haul–Dump–Return (menit) dan distribusi.",
        "Set target siklus dan/atau volume (m³), jalankan simulasi.",
        "Baca Ringkasan (util, antrian, biaya, emisi) lalu tab Perbandingan untuk fleet.",
      ],
      notes:
        "Volume per trip = kapasitas bak truck. Match factor ≈ kap. hauling / kap. loading.",
    },
    illustration: "/illustrations/earthmoving-cycle.jpg",
  },
  {
    id: "bricklaying",
    title: "Bricklaying (pasangan bata)",
    shortTitle: "Bricklaying",
    description:
      "Triple-cycle: helper fetch bata ke temp stock (terbatas) → helper angkat ke scaffold stock (space terbatas) → tukang pasang. Helper satu pool untuk dua siklus supply.",
    tasks: [
      { key: "load", label: "Helper fetch → temp" },
      { key: "haul", label: "Helper lift → scaffold" },
      { key: "dump", label: "Tukang pasang" },
      { key: "return", label: "Buffer / space limit" },
    ],
    taskLabels: ["Fetch→temp", "Lift→scaffold", "Pasang", "Buffer limit"],
    loaderLabel: "Tukang",
    haulerLabel: "Helper",
    loaderCapacityLabel: "Output pasang / siklus",
    haulerCapacityLabel: "Muatan helper / trip",
    unit: "m²",
    durationUnit: "menit",
    sinceVersion: "1.1",
    available: true,
    defaults: {
      num_loaders: 2,
      num_haulers: 3,
      loader_bucket: 0.25,
      hauler_capacity: 0.35,
      load: 2.8,
      haul: 2.5,
      dump: 0.5,
      return: 0.4,
      target_cycles: 60,
      target_volume: 20,
      cost_loader: 75_000,
      cost_hauler: 50_000,
      cost_loader_operator: 0,
      cost_hauler_operator: 0,
      fuel_loader_work: 0,
      fuel_loader_idle: 0,
      fuel_hauler_work: 0,
      fuel_hauler_idle: 0,
    },
    manual: {
      summary:
        "Tiga siklus: (A) helper ambil bata ke temp stock, (B) helper angkat ke scaffold, (C) tukang pasang. Temp & scaffold punya kapasitas terbatas — sumber antrian dan bottleneck.",
      howTo: [
        "Atur jumlah helper (pool A+B) dan tukang (C).",
        "Batasi temp stock dan scaffold space — lihat efek pada util & antrian.",
        "Bandingkan teori min(fetch, lift, lay) dengan throughput DES.",
        "Naikkan helper jika tukang sering menunggu material scaffold.",
      ],
      notes:
        "Volume = m² dinding ekuivalen. Tanpa solar. Biaya = upah per jam.",
    },
    illustration: "/illustrations/bricklaying-cycle.jpg",
    illustrationCaption:
      "Triple-cycle: A Helper fetch bata+mortar → temp/mortar stock (limited) · B Helper lift ke scaffold · C Tukang lay.",
  },
  {
    id: "concreting",
    title: "Concreting (RMC placing)",
    shortTitle: "Concreting",
    description:
      "Ready-mixed concrete: truck-mixer cycle (batching plant ↔ site) interacts with on-site placing (concrete buggy, crane bucket, or pump). Compare methods under the same distance & height scenario.",
    tasks: [
      { key: "load", label: "Fill / charge" },
      { key: "haul", label: "Travel / lift / pump" },
      { key: "dump", label: "Place" },
      { key: "return", label: "Return" },
    ],
    taskLabels: ["Fill", "Travel", "Place", "Return"],
    loaderLabel: "Unit place",
    haulerLabel: "Truck mixer",
    loaderCapacityLabel: "Kapasitas place",
    haulerCapacityLabel: "Kapasitas drum",
    unit: "m³",
    durationUnit: "menit",
    sinceVersion: "1.1",
    available: true,
    defaults: {
      num_loaders: 2,
      num_haulers: 3,
      loader_bucket: 1,
      hauler_capacity: 1,
      load: 2,
      haul: 4,
      dump: 2,
      return: 3,
      target_cycles: 40,
      target_volume: 40,
      cost_loader: 450_000,
      cost_hauler: 280_000,
      cost_loader_operator: 120_000,
      cost_hauler_operator: 80_000,
      fuel_loader_work: 12,
      fuel_loader_idle: 4,
      fuel_hauler_work: 10,
      fuel_hauler_idle: 2,
    },
    manual: {
      summary:
        "One Concreting operation with a shared site scenario (distance & height from truck discharge). Three placing methods: concrete buggy, tower crane + bucket, pump — plus comparison.",
      howTo: [
        "Set site scenario: horizontal distance and vertical height from RMC truck to pour point.",
        "Open method tabs (Buggy / Crane / Pump); place-cycle times are derived from distance/height.",
        "Cycle A truck plant↔site is shared; Cycle B placing differs by method.",
        "Comparison tab: throughput, util, unit cost, unit emissions under the same scenario.",
      ],
      notes:
        "Dual-cycle + site buffer. Production counted at place completion. Who waits whom: trucks wait if buffer full; place waits if buffer empty.",
    },
  },
  {
    id: "tower_crane",
    title: "Tower Crane (multi-front)",
    shortTitle: "Tower Crane",
    description:
      "Satu tower crane melayani 1–5 front pekerjaan. Material dari yard diangkat ke masing-masing front dengan sistem prioritas. Ukuran sibuk crane dan bottleneck terhadap pekerjaan lain.",
    tasks: [
      { key: "load", label: "Hook / sling" },
      { key: "haul", label: "Hoist + swing" },
      { key: "dump", label: "Lower + unhook" },
      { key: "return", label: "Return empty" },
    ],
    taskLabels: ["Hook", "Hoist+swing", "Lower+unhook", "Return empty"],
    loaderLabel: "Tower crane",
    haulerLabel: "Work front",
    loaderCapacityLabel: "Kapasitas angkat (ton)",
    haulerCapacityLabel: "Volume per lift",
    unit: "unit",
    durationUnit: "menit",
    sinceVersion: "1.2",
    available: true,
    defaults: {
      num_loaders: 1,
      num_haulers: 3,
      loader_bucket: 1,
      hauler_capacity: 1,
      load: 1.5,
      haul: 2.5,
      dump: 2,
      return: 1.5,
      target_cycles: 50,
      target_volume: 40,
      cost_loader: 500_000,
      cost_hauler: 0,
      cost_loader_operator: 150_000,
      cost_hauler_operator: 0,
      fuel_loader_work: 12,
      fuel_loader_idle: 4,
      fuel_hauler_work: 0,
      fuel_hauler_idle: 0,
    },
    manual: {
      summary:
        "Single-server multi-client: tower crane + N front. Antrian request diurut prioritas (1=tertinggi), lalu FIFO.",
      howTo: [
        "Aktifkan 1–5 front; set prioritas dan cycle time tiap front.",
        "Set kapasitas angkat (ton); beban > kapasitas ditolak/retry.",
        "Jalankan sim — lihat util crane, antrian, wait per front.",
        "Front prioritas rendah menunggu lebih lama saat crane jenuh.",
      ],
      notes:
        "Bottleneck tipikal = crane util tinggi + antrian lift. Naikkan prioritas front kritis atau kurangi frekuensi minta material.",
    },
    illustration: "/illustrations/tower-crane-multi-front.jpg",
    illustrationCaption:
      "Single-server multi-front: yard → tower crane → Front A/B/C with priority queue (1 = highest).",
  },

];

export function resolveOperationId(id: string | undefined | null): OperationId {
  if (!id) return "earthmoving";
  if (id in LEGACY_OP) return LEGACY_OP[id];
  if (OPERATIONS.some((o) => o.id === id)) return id as OperationId;
  return "earthmoving";
}

export function getOperation(id: OperationId | string): OperationInfo {
  const resolved = resolveOperationId(id);
  return OPERATIONS.find((o) => o.id === resolved) ?? OPERATIONS[0];
}

export function listAvailableOperations(): OperationInfo[] {
  return OPERATIONS.filter((o) => o.available);
}

export function phaseLabelsFor(op: OperationId): Record<string, string> {
  const info = getOperation(op);
  const map: Record<string, string> = { wait: "Tunggu" };
  for (const t of info.tasks) map[t.key] = t.label;
  return map;
}
