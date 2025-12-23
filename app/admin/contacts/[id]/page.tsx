import { ContactDetailPage } from '@/components/pages/contact-detail-page'

export default async function ContactDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ContactDetailPage contactId={id} />
}

