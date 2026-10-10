import { redirect } from 'next/navigation'

/** The old address of a class's 派作業 page; the form now lives at /classes/assign and can pick several classes. */
export default async function ClassAssignPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ exam?: string }> }) {
  const [{ id }, { exam }] = await Promise.all([params, searchParams])
  redirect(`/classes/assign?class=${encodeURIComponent(id)}${exam ? `&exam=${encodeURIComponent(exam)}` : ''}`)
}
