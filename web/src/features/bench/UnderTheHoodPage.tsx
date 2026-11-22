import { useQuery } from "@tanstack/react-query";
import { Activity, FlaskConical } from "lucide-react";

interface BenchSeries { title: string; unit: string; points: Array<{ label: string; value: number }> }
interface BenchManifest { generatedAt?: string; series: BenchSeries[] }

async function loadBenchmarks(): Promise<BenchManifest> {
  const response = await fetch("/bench/manifest.json");
  if (!response.ok) throw new Error("No benchmark manifest");
  return response.json() as Promise<BenchManifest>;
}

export function UnderTheHoodPage() {
  const query = useQuery({ queryKey: ["benchmarks"], queryFn: loadBenchmarks, retry: false });
  return <div className="page-wrap"><header className="page-heading"><div><p className="kicker">Under the hood</p><h1>Numbers, only when measured.</h1><p>This page reads benchmark JSON from <code>web/public/bench/</code>. It never fills gaps with invented results.</p></div></header>
    {!query.data?.series?.length ? <div className="empty-card"><FlaskConical /><h2>No results yet</h2><p>Add a valid <code>manifest.json</code> after a benchmark run. Search latency and matcher charts will appear here.</p></div> : <div className="grid gap-5 lg:grid-cols-2">{query.data.series.map((series) => <BenchmarkChart key={series.title} series={series} />)}</div>}
    <section className="mt-6 rounded-3xl border border-ink/10 bg-paper p-6"><div className="flex items-start gap-4"><Activity className="mt-1 size-6 text-signature" /><div><h2 className="font-display text-2xl font-bold">Last-seat booking race</h2><p className="mt-2 text-muted">The API does not support booking yet, so the race button is intentionally disabled.</p><button disabled className="mt-5 rounded-full bg-ink/10 px-5 py-3 font-bold text-muted">Run after booking API lands</button></div></div></section>
  </div>;
}

function BenchmarkChart({ series }: { series: BenchSeries }) {
  const max = Math.max(...series.points.map((point) => point.value), 1);
  return <figure className="min-w-0 rounded-3xl border border-ink/10 bg-paper p-6"><figcaption className="break-words font-display text-2xl font-bold">{series.title}</figcaption><div className="mt-8 grid gap-4">{series.points.map((point) => <div key={point.label} className="grid min-w-0 grid-cols-[minmax(0,7rem)_minmax(2rem,1fr)_auto] items-center gap-3 text-sm"><span className="truncate text-muted">{point.label}</span><span className="h-3 overflow-hidden rounded-full bg-ink/5"><i className="block h-full rounded-full bg-signature" style={{ width: `${(point.value / max) * 100}%` }} /></span><strong className="whitespace-nowrap tabular-nums">{point.value} {series.unit}</strong></div>)}</div></figure>;
}
