import { redirect } from 'next/navigation'

// Compliance-Seite entfernt – Route leitet auf das Dashboard um.
export default function CompliancePage() {
  redirect('/')
}
