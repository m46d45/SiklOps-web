import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, BookOpen } from "lucide-react";
import { DIESEL_KG_CO2_PER_L } from "@/lib/simkon/engine";
import { OPERATIONS } from "@/lib/simkon/operations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/manual")({ component: ManualPage });

function ManualPage() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-primary text-primary-foreground">
              <BookOpen className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-base font-semibold tracking-tight sm:text-lg">
                  Manual SiklOps
                </h1>
                
              </div>
              <p className="truncate text-xs text-muted-foreground">
                Panduan umum · parameter · hasil · per operasi
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/">
              <ArrowLeft className="h-4 w-4" />
              Simulasi
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-8 px-4 py-8 sm:px-6">
        {/* —— Intro —— */}
        <Card className="rounded-[var(--radius-xl)]">
          <CardHeader>
            <CardTitle className="text-base">Apa itu SiklOps?</CardTitle>
            <CardDescription className="leading-relaxed">
              <strong className="text-foreground">SiklOps</strong> (Siklus Operasi) adalah
              aplikasi pembelajaran{" "}
              <strong className="text-foreground">Discrete Event Simulation (DES)</strong>{" "}
              untuk operasi konstruksi yang berulang: galian-angkut, pasangan bata,
              ready-mixed concrete (dolly / tower crane bucket / pump), dan seterusnya.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              Fokusnya:{" "}
              <strong className="text-foreground">
                throughput, utilisasi resource, antrian, match factor, biaya, emisi CO₂e,
                dan komposisi armada
              </strong>
              — bukan penjadwalan proyek (WBS / CPM / Gantt proyek).
            </p>
            <p>
              Semua operasi memakai{" "}
              <strong className="text-foreground">template yang sama</strong>: sidebar
              operasi → deskripsi + parameter → jalankan → tab hasil standar.
            </p>
          </CardContent>
        </Card>

        {/* —— Alur —— */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold tracking-tight">1. Alur kerja</h2>
          <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
            <li>
              <strong className="text-foreground">Pilih operasi</strong> di sidebar kiri
              (Earthmoving, Bricklaying, RMC Dolly / Crane / Pump).
            </li>
            <li>
              Baca <strong className="text-foreground">deskripsi, tugas, resource, satuan</strong>{" "}
              di kartu atas halaman.
            </li>
            <li>
              Atur <strong className="text-foreground">parameter simulasi</strong> (resource,
              cycle time, target, seed, biaya, solar).
            </li>
            <li>
              Tekan <strong className="text-foreground">Jalankan simulasi</strong>.
            </li>
            <li>
              Baca hasil di tab{" "}
              <strong className="text-foreground">
                Ringkasan · Perbandingan · Teori antrian
              </strong>
              .
            </li>
            <li>
              Opsional: <strong className="text-foreground">Skenario</strong> (simpan/muat)
              atau <strong className="text-foreground">CSV</strong> (export laporan).
            </li>
          </ol>
        </section>

        <Separator />

        {/* —— Parameter —— */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold tracking-tight">2. Parameter simulasi</h2>

          <div className="space-y-3 text-sm text-muted-foreground">
            <Card className="rounded-[var(--radius-lg)]">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm">Resource</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 p-4 pt-0 text-xs leading-relaxed sm:text-sm">
                <ul className="list-disc space-y-1.5 pl-5">
                  <li>
                    Dua jenis resource: <strong className="text-foreground">loader</strong>{" "}
                    (server, mis. excavator/tukang/mixer) dan{" "}
                    <strong className="text-foreground">hauler</strong> (yang berputar di
                    cycle, mis. dump truck/helper/truck mixer).
                  </li>
                  <li>Jumlah unit + kapasitas volume (atau m²) per resource.</li>
                  <li>
                    Volume per trip = kapasitas hauler (payload).
                  </li>
                  <li>
                    <strong className="text-foreground">Biaya sewa</strong> diisi dalam{" "}
                    <strong className="text-foreground">ribuan Rp/jam</strong> (×1000). Contoh:
                    160 = Rp 160.000/jam.
                  </li>
                  <li>
                    Toggle <strong className="text-foreground">all-in</strong>: sewa + operator.
                  </li>
                  <li>
                    <strong className="text-foreground">Solar (L/jam)</strong> kerja &
                    idle → emisi dihitung otomatis × {DIESEL_KG_CO2_PER_L} kg CO₂/L.
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="rounded-[var(--radius-lg)]">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm">Tugas (cycle time)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 p-4 pt-0 text-xs leading-relaxed sm:text-sm">
                <p>
                  Empat fase cycle (label menyesuaikan operasi). Setiap fase punya{" "}
                  <strong className="text-foreground">mean (menit)</strong> dan{" "}
                  <strong className="text-foreground">distribusi</strong> (konstan, normal,
                  log-normal, gamma, beta) + CV.
                </p>
                <p>
                  Earthmoving: Load → Haul → Dump → Return. Bricklaying memakai cycle 2-resource.
                  RMC memakai <strong className="text-foreground">dual-cycle</strong>: truck
                  mixer plant↔site + pengecoran (dolly / crane / pump) lewat buffer site.
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-[var(--radius-lg)]">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm">Setup simulasi</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 p-4 pt-0 text-xs leading-relaxed sm:text-sm">
                <ul className="list-disc space-y-1.5 pl-5">
                  <li>
                    <strong className="text-foreground">Target siklus</strong> — berhenti setelah
                    N trip selesai.
                  </li>
                  <li>
                    <strong className="text-foreground">Target pekerjaan</strong> — berhenti saat
                    volume (m³/m²) tercapai.
                  </li>
                  <li>
                    Berhenti pada yang <strong className="text-foreground">lebih dulu</strong>{" "}
                    tercapai (plus batas waktu pengaman).
                  </li>
                  <li>
                    <strong className="text-foreground">Seed</strong> — bilangan acak tetap agar
                    hasil reproducible (default 12345).
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        <Separator />

        {/* —— Hasil —— */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold tracking-tight">3. Cara membaca hasil</h2>
          <p className="text-sm text-muted-foreground">
            Setelah run, hasil dikelompokkan dalam tiga tab standar (sama untuk semua
            operasi).
          </p>

          <Card className="rounded-[var(--radius-lg)]">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm">Tab Ringkasan</CardTitle>
              <CardDescription>Tempat utama setelah simulasi.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                <li>
                  <strong className="text-foreground">KPI</strong> — trip, volume, throughput,
                  util, antrian, match factor, gap sim vs teori, waktu ke target.
                </li>
                <li>
                  <strong className="text-foreground">Bottleneck</strong> — resource yang paling
                  membatasi produksi.
                </li>
                <li>
                  <strong className="text-foreground">Biaya</strong> — per resource, waiting
                  (waste), total fleet, satuan (Rp per unit volume), waste per unit.
                </li>
                <li>
                  <strong className="text-foreground">Emisi CO₂e</strong> — per resource, waiting
                  karbon, total, satuan (kg per unit), waste per unit.
                </li>
                <li>
                  <strong className="text-foreground">Learning curve</strong> — produktivitas
                  per siklus (tebal) + moving average (putus-putus), satuan unit/jam.
                </li>
                <li>
                  <strong className="text-foreground">Steady state</strong> — zona CV
                  produktivitas rendah; prod. SS jika tercapai.
                </li>
                <li>
                  <strong className="text-foreground">Utilisasi per siklus</strong> dan komposisi
                  cycle (load/haul/… + %).
                </li>
                <li>
                  <strong className="text-foreground">Antrian</strong> — grafik panjang antri vs
                  waktu + metrik tunggu.
                </li>
                <li>
                  <strong className="text-foreground">Multi-run</strong> — 5/10/20 seed: mean ±
                  std throughput, biaya satuan, emisi satuan.
                </li>
                <li>
                  <strong className="text-foreground">Saran desain</strong> — kap. teori, match
                  factor, jumlah hauler ideal, daftar what-if.
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="rounded-[var(--radius-lg)]">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm">Tab Perbandingan</CardTitle>
              <CardDescription>
                What-if komposisi fleet (loader 1–3 × hauler 1–40).
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                <li>
                  X = jumlah hauler; tiap warna = jumlah loader.
                </li>
                <li>
                  Throughput <strong className="text-foreground">sim (tebal)</strong> vs{" "}
                  <strong className="text-foreground">teori (putus-putus)</strong>.
                </li>
                <li>Utilisasi loader & hauler, waktu tunggu, panjang antrian.</li>
                <li>Biaya satuan, waste waiting, emisi satuan, waste karbon.</li>
                <li>
                  <strong className="text-foreground">Sweet spot</strong> — max thr · min biaya
                  · min emisi (bisa di jumlah hauler berbeda).
                </li>
                <li>
                  <strong className="text-foreground">Sensitivitas CV</strong> — ulangi grid
                  dengan variabilitas berbeda.
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="rounded-[var(--radius-lg)]">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm">Tab Teori antrian</CardTitle>
              <CardDescription>
                Modul lanjutan: Little's Law & Kingman vs hasil DES.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                <li>
                  <strong className="text-foreground">Little</strong> — L = λ·W; cek L_q DES vs
                  λ·W_q dan λ·cycle ≈ N armada.
                </li>
                <li>
                  <strong className="text-foreground">Kingman (VUT)</strong> — prediksi W_q dari
                  utilisasi × variabilitas; bandingkan error % vs DES.
                </li>
                <li>
                  Kurva W_q vs ρ: utilisasi tinggi → antrian prediksi naik tajam.
                </li>
                <li>
                  Prediksi bisa beda dari DES (fleet tertutup, horizon pendek, multi-server).
                  Keputusan fleet tetap dari Ringkasan & Perbandingan.
                </li>
              </ul>
            </CardContent>
          </Card>
        </section>

        <Separator />

        {/* —— Rumus singkat —— */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold tracking-tight">4. Rumus singkat (edukasi)</h2>
          <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-border">
            <table className="w-full min-w-[320px] text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Metrik</th>
                  <th className="px-3 py-2 font-medium">Rumus / arti</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b border-border/80">
                  <td className="px-3 py-2 font-medium text-foreground">Throughput</td>
                  <td className="px-3 py-2">Volume selesai ÷ jam simulasi</td>
                </tr>
                <tr className="border-b border-border/80">
                  <td className="px-3 py-2 font-medium text-foreground">Utilisasi</td>
                  <td className="px-3 py-2">Busy ÷ (n unit × durasi)</td>
                </tr>
                <tr className="border-b border-border/80">
                  <td className="px-3 py-2 font-medium text-foreground">Match factor</td>
                  <td className="px-3 py-2">
                    Kap. hauling / kap. loading (≈1 seimbang)
                  </td>
                </tr>
                <tr className="border-b border-border/80">
                  <td className="px-3 py-2 font-medium text-foreground">Kap. loading teori</td>
                  <td className="px-3 py-2">n_L × (60 / t_load) × payload</td>
                </tr>
                <tr className="border-b border-border/80">
                  <td className="px-3 py-2 font-medium text-foreground">Kap. hauling teori</td>
                  <td className="px-3 py-2">n_H × (60 / t_cycle) × payload</td>
                </tr>
                <tr className="border-b border-border/80">
                  <td className="px-3 py-2 font-medium text-foreground">Biaya total</td>
                  <td className="px-3 py-2">Σ (n × tarif/jam × jam) — all-in = sewa + operator</td>
                </tr>
                <tr className="border-b border-border/80">
                  <td className="px-3 py-2 font-medium text-foreground">Biaya waiting</td>
                  <td className="px-3 py-2">Jam·unit antri hauler × tarif hauler</td>
                </tr>
                <tr className="border-b border-border/80">
                  <td className="px-3 py-2 font-medium text-foreground">Biaya satuan</td>
                  <td className="px-3 py-2">Biaya total ÷ volume</td>
                </tr>
                <tr className="border-b border-border/80">
                  <td className="px-3 py-2 font-medium text-foreground">Emisi</td>
                  <td className="px-3 py-2">
                    Jam kerja × EF kerja + jam idle/antri × EF idle; EF ≈ L/jam ×{" "}
                    {DIESEL_KG_CO2_PER_L}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-medium text-foreground">Emisi satuan</td>
                  <td className="px-3 py-2">Emisi total ÷ volume</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Default sewa & solar disetel ke orde pasar Indonesia untuk excavator ~0,5 m³
            dan dump truck ~4 m³ (earthmoving). Operasi lain punya default sendiri.
          </p>
        </section>

        <Separator />

        {/* —— Skenario & export —— */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold tracking-tight">5. Skenario & export</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">Skenario</strong> (header) — simpan parameter
              di browser (localStorage), muat kembali, atau hapus.
            </li>
            <li>
              <strong className="text-foreground">CSV</strong> — unduh ringkasan KPI + log
              siklus untuk laporan / spreadsheet.
            </li>
            <li>
              <strong className="text-foreground">Reset default</strong> — mengembalikan
              parameter operasi yang sedang dipilih ke default bawaan.
            </li>
          </ul>
        </section>

        <Separator />

        {/* —— Per operasi —— */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold tracking-tight">6. Manual per operasi</h2>
          <p className="text-sm text-muted-foreground">
            Tiap operasi memakai engine cycle 2-resource yang sama; yang beda adalah label
            tugas, default, satuan, dan interpretasi lapangan.
          </p>
          <ul className="space-y-3">
            {OPERATIONS.map((op) => (
              <li key={op.id}>
                <Card className="rounded-[var(--radius-lg)]">
                  <CardHeader className="space-y-1 p-4 pb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-sm">{op.title}</CardTitle>
                    </div>
                    <CardDescription className="leading-relaxed">
                      {op.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 p-4 pt-0 text-sm text-muted-foreground">
                    {op.illustration ? (
                      <figure className="mx-auto max-w-sm overflow-hidden rounded-[var(--radius-md)] border border-border bg-muted/20 sm:max-w-md">
                        <img
                          src={op.illustration}
                          alt={`Ilustrasi ${op.shortTitle}`}
                          className="mx-auto h-auto max-h-40 w-full object-contain sm:max-h-48"
                          loading="lazy"
                        />
                        {op.illustrationCaption ? (
                          <figcaption className="border-t border-border px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                            {op.illustrationCaption}
                          </figcaption>
                        ) : null}
                      </figure>
                    ) : null}
                    <div className="flex flex-wrap gap-1.5">
                      {op.tasks.map((task, i) => (
                        <Badge key={task.key} variant="outline" className="font-normal">
                          {i + 1}. {task.label}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs">
                      <strong className="text-foreground">Resource:</strong> {op.loaderLabel}{" "}
                      + {op.haulerLabel} ·{" "}
                      <strong className="text-foreground">Satuan:</strong> {op.unit} ·{" "}
                      <strong className="text-foreground">Durasi:</strong> {op.durationUnit}
                    </p>
                    <p className="text-xs leading-relaxed">{op.manual.summary}</p>
                    <ol className="list-decimal space-y-1 pl-5 text-xs leading-relaxed">
                      {op.manual.howTo.map((h) => (
                        <li key={h}>{h}</li>
                      ))}
                    </ol>
                    <p className="text-xs leading-relaxed text-muted-foreground/90">
                      {op.manual.notes}
                    </p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>

        <Separator />

        {/* —— Tips —— */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold tracking-tight">7. Tips pembelajaran</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            <li>
              Mulai dari default earthmoving → jalankan → baca bottleneck & match factor.
            </li>
            <li>
              Ubah jumlah hauler ±2, bandingkan throughput, util, biaya satuan, emisi satuan.
            </li>
            <li>
              Di Perbandingan, cari sweet spot: max produksi vs min biaya vs min karbon — sering
              tidak di titik yang sama.
            </li>
            <li>
              Naikkan CV → antrian dan gap sim–teori biasanya membesar (efek variabilitas).
            </li>
            <li>
              Multi-run: jangan andalkan satu seed untuk kesimpulan kelas/paper.
            </li>
            <li>
              Bricklaying memakai cycle 2-resource. RMC dual-cycle: supply plant↔site berinteraksi
              dengan place method di site (dolly / crane / pump) lewat buffer.
            </li>
          </ul>
        </section>

        <Separator />

        <section className="space-y-2 text-sm text-muted-foreground">
          <h2 className="text-sm font-semibold text-foreground">
            Template operasi baru (pengembang)
          </h2>
          <p className="leading-relaxed">
            Operasi baru = entri katalog (tugas, resource, default, manual) +{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">defaultConfig(op)</code>{" "}
            + engine cycle 2-resource + tab hasil yang sama. UI tidak perlu didesain ulang.
          </p>
        </section>

        <div className="flex flex-col gap-2 pt-2 sm:flex-row">
          <Button asChild className="w-full sm:w-auto">
            <Link to="/">Kembali ke simulasi</Link>
          </Button>
        </div>

        <p className="pb-6 text-center text-xs text-muted-foreground">
          SiklOps · Manual umum · Pembaruan mengikuti fitur aplikasi
        </p>
      </main>
    </div>
  );
}
