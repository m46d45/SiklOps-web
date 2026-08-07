import { useMemo, useState } from "react";
import { Play, RotateCcw } from "lucide-react";
import {
  applyBrickToConfig,
  brickDefaults,
  brickTheoreticalThroughput,
  type BrickConfigFields,
} from "@/lib/simkon/brickEngine";
import { defaultConfig, runSimulation, type SimulationResult } from "@/lib/simkon/engine";
import { ResultsPanel } from "@/components/simkon/ResultsPanel";
import { MetricCard } from "@/components/simkon/MetricCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatNum } from "@/lib/utils";

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

export function BricklayingPanel() {
  const [f, setF] = useState<BrickConfigFields>({ ...brickDefaults() });
  const [seed, setSeed] = useState(12345);
  const [targetVolume, setTargetVolume] = useState(10);
  const [targetCycles, setTargetCycles] = useState(200);
  const [costMason, setCostMason] = useState(75_000);
  const [costHelper, setCostHelper] = useState(50_000);
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
    setF({ ...brickDefaults() });
    setSeed(12345);
    setTargetVolume(10);
    setTargetCycles(200);
    setCostMason(75_000);
    setCostHelper(50_000);
    setResult(null);
  };

  return (
    <div className="space-y-6">
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Model bricklaying · batch + mortar</CardTitle>
          <CardDescription className="leading-relaxed">
            Helper angkat <strong className="text-foreground">1 batch = {f.batch_bricks} bata</strong> ke
            scaffold. Scaffold hanya{" "}
            <strong className="text-foreground">{f.scaffold_slots} slot</strong> (max{" "}
            {caps.scafMax} bata) — isi penuh 1 slot saja jika kosong. Temp ground{" "}
            <strong className="text-foreground">{f.temp_slots}×{f.batch_bricks} = {caps.tempMax} bata</strong>.
            Jika temp ≤ {f.temp_refill_threshold} bata → fetch ke pile jauh. Mortar: tim always-ready;
            scaffold max <strong className="text-foreground">{f.mortar_buckets_max} ember</strong> (1
            ember = {f.mortar_covers_bricks} bata).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <figure className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-muted/20">
            <img
              src="/illustrations/bricklaying-cycle.jpg"
              alt="Bricklaying: batch bricks + mortar buckets on scaffold"
              className="mx-auto max-h-64 w-full object-contain object-center p-2 sm:max-h-80"
            />
            <figcaption className="border-t border-border px-3 py-2 text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
              <strong className="text-foreground">A Fetch jauh</strong> → temp ·{" "}
              <strong className="text-foreground">B Lift</strong> batch bata + ember mortar ·{" "}
              <strong className="text-foreground">C Lay</strong> tukang. Slot bata & ember terbatas.
            </figcaption>
          </figure>

          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-[var(--radius-md)] border border-border bg-muted/20 p-3 text-xs leading-relaxed">
              <p className="font-medium text-foreground">A · Fetch (jauh)</p>
              <p className="mt-1 text-muted-foreground">
                Trigger bila temp ≤ threshold. Isi 1 batch ke temp (max {caps.tempMax}).
              </p>
            </div>
            <div className="rounded-[var(--radius-md)] border border-border bg-muted/20 p-3 text-xs leading-relaxed">
              <p className="font-medium text-foreground">B · Lift bata / mortar</p>
              <p className="mt-1 text-muted-foreground">
                Bata: 1 batch ke slot kosong (max {f.scaffold_slots}). Mortar: 1 ember (max{" "}
                {f.mortar_buckets_max}).
              </p>
            </div>
            <div className="rounded-[var(--radius-md)] border border-border bg-muted/20 p-3 text-xs leading-relaxed">
              <p className="font-medium text-foreground">C · Tukang lay</p>
              <p className="mt-1 text-muted-foreground">
                Butuh bata + mortar di scaffold. Output m² = bata / {f.bricks_per_m2}.
              </p>
            </div>
          </div>

          <div className="space-y-3 rounded-[var(--radius-lg)] border border-border bg-muted/15 p-3 sm:p-4">
            <p className="text-sm font-medium">Resource & kapasitas (bata / ember)</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Jumlah helper" value={f.num_helpers} min={1} max={20} onChange={(v) => patch({ num_helpers: Math.floor(v) })} />
              <Field label="Jumlah tukang" value={f.num_masons} min={1} max={12} onChange={(v) => patch({ num_masons: Math.floor(v) })} />
              <Field label="Batch angkat helper" unit="bata" value={f.batch_bricks} min={5} max={50} onChange={(v) => patch({ batch_bricks: Math.floor(v) })} />
              <Field label="Slot scaffold (bata)" value={f.scaffold_slots} min={1} max={8} onChange={(v) => patch({ scaffold_slots: Math.floor(v) })} />
              <Field label="Slot temp ground" value={f.temp_slots} min={1} max={30} onChange={(v) => patch({ temp_slots: Math.floor(v) })} />
              <Field label="Threshold fetch jauh" unit="bata sisa" value={f.temp_refill_threshold} min={0} max={500} onChange={(v) => patch({ temp_refill_threshold: Math.floor(v) })} />
              <Field label="Ember mortar scaffold" value={f.mortar_buckets_max} min={1} max={10} onChange={(v) => patch({ mortar_buckets_max: Math.floor(v) })} />
              <Field label="1 ember cukup untuk" unit="bata" value={f.mortar_covers_bricks} min={5} max={100} onChange={(v) => patch({ mortar_covers_bricks: Math.floor(v) })} />
              <Field label="Bata per m²" value={f.bricks_per_m2} min={20} max={120} onChange={(v) => patch({ bricks_per_m2: Math.floor(v) })} />
              <Field label="Bata / siklus tukang" value={f.lay_bricks_per_cycle} min={1} max={10} onChange={(v) => patch({ lay_bricks_per_cycle: Math.floor(v) })} />
              <Field label="Upah tukang" unit="ribu Rp/jam" value={costMason / 1000} min={0} max={500} step={5} onChange={(v) => setCostMason(v * 1000)} />
              <Field label="Upah helper" unit="ribu Rp/jam" value={costHelper / 1000} min={0} max={500} step={5} onChange={(v) => setCostHelper(v * 1000)} />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Max temp = {caps.tempMax} bata · Max scaffold = {caps.scafMax} bata · Mortar scaffold ≈{" "}
              {caps.mortarBricks} bata ekuivalen ({f.mortar_buckets_max} ember).
            </p>
          </div>

          <div className="space-y-3 rounded-[var(--radius-lg)] border border-border p-3 sm:p-4">
            <p className="text-sm font-medium">A · Fetch pile jauh (menit, fix mean)</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Travel jauh" value={f.far_travel_mean} min={0.2} max={30} step={0.1} onChange={(v) => patch({ far_travel_mean: v })} />
              <Field label="Load batch" value={f.far_load_mean} min={0.2} max={20} step={0.1} onChange={(v) => patch({ far_load_mean: v })} />
              <Field label="Return" value={f.far_return_mean} min={0.2} max={30} step={0.1} onChange={(v) => patch({ far_return_mean: v })} />
              <Field label="Unload temp" value={f.far_unload_mean} min={0.2} max={20} step={0.1} onChange={(v) => patch({ far_unload_mean: v })} />
            </div>
          </div>

          <div className="space-y-3 rounded-[var(--radius-lg)] border border-border p-3 sm:p-4">
            <p className="text-sm font-medium">B · Lift bata ke scaffold (menit)</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Ambil batch temp" value={f.lift_take_mean} min={0.1} max={20} step={0.1} onChange={(v) => patch({ lift_take_mean: v })} />
              <Field label="Naik scaffold" value={f.lift_climb_mean} min={0.2} max={30} step={0.1} onChange={(v) => patch({ lift_climb_mean: v })} />
              <Field label="Unload slot" value={f.lift_unload_mean} min={0.1} max={20} step={0.1} onChange={(v) => patch({ lift_unload_mean: v })} />
              <Field label="Turun / return" value={f.lift_return_mean} min={0.1} max={30} step={0.1} onChange={(v) => patch({ lift_return_mean: v })} />
            </div>
          </div>

          <div className="space-y-3 rounded-[var(--radius-lg)] border border-border p-3 sm:p-4">
            <p className="text-sm font-medium">B′ · Supply mortar (tim mortar always-ready)</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Ambil ember" value={f.mortar_take_mean} min={0.1} max={20} step={0.1} onChange={(v) => patch({ mortar_take_mean: v })} />
              <Field label="Naik scaffold" value={f.mortar_climb_mean} min={0.2} max={30} step={0.1} onChange={(v) => patch({ mortar_climb_mean: v })} />
              <Field label="Taruh ember" value={f.mortar_place_mean} min={0.1} max={20} step={0.1} onChange={(v) => patch({ mortar_place_mean: v })} />
              <Field label="Return" value={f.mortar_return_mean} min={0.1} max={30} step={0.1} onChange={(v) => patch({ mortar_return_mean: v })} />
            </div>
          </div>

          <div className="space-y-3 rounded-[var(--radius-lg)] border border-border p-3 sm:p-4">
            <p className="text-sm font-medium">C · Tukang pasang (menit)</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Ambil bata+mortar" value={f.lay_take_mean} min={0.05} max={10} step={0.05} onChange={(v) => patch({ lay_take_mean: v })} />
              <Field label="Pasang" value={f.lay_place_mean} min={0.1} max={20} step={0.05} onChange={(v) => patch({ lay_place_mean: v })} />
              <Field label="Finish" value={f.lay_finish_mean} min={0.05} max={10} step={0.05} onChange={(v) => patch({ lay_finish_mean: v })} />
              <Field label="Seed" value={seed} min={1} step={1} onChange={(v) => setSeed(Math.floor(v))} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Target dinding" unit="m²" value={targetVolume} min={1} max={500} onChange={setTargetVolume} />
            <Field label="Target siklus tukang" value={targetCycles} min={1} max={5000} onChange={(v) => setTargetCycles(Math.floor(v))} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <MetricCard label="Teori fetch" value={`${formatNum(theory.fetch, 1)} m²/jam`} hint="Helper share → pile jauh" />
            <MetricCard label="Teori lift bata" value={`${formatNum(theory.lift, 1)} m²/jam`} hint="Batch ke slot scaffold" />
            <MetricCard label="Teori mortar" value={`${formatNum(theory.mortar, 1)} m²/jam`} hint="Ember ke scaffold" />
            <MetricCard label="Teori tukang" value={`${formatNum(theory.lay, 1)} m²/jam`} hint="Kapasitas pasang" />
            <MetricCard label="Teori sistem" value={`${formatNum(theory.system, 1)} m²/jam`} hint="min semua rantai" />
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
            Atur batch, slot, threshold, ember mortar, lalu{" "}
            <strong className="text-foreground">Jalankan simulasi</strong>.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
