/** Placeholder while a page's data loads. */
export default function Loading() {
  return (
    <div aria-busy className="space-y-4">
      <div className="m-skeleton h-8 w-56" />
      <div className="m-skeleton h-4 w-80 max-w-full" />
      <div className="grid gap-3 pt-2 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="m-skeleton h-28" />
        ))}
      </div>
    </div>
  )
}
