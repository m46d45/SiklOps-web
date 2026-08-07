import { useMemo, useState } from "react";
import { Play, RotateCcw } from "lucide-react";
import {
  applyBrickToConfig,
  brickDefaults,
  brickTheoreticalThroughput,
  type BrickConfigFields,
} from "@/lib/simkon/brickEngine";
import {
  DIST_LABELS,
  defaultConfig,
  fromMeanCv,
  runSimulation,
  type DistKind,
  type DurationDist,
  type SimulationResult,
} from "@/lib/simkon/engine";
import { ResultsPanel } from "@/components/simkon/ResultsPanel";
import { MetricCard } from "@/components/simkon/MetricCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatNum } from "@/lib/utils";

const DIST_KEYS = Object.keys(DIST_LABELS) as DistKind[];
const DEFAULT_CV = 0.2;
const DEFAULT_KIND: DistKind = "normal";

type MeanKey = keyof BrickConfigFields;
type DistFieldKey =
  | "far_travel_dist"
  | "far_load_dist"
  | "far_return_dist"
  | "far_unload_dist"
  | "lift_take_dist"
  | "lift_climb_dist"
  | "lift_unload_dist"
  | "lift_return_dist"
  | "mortar_take_dist"
  | "mortar_climb_dist"
  | "mortar_place_dist"
  | "mortar_return_dist"
  | "lay_take_dist"
  | "lay_place_dist"
  | "lay_finish_dist";

type TaskDef = {
  label: string;
  meanKey: MeanKey;
  distKey: DistFieldKey;
  maxMean: number;
};

const FETCH_TASKS: TaskDef[] = [
  { label: "Travel ke pile jauh", meanKey: "far_travel_mean", distKey: "far_travel_dist", maxMean: 30 },
  { label: "Load batch bata", meanKey: "far_load_mean", distKey: "far_load_dist", maxMean: 20 },
  { label: "Return ke temp", meanKey: "far_return_mean", distKey: "far_return_dist", maxMean: 30 },
  { label: "Unload ke temp", meanKey: "far_unload_mean", distKey: "far_unload_dist", maxMean: 20 },
];

const LIFT_TASKS: TaskDef[] = [
  { label: "Ambil batch di temp", meanKey: "lift_take_mean", distKey: "lift_take_dist", maxMean: 15 },
  { label: "Naik scaffold", meanKey: "lift_climb_mean", distKey: "lift_climb_dist", maxMean: 30 },
  { label: "Unload slot scaffold", meanKey: "lift_unload_mean", distKey: "lift_unload_dist", maxMean: 15 },
  { label: "Turun / return", meanKey: "lift_return_mean", distKey: "lift_return_dist", maxMean: 30 },
];

const MORTAR_TASKS: TaskDef[] = [
  { label: "Ambil ember mortar", meanKey: "mortar_take_mean", distKey: "mortar_take_dist", maxMean: 15 },
  { label: "Naik scaffold", meanKey: "mortar_climb_mean", distKey: "mortar_climb_dist", maxMean: 30 },
  { label: "Taruh ember", meanKey: "mortar_place_mean", distKey: "mortar_place_dist", maxMean: 15 },
  { label: "Return", meanKey: "mortar_return_mean", distKey: "mortar_return_dist", maxMean: 30 },
];

const LAY_TASKS: TaskDef[] = [
  { label: "Ambil bata + mortar", meanKey: "lay_take_mean", distKey: "lay_take_dist", maxMean: 10 },
  { label: "Pasang bata", meanKey: "lay_place_mean", distKey: "lay_place_dist", maxMean: 20 },
  { label: "Finish / rapikan", meanKey: "lay_finish_mean", distKey: "lay_finish_dist", maxMean: 10 },
];

function rebuildDist(base: DurationDist, kind: DistKind, cv: number): DurationDist {
  if (kind === "constant") return { ...base, kind: "constant", mean: base.mean, cv: 0 };
  if (kind === "beta") {
    return {
      ...base,
      kind: "beta",
      mean: base.mean,
      cv,
      alpha: base.alpha ?? 2,
      beta_shape: base.beta_shape ?? 2,
      min_bound: base.min_bound ?? Math.max(0.05, base.mean * 0.5),
      max_bound: base.max_bound ?? base.mean * 1.5,
    };
  }
  return fromMeanCv(base.mean, cv, kind);
}

