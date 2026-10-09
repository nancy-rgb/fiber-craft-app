export function ComingSoon({ title, blurb }: { title: string; blurb: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="text-sm text-muted">{blurb}</p>
      <p className="mt-4 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">
        This builder arrives in a later phase.
      </p>
    </div>
  );
}
