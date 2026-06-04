import { Suspense } from 'react'
import { DraftsContent } from './DraftsContent'

export default function DraftsPage() {
  return (
    <Suspense fallback={
      <div className="text-center py-16 text-gray-400">
        <div className="text-4xl mb-4">⏳</div>
        <p>Loading…</p>
      </div>
    }>
      <DraftsContent />
    </Suspense>
  )
}
