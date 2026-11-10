import { redirect } from 'next/navigation'

// Startseite wurde entfernt – das Dashboard ist der Einstieg.
export default function HomePage() {
  redirect('/')
}
