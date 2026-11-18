import { redirect } from 'next/navigation'

// Akquise-Zuweisung wurde entfernt. Team-Zuweisung läuft künftig über
// bestehende Kundenprojekte (siehe /team).
export default function AkquiseTeamAssignRedirect() {
  redirect('/akquise')
}
