import { GuestContactFormPage } from '@/components/pages/guest-contact-form-page'

export default function EditGuestContactPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  return <GuestContactFormPage params={params} redirectPath="/manager/guest-contacts" />
}
