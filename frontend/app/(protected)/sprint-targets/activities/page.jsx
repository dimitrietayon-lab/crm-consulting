import { redirect } from 'next/navigation'

// Aktivitäten sind jetzt eine gemeinsame Seite mit Akquise-Filter.
export default function SprintActivitiesRedirect() {
  redirect('/activities?onlySprint=true')
}
