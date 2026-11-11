import { redirect } from 'next/navigation'

// Dokumente sind jetzt eine gemeinsame Seite mit Akquise-Filter.
export default function SprintDocumentsRedirect() {
  redirect('/documents?onlySprint=true')
}
