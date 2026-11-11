import { redirect } from 'next/navigation'

// Startseite wurde entfernt – die Akquise-Übersicht ist der Einstieg.
export default function HomePage() {
  redirect('/?tab=akquise')
}
