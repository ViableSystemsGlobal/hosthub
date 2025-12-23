import { ManagerLayout } from '@/components/layout/manager-layout'

export default function ManagerLayoutWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  return <ManagerLayout>{children}</ManagerLayout>
}

