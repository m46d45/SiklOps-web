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

const D = brickDefaults();

export function BricklayingPanel() {
  const [f, setF] = useState<BrickConfigFields>({ ...D });
  const [seed, setSeed] = useState(12345);
  const [targetVolume, setTargetVolume] = useState(20);
  const [targetCycles, setTargetCycles] = useState(60);
  const [costMason, setCostMason] = useState(75_000);
  const [costHelper, setCostHelper] = useState(50_000);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);

  const patch = (p: Partial<BrickConfigFields>) => setF((prev) => ({ ...prev, ...p }));

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
    setTargetVolume(20);
    setTargetCycles(60);
    setCostMason(75_000);
    setCostHelper(50_000);
    setResult(null);
  };

  return (
    <div className="space-y-6">
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Model triple-cycle bricklaying</CardTitle>
          <CardDescription className="leading-relaxed">
            <strong className="text-foreground">Cycle A</strong> — Helper fetch: ambil bata dari
            pile → temp stock (buffer ground, kapasitas terbatas).{" "}
            <strong className="text-foreground">Cycle B</strong> — Helper lift: temp → scaffold
            stock (space terbatas).{" "}
            <strong className="text-foreground">Cycle C</strong> — Tukang pasang dari scaffold.
            Helper adalah <em>satu pool</em> yang mengerjakan A dan B (prioritas jaga scaffold
            terisi).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <figure className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-muted/20">
            <img
              src="/illustrations/bricklaying-cycle.jpg"
              alt="Bricklaying triple-cycle: helper fetch, helper lift, tukang lay"
              className="mx-auto max-h-64 w-full object-contain object-center p-2 sm:max-h-80"
            />
            <figcaption className="border-t border-border px-3 py-2 text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
              <strong className="text-foreground">A Fetch</strong> bata + mortar → stock terbatas ·{" "}
              <strong className="text-foreground">B Lift</strong> naik scaffold ·{" "}
              <strong className="text-foreground">C Lay</strong> tukang pasang. Mortar box & scaffold stock terbatas.
            </figcaption>
          </figure>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-[var(--radius-md)] border border-border bg-muted/20 p-3 text-xs leading-relaxed">
              <p className="font-medium text-foreground">A · Helper fetch</p>
              <p className="mt-1 text-muted-foreground">
                Travel → load pile → haul ke temp → unload → return
              </p>
            </div>
            <div className="rounded-[var(--radius-md)] border border-border bg-muted/20 p-3 text-xs leading-relaxed">
              <p className="font-medium text-foreground">B · Helper lift</p>
              <p className="mt-1 text-muted-foreground">
                Take temp → climb scaffolding → unload scaffold → return
              </p>
            </div>
            <div className="rounded-[var(--radius-md)] border border-border bg-muted/20 p-3 text-xs leading-relaxed">
              <p className="font-medium text-foreground">C · Tukang lay</p>
              <p className="mt-1 text-muted-foreground">
                Take scaffold → pasang bata → finish → ulang
              </p>
            </div>
          </div>

          <div className="space-y-3 rounded-[var(--radius-lg)] border border-border bg-muted/15 p-3 sm:p-4">
            <p className="text-sm font-medium">Resource & buffer</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field
                label="Jumlah helper"
                value={f.num_helpers}
                min={1}
                max={20}
                step={1}
                onChange={(v) => patch({ num_helpers: Math.floor(v) })}
              />
              <Field
                label="Jumlah tukang"
                value={f.num_masons}
                min={1}
                max={12}
                step={1}
                onChange={(v) => patch({ num_masons: Math.floor(v) })}
              />
              <Field
                label="Temp stock (ground)"
                unit="m² eq."
                value={f.temp_buffer_m2}
                min={0.3}
                max={20}
                step={0.1}
                onChange={(v) => patch({ temp_buffer_m2: v })}
              />
              <Field
                label="Scaffold stock (space)"
                unit="m² eq."
                value={f.scaffold_buffer_m2}
                min={0.2}
                max={6}
                step={0.1}
                onChange={(v) => patch({ scaffold_buffer_m2: v })}
              />
              <Field
                label="Muatan fetch / trip"
                unit="m²"
                value={f.fetch_payload_m2}
                min={0.1}
                max={2}
                step={0.05}
                onChange={(v) => patch({ fetch_payload_m2: v })}
              />
              <Field
                label="Muatan lift / trip"
                unit="m²"
                value={f.lift_payload_m2}
                min={0.1}
                max={1.5}
                step={0.05}
                onChange={(v) => patch({ lift_payload_m2: v })}
              />
              <Field
                label="Output pasang / siklus"
                unit="m²"
                value={f.lay_payload_m2}
                min={0.05}
                max={1}
                step={0.05}
                onChange={(v) => patch({ lay_payload_m2: v })}
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
          </div>

          <div className="space-y-3 rounded-[var(--radius-lg)] border border-border p-3 sm:p-4">
            <p className="text-sm font-medium">Cycle A · Helper fetch (menit)</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Travel ke pile" value={f.fetch_travel_mean} min={0.2} max={20} step={0.1} onChange={(v) => patch({ fetch_travel_mean: v })} />
              <Field label="Load bata" value={f.fetch_load_mean} min={0.2} max={20} step={0.1} onChange={(v) => patch({ fetch_load_mean: v })} />
              <Field label="Unload ke temp" value={f.fetch_unload_mean} min={0.2} max={20} step={0.1} onChange={(v) => patch({ fetch_unload_mean: v })} />
              <Field label="Return" value={f.fetch_return_mean} min={0.2} max={20} step={0.1} onChange={(v) => patch({ fetch_return_mean: v })} />
            </div>
          </div>

          <div className="space-y-3 rounded-[var(--radius-lg)] border border-border p-3 sm:p-4">
            <p className="text-sm font-medium">Cycle B · Helper lift ke scaffold (menit)</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Ambil dari temp" value={f.lift_take_mean} min={0.2} max={20} step={0.1} onChange={(v) => patch({ lift_take_mean: v })} />
              <Field label="Naik / carry" value={f.lift_climb_mean} min={0.2} max={30} step={0.1} onChange={(v) => patch({ lift_climb_mean: v })} />
              <Field label="Unload scaffold" value={f.lift_unload_mean} min={0.2} max={20} step={0.1} onChange={(v) => patch({ lift_unload_mean: v })} />
              <Field label="Turun / return" value={f.lift_return_mean} min={0.2} max={30} step={0.1} onChange={(v) => patch({ lift_return_mean: v })} />
            </div>
          </div>

          <div className="space-y-3 rounded-[var(--radius-lg)] border border-border p-3 sm:p-4">
            <p className="text-sm font-medium">Cycle C · Tukang pasang (menit)</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Ambil dari scaffold" value={f.lay_take_mean} min={0.1} max={10} step={0.1} onChange={(v) => patch({ lay_take_mean: v })} />
              <Field label="Pasang bata" value={f.lay_place_mean} min={0.2} max={30} step={0.1} onChange={(v) => patch({ lay_place_mean: v })} />
              <Field label="Finish / cek" value={f.lay_finish_mean} min={0.1} max={10} step={0.1} onChange={(v) => patch({ lay_finish_mean: v })} />
              <Field label="Seed" value={seed} min={1} step={1} onChange={(v) => setSeed(Math.floor(v))} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Target dinding" unit="m²" value={targetVolume} min={1} max={500} step={1} onChange={setTargetVolume} />
            <Field label="Target siklus tukang" value={targetCycles} min={1} max={500} step={1} onChange={(v) => setTargetCycles(Math.floor(v))} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Teori fetch (½ helper)" value={`${formatNum(theory.fetch, 1)} m²/jam`} hint="Aprox helpers split A/B" />
            <MetricCard label="Teori lift (½ helper)" value={`${formatNum(theory.lift, 1)} m²/jam`} hint="Supply ke scaffold" />
            <MetricCard label="Teori tukang" value={`${formatNum(theory.lay, 1)} m²/jam`} hint="Kapasitas pasang" />
            <MetricCard label="Teori sistem" value={`${formatNum(theory.system, 1)} m²/jam`} hint="min(fetch, lift, lay)" />
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
            Atur resource, buffer, dan cycle time lalu tekan{" "}
            <strong className="text-foreground">Jalankan simulasi</strong>.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
