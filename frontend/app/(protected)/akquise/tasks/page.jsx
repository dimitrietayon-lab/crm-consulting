import { redirect } from 'next/navigation'

// Aufgaben sind jetzt eine gemeinsame Seite mit Akquise-Filter.
export default function SprintTasksRedirect() {
  redirect('/tasks?onlySprint=true')
}
