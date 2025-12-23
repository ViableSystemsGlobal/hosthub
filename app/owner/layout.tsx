import { OwnerLayout } from '@/components/layout/owner-layout'

export default function OwnerLayoutWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  return <OwnerLayout>{children}</OwnerLayout>
}

