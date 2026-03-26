import ExpiryDetailClient from './client'

// Required for Next.js static export with dynamic route
export function generateStaticParams() {
  return []
}

export default function ExpiryRequestDetailPage({ params }) {
  return <ExpiryDetailClient id={params.id} />
}
