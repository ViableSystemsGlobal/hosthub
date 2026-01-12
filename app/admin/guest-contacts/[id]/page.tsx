import { GuestContactFormPage } from '@/components/pages/guest-contact-form-page'

export default function GuestContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  return <GuestContactFormPage params={params} />
}
