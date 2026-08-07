/**
 * Kontrak operasi SiklOps — template standar untuk semua operasi.
 * Earthmoving · Bricklaying · Concreting (3 metode place) memakai interface yang sama.
 */

export type OperationId = "earthmoving" | "bricklaying" | "concreting";

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
      "Siklus pasangan bata: helper menyiapkan material, tukang memasang, sambungan/isi nat, cek mutu — diulang sepanjang area dinding.",
    tasks: [
      { key: "load", label: "Siap material" },
      { key: "haul", label: "Pasang" },
      { key: "dump", label: "Sambung" },
      { key: "return", label: "Cek" },
    ],
    taskLabels: ["Siap material", "Pasang", "Sambung", "Cek"],
    loaderLabel: "Tukang",
    haulerLabel: "Helper",
    loaderCapacityLabel: "Output per siklus tukang",
    haulerCapacityLabel: "Supply helper per siklus",
    unit: "m²",
    durationUnit: "menit",
    sinceVersion: "1.1",
    available: true,
    defaults: {
      num_loaders: 2,
      num_haulers: 2,
      loader_bucket: 0.5,
      hauler_capacity: 0.5,
      load: 1.5,
      haul: 4,
      dump: 1,
      return: 0.5,
      target_cycles: 40,
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
        "Model 2 resource: tukang (server) dan helper (supply). Antrian = helper menunggu tukang siap memuat material/pasang.",
      howTo: [
        "Jumlah tukang = server utama; helper mensuplai material ke titik pasang.",
        "Cycle: siap material → pasang → sambung → cek (menit).",
        "Target volume dalam m² dinding.",
        "Bandingkan rasio tukang:helper di tab Perbandingan.",
      ],
      notes:
        "Tanpa solar (EF 0). Biaya = upah per jam. Payload = m² per siklus selesai.",
    },
    illustration: "/illustrations/bricklaying-cycle.jpg",
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