function ensureDist(
  f: BrickConfigFields,
  distKey: DistFieldKey,
  mean: number,
): DurationDist {
  const existing = f[distKey] as DurationDist | null | undefined;
  if (existing) return { ...existing, mean };
  return fromMeanCv(mean, DEFAULT_CV, DEFAULT_KIND);
}

function withDefaultDists(base: BrickConfigFields): BrickConfigFields {
  const all = [...FETCH_TASKS, ...LIFT_TASKS, ...MORTAR_TASKS, ...LAY_TASKS];
  const next = { ...base };
  for (const t of all) {
    const mean = Number(next[t.meanKey]) || 0.1;
    if (!next[t.distKey]) {
      (next as Record<string, unknown>)[t.distKey] = fromMeanCv(
        mean,
        DEFAULT_CV,
        DEFAULT_KIND,
      );
    }
  }
  return next;
}

function Field({
  label,
  unit,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  unit?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">
        {label}
        {unit ? ` (${unit})` : ""}
      </Label>
      <Input
        type="number"
        className="h-9 tabular-nums"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isFinite(n)) return;
          let v = n;
          if (min != null) v = Math.max(min, v);
          if (max != null) v = Math.min(max, v);
          onChange(v);
        }}
      />
    </div>
  );
}

function TaskBlock({
  title,
  subtitle,
  tasks,
  f,
  onPatch,
}: {
  title: string;
  subtitle: string;
  tasks: TaskDef[];
  f: BrickConfigFields;
  onPatch: (p: Partial<BrickConfigFields>) => void;
}) {
  return (
    <div className="space-y-3 rounded-[var(--radius-lg)] border border-border p-3 sm:p-4">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-[11px] text-muted-foreground">{subtitle}</p>
      </div>
      <div className="space-y-4">
        {tasks.map((task) => {
          const mean = Number(f[task.meanKey]) || 0.1;
          const dist = ensureDist(f, task.distKey, mean);
          return (
            <div
              key={task.distKey}
              className="grid gap-3 rounded-[var(--radius-md)] border border-border/70 bg-muted/10 p-3 sm:grid-cols-2 lg:grid-cols-4"
            >
              <div className="sm:col-span-2 lg:col-span-4">
                <p className="text-xs font-medium text-foreground">{task.label}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Mean (menit)</Label>
                <Input
                  type="number"
                  className="h-9 tabular-nums"
                  min={0.05}
                  max={task.maxMean}
                  step={0.05}
                  value={mean}
                  onChange={(e) => {
                    const m = Math.max(0.05, Number(e.target.value) || 0.05);
                    const d = ensureDist(f, task.distKey, m);
                    onPatch({
                      [task.meanKey]: m,
                      [task.distKey]: rebuildDist({ ...d, mean: m }, d.kind, d.cv),
                    } as Partial<BrickConfigFields>);
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Distribusi</Label>
                <Select
                  value={dist.kind}
                  onValueChange={(kind) => {
                    const k = kind as DistKind;
                    const cv = k === "constant" ? 0 : dist.cv > 0 ? dist.cv : DEFAULT_CV;
                    onPatch({
                      [task.distKey]: rebuildDist({ ...dist, mean, kind: k, cv }, k, cv),
                    } as Partial<BrickConfigFields>);
                  }}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIST_KEYS.map((k) => (
                      <SelectItem key={k} value={k}>
                        {DIST_LABELS[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {dist.kind !== "constant" && dist.kind !== "beta" ? (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs text-muted-foreground">
                    CV (std/mean) · {dist.cv.toFixed(2)}
                  </Label>
                  <Slider
                    min={0}
                    max={1}
                    step={0.01}
                    value={[dist.cv]}
                    onValueChange={([cv]) => {
                      onPatch({
                        [task.distKey]: rebuildDist({ ...dist, mean, cv }, dist.kind, cv),
                      } as Partial<BrickConfigFields>);
                    }}
                  />
                </div>
              ) : null}
              {dist.kind === "beta" ? (
                <>
                  <Field
                    label="Min bound"
                    value={dist.min_bound ?? mean * 0.5}
                    min={0.05}
                    max={(dist.max_bound ?? mean * 1.5) - 0.05}
                    step={0.05}
                    onChange={(v) =>
                      onPatch({
                        [task.distKey]: { ...dist, mean, kind: "beta", min_bound: v },
                      } as Partial<BrickConfigFields>)
                    }
                  />
                  <Field
                    label="Max bound"
                    value={dist.max_bound ?? mean * 1.5}
                    min={(dist.min_bound ?? mean * 0.5) + 0.05}
                    max={task.maxMean * 2}
                    step={0.05}
                    onChange={(v) =>
                      onPatch({
                        [task.distKey]: { ...dist, mean, kind: "beta", max_bound: v },
                      } as Partial<BrickConfigFields>)
                    }
                  />
                </>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function BricklayingPanel() {
  const [f, setF] = useState<BrickConfigFields>(() => withDefaultDists(brickDefaults()));
  const [seed, setSeed] = useState(12345);
  const [targetVolume, setTargetVolume] = useState(10);
  const [targetCycles, setTargetCycles] = useState(200);
  const [costMason, setCostMason] = useState(25_000);
  const [costHelper, setCostHelper] = useState(18_000);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);

  const patch = (p: Partial<BrickConfigFields>) => setF((prev) => ({ ...prev, ...p }));

  const caps = useMemo(() => {
    const batch = f.batch_bricks;
    return {
      tempMax: f.temp_slots * batch,
      scafMax: f.scaffold_slots * batch,
      mortarBricks: f.mortar_buckets_max * f.mortar_covers_bricks,
    };
  }, [f]);

  const theory = useMemo(() => {
    const base = applyBrickToConfig(defaultConfig("bricklaying"), f);
    return brickTheoreticalThroughput(base);
  }, [f]);

  const run = () => {
    setRunning(true);
    requestAnimationFrame(() => {
      try {
        const base = defaultConfig("bricklaying");
        const cfg = applyBrickToConfig(
          {
            ...base,
            seed,
            target_volume: targetVolume,
            target_cycles: targetCycles,
            stop_mode: "either",
            cost_loader_per_hour: costMason,
            cost_hauler_per_hour: costHelper,
            cost_all_in: true,
          },
          f,
        );
        setResult(runSimulation(cfg));
      } finally {
        setRunning(false);
      }
    });
  };

  const reset = () => {
    setF(withDefaultDists(brickDefaults()));
    setSeed(12345);
    setTargetVolume(10);
    setTargetCycles(200);
    setCostMason(25_000);
    setCostHelper(18_000);
    setResult(null);
  };

  return (
    <div className="space-y-6">
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Bricklaying · resource, tugas & distribusi</CardTitle>
          <CardDescription className="leading-relaxed">
            Default: <strong className="text-foreground">1 helper</strong>,{" "}
            <strong className="text-foreground">2 tukang</strong>, scaffold{" "}
            <strong className="text-foreground">{f.scaffold_slots} slot bata</strong> +{" "}
            <strong className="text-foreground">{f.mortar_buckets_max} ember mortar</strong>.
            Setiap tugas: mean (menit) + distribusi (seperti earthmoving).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <figure className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-muted/20">
            <img
              src="/illustrations/bricklaying-cycle.jpg"
              alt="Bricklaying batch + mortar"
              className="mx-auto max-h-64 w-full object-contain object-center p-2 sm:max-h-80"
            />
            <figcaption className="border-t border-border px-3 py-2 text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
              A Fetch jauh · B Lift bata / mortar · C Tukang lay. Slot & ember terbatas.
            </figcaption>
          </figure>

          <div className="space-y-3 rounded-[var(--radius-lg)] border border-border bg-muted/15 p-3 sm:p-4">
            <p className="text-sm font-medium">Resources & kapasitas</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field
                label="Helper"
                value={f.num_helpers}
                min={1}
                max={20}
                onChange={(v) => patch({ num_helpers: Math.floor(v) })}
              />
              <Field
                label="Tukang"
                value={f.num_masons}
                min={1}
                max={12}
                onChange={(v) => patch({ num_masons: Math.floor(v) })}
              />
              <Field
                label="Batch angkat helper"
                unit="bata"
                value={f.batch_bricks}
                min={5}
                max={50}
                onChange={(v) => patch({ batch_bricks: Math.floor(v) })}
              />
              <Field
                label="Space bata scaffold"
                unit="slot"
                value={f.scaffold_slots}
                min={1}
                max={8}
                onChange={(v) => patch({ scaffold_slots: Math.floor(v) })}
              />
              <Field
                label="Space ember mortar scaffold"
                unit="ember"
                value={f.mortar_buckets_max}
                min={1}
                max={10}
                onChange={(v) => patch({ mortar_buckets_max: Math.floor(v) })}
              />
              <Field
                label="Slot temp ground"
                value={f.temp_slots}
                min={1}
                max={30}
                onChange={(v) => patch({ temp_slots: Math.floor(v) })}
              />
              <Field
                label="Threshold fetch jauh"
                unit="bata sisa"
                value={f.temp_refill_threshold}
                min={0}
                max={500}
                onChange={(v) => patch({ temp_refill_threshold: Math.floor(v) })}
              />
              <Field
                label="1 ember = "
                unit="bata"
                value={f.mortar_covers_bricks}
                min={5}
                max={100}
                onChange={(v) => patch({ mortar_covers_bricks: Math.floor(v) })}
              />
              <Field
                label="Bata per m²"
                value={f.bricks_per_m2}
                min={20}
                max={120}
                onChange={(v) => patch({ bricks_per_m2: Math.floor(v) })}
              />
              <Field
                label="Bata / siklus tukang"
                value={f.lay_bricks_per_cycle}
                min={1}
                max={10}
                onChange={(v) => patch({ lay_bricks_per_cycle: Math.floor(v) })}
              />
              <Field
                label="Upah tukang"
                unit="ribu Rp/jam"
                value={costMason / 1000}
                min={0}
                max={500}
                step={5}
                onChange={(v) => setCostMason(v * 1000)}
              />
              <Field
                label="Upah helper"
                unit="ribu Rp/jam"
                value={costHelper / 1000}
                min={0}
                max={500}
                step={5}
                onChange={(v) => setCostHelper(v * 1000)}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Max temp {caps.tempMax} bata · Max scaffold {caps.scafMax} bata · Mortar scaffold ≈{" "}
              {caps.mortarBricks} bata ekuivalen. Upah default (2026, mid-ID): tukang ≈ Rp 200 rb/hari · helper ≈ Rp 144 rb/hari (÷8 jam).
            </p>
          </div>

          <TaskBlock
            title="Tugas A · Helper fetch (pile jauh)"
            subtitle="Trigger bila temp ≤ threshold. Mean + distribusi per fase."
            tasks={FETCH_TASKS}
            f={f}
            onPatch={patch}
          />
          <TaskBlock
            title="Tugas B · Helper lift bata ke scaffold"
            subtitle="1 trip = 1 batch; hanya jika ada slot kosong di scaffold."
            tasks={LIFT_TASKS}
            f={f}
            onPatch={patch}
          />
          <TaskBlock
            title="Tugas B′ · Helper supply mortar"
            subtitle="Tim mortar always-ready di ground. Scaffold max 3 ember."
            tasks={MORTAR_TASKS}
            f={f}
            onPatch={patch}
          />
          <TaskBlock
            title="Tugas C · Tukang pasang"
            subtitle="Butuh bata + mortar di scaffold."
            tasks={LAY_TASKS}
            f={f}
            onPatch={patch}
          />

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field
              label="Target dinding"
              unit="m²"
              value={targetVolume}
              min={1}
              max={500}
              onChange={setTargetVolume}
            />
            <Field
              label="Target siklus tukang"
              value={targetCycles}
              min={1}
              max={5000}
              onChange={(v) => setTargetCycles(Math.floor(v))}
            />
            <Field
              label="Seed"
              value={seed}
              min={1}
              step={1}
              onChange={(v) => setSeed(Math.floor(v))}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <MetricCard label="Teori fetch" value={`${formatNum(theory.fetch, 1)} m²/jam`} />
            <MetricCard label="Teori lift" value={`${formatNum(theory.lift, 1)} m²/jam`} />
            <MetricCard label="Teori mortar" value={`${formatNum(theory.mortar, 1)} m²/jam`} />
            <MetricCard label="Teori tukang" value={`${formatNum(theory.lay, 1)} m²/jam`} />
            <MetricCard label="Teori sistem" value={`${formatNum(theory.system, 1)} m²/jam`} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={run} disabled={running}>
              <Play className="mr-1.5 h-4 w-4" />
              {running ? "Menghitung…" : "Jalankan simulasi"}
            </Button>
            <Button type="button" variant="outline" onClick={reset}>
              <RotateCcw className="mr-1.5 h-4 w-4" />
              Reset default
            </Button>
          </div>
        </CardContent>
      </Card>

      {result ? (
        <ResultsPanel result={result} />
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Atur resource & tugas (mean + distribusi), lalu{" "}
            <strong className="text-foreground">Jalankan simulasi</strong>.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
