import { useMemo, useState } from "react";
import { Play, RotateCcw } from "lucide-react";
import {
  applyTowerCraneToConfig,
  defaultFronts,
  towerCraneDefaults,
  towerCraneTheory,
  type CraneFront,
  type TowerCraneFields,
  runTowerCraneSimulation,
} from "@/lib/simkon/towerCraneEngine";
import { defaultConfig, type SimulationResult } from "@/lib/simkon/engine";
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

type ResultExtra = SimulationResult & {
  front_stats?: Array<{
    id: number;
    name: string;
    priority: number;
    lifts: number;
    volume: number;
    wait_avg: number;
    wait_total: number;
  }>;
};

export function TowerCranePanel() {
  const [fields, setFields] = useState<TowerCraneFields>(towerCraneDefaults());
  const [seed, setSeed] = useState(12345);
  const [targetVolume, setTargetVolume] = useState(40);
  const [targetCycles, setTargetCycles] = useState(50);
  const [costCrane, setCostCrane] = useState(500_000);
  const [costOp, setCostOp] = useState(150_000);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ResultExtra | null>(null);

  const patchFront = (id: number, p: Partial<CraneFront>) => {
    setFields((prev) => ({
      ...prev,
      fronts: prev.fronts.map((f) => (f.id === id ? { ...f, ...p } : f)),
    }));
  };

  const theory = useMemo(() => towerCraneTheory(fields), [fields]);

  const run = () => {
    setRunning(true);
    requestAnimationFrame(() => {
      try {
        const base = defaultConfig("tower_crane");
        const cfg = applyTowerCraneToConfig(
          {
            ...base,
            seed,
            target_volume: targetVolume,
            target_cycles: targetCycles,
            stop_mode: "either",
            cost_loader_per_hour: costCrane,
            cost_loader_operator_per_hour: costOp,
            cost_all_in: true,
          },
          fields,
        );
        setResult(runTowerCraneSimulation(cfg));
      } finally {
        setRunning(false);
      }
    });
  };

  const reset = () => {
    setFields(towerCraneDefaults());
    setSeed(12345);
    setTargetVolume(40);
    setTargetCycles(50);
    setCostCrane(500_000);
    setCostOp(150_000);
    setResult(null);
  };

  return (
    <div className="space-y-6">
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Tower crane · multi-front + prioritas</CardTitle>
          <CardDescription className="leading-relaxed">
            Crane = <strong className="text-foreground">single server</strong>. Setiap front
            meminta lift material dari yard. Antrian diurut{" "}
            <strong className="text-foreground">prioritas 1 (tinggi) → 9 (rendah)</strong>, lalu
            FIFO. Beban melebihi kapasitas angkat ditolak. Lihat util crane dan wait per front —
            apakah crane bottleneck pekerjaan lain.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <figure className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-muted/20">
            <img
              src="/illustrations/tower-crane-multi-front.jpg"
              alt="Tower crane multi-front priority: yard to fronts via single server"
              className="mx-auto max-h-64 w-full object-contain object-center p-2 sm:max-h-80"
            />
            <figcaption className="border-t border-border px-3 py-2 text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
              <strong className="text-foreground">Yard</strong> →{" "}
              <strong className="text-foreground">Tower crane (server)</strong> → Front
              A/B/C. Antrian prioritas 1 dulu, lalu FIFO. Lift: hook→hoist→swing→lower→unhook→return
              empty.
            </figcaption>
          </figure>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field
              label="Jumlah tower crane"
              value={fields.num_cranes}
              min={1}
              max={2}
              step={1}
              onChange={(v) =>
                setFields((p) => ({ ...p, num_cranes: Math.floor(v) as 1 | 2 }))
              }
            />
            <Field
              label="Kapasitas angkat"
              unit="ton"
              value={fields.capacity_ton}
              min={0.5}
              max={20}
              step={0.5}
              onChange={(v) => setFields((p) => ({ ...p, capacity_ton: v }))}
            />
            <Field
              label="Faktor beban berat"
              value={fields.heavy_load_factor}
              min={1}
              max={1.5}
              step={0.05}
              onChange={(v) => setFields((p) => ({ ...p, heavy_load_factor: v }))}
            />
            <Field
              label="Sewa crane"
              unit="ribu Rp/jam"
              value={costCrane / 1000}
              min={0}
              max={5000}
              step={10}
              onChange={(v) => setCostCrane(v * 1000)}
            />
            <Field
              label="Operator crane"
              unit="ribu Rp/jam"
              value={costOp / 1000}
              min={0}
              max={1000}
              step={5}
              onChange={(v) => setCostOp(v * 1000)}
            />
            <Field label="Seed" value={seed} min={1} step={1} onChange={(v) => setSeed(Math.floor(v))} />
            <Field
              label="Target volume"
              unit="unit"
              value={targetVolume}
              min={1}
              max={500}
              step={1}
              onChange={setTargetVolume}
            />
            <Field
              label="Target lift (siklus)"
              value={targetCycles}
              min={1}
              max={500}
              step={1}
              onChange={(v) => setTargetCycles(Math.floor(v))}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Demand front (teori)"
              value={`${formatNum(theory.demand, 1)} unit/jam`}
              hint="Σ frekuensi minta × volume"
            />
            <MetricCard
              label="Kapasitas crane (teori)"
              value={`${formatNum(theory.crane_cap, 1)} unit/jam`}
              hint="Tanpa antrian / prioritas"
            />
            <MetricCard
              label="Util teori demand/cap"
              value={`${formatNum(theory.util_theory * 100, 0)}%`}
              hint=">100% = crane overload teori"
            />
            <MetricCard
              label="Front aktif"
              value={`${fields.fronts.filter((x) => x.enabled).length} / 5`}
              hint="Prioritas 1 = paling penting"
            />
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium">Work fronts (max 5)</p>
            {fields.fronts.map((fr) => (
              <div
                key={fr.id}
                className={`space-y-3 rounded-[var(--radius-lg)] border p-3 sm:p-4 ${
                  fr.enabled ? "border-border bg-card/40" : "border-border/60 bg-muted/20 opacity-70"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[var(--color-primary)]"
                        checked={fr.enabled}
                        onChange={(e) => patchFront(fr.id, { enabled: e.target.checked })}
                      />
                      {fr.name}
                    </label>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Prioritas {fr.priority} · {fr.payload_ton} t
                    {fr.payload_ton > fields.capacity_ton ? " · OVERLOAD" : ""}
                  </span>
                </div>
                {fr.enabled ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Field
                      label="Prioritas (1=tinggi)"
                      value={fr.priority}
                      min={1}
                      max={9}
                      step={1}
                      onChange={(v) => patchFront(fr.id, { priority: Math.floor(v) })}
                    />
                    <Field
                      label="Volume / lift"
                      unit="unit"
                      value={fr.volume_per_lift}
                      min={0.1}
                      max={10}
                      step={0.1}
                      onChange={(v) => patchFront(fr.id, { volume_per_lift: v })}
                    />
                    <Field
                      label="Beban"
                      unit="ton"
                      value={fr.payload_ton}
                      min={0.1}
                      max={20}
                      step={0.1}
                      onChange={(v) => patchFront(fr.id, { payload_ton: v })}
                    />
                    <Field
                      label="Local work antar-lift"
                      unit="mnt"
                      value={fr.local_work_mean}
                      min={0.5}
                      max={60}
                      step={0.5}
                      onChange={(v) => patchFront(fr.id, { local_work_mean: v })}
                    />
                    <Field
                      label="Hook / sling"
                      unit="mnt"
                      value={fr.hook_mean}
                      min={0.2}
                      max={20}
                      step={0.1}
                      onChange={(v) => patchFront(fr.id, { hook_mean: v })}
                    />
                    <Field
                      label="Hoist"
                      unit="mnt"
                      value={fr.hoist_mean}
                      min={0.2}
                      max={20}
                      step={0.1}
                      onChange={(v) => patchFront(fr.id, { hoist_mean: v })}
                    />
                    <Field
                      label="Swing / trolley"
                      unit="mnt"
                      value={fr.swing_mean}
                      min={0.2}
                      max={20}
                      step={0.1}
                      onChange={(v) => patchFront(fr.id, { swing_mean: v })}
                    />
                    <Field
                      label="Lower"
                      unit="mnt"
                      value={fr.lower_mean}
                      min={0.2}
                      max={20}
                      step={0.1}
                      onChange={(v) => patchFront(fr.id, { lower_mean: v })}
                    />
                    <Field
                      label="Unhook"
                      unit="mnt"
                      value={fr.unhook_mean}
                      min={0.2}
                      max={20}
                      step={0.1}
                      onChange={(v) => patchFront(fr.id, { unhook_mean: v })}
                    />
                    <Field
                      label="Return empty"
                      unit="mnt"
                      value={fr.return_empty_mean}
                      min={0.2}
                      max={20}
                      step={0.1}
                      onChange={(v) => patchFront(fr.id, { return_empty_mean: v })}
                    />
                  </div>
                ) : null}
              </div>
            ))}
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
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                setFields((p) => ({
                  ...p,
                  fronts: defaultFronts().map((f) => ({ ...f, enabled: true })),
                }))
              }
            >
              Aktifkan 5 front
            </Button>
          </div>
        </CardContent>
      </Card>

      {result?.front_stats ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Hasil per front</CardTitle>
            <CardDescription>
              Wait tinggi pada prioritas rendah = crane sibuk melayani front penting dulu.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Front</th>
                  <th className="py-2 pr-3 font-medium">Prio</th>
                  <th className="py-2 pr-3 font-medium">Lifts</th>
                  <th className="py-2 pr-3 font-medium">Volume</th>
                  <th className="py-2 font-medium">Wait avg</th>
                </tr>
              </thead>
              <tbody>
                {result.front_stats.map((s) => (
                  <tr key={s.id} className="border-b border-border/60">
                    <td className="py-2 pr-3 font-medium">{s.name}</td>
                    <td className="py-2 pr-3">{s.priority}</td>
                    <td className="py-2 pr-3">{s.lifts}</td>
                    <td className="py-2 pr-3">{formatNum(s.volume, 1)}</td>
                    <td className="py-2">{formatNum(s.wait_avg, 1)} mnt</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}

      {result ? (
        <ResultsPanel result={result} />
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Aktifkan front, set prioritas, lalu{" "}
            <strong className="text-foreground">Jalankan simulasi</strong>.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
