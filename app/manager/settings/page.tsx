import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function ManagerSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-gray-600 mt-1">Application settings and configurations</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>Application settings are managed by administrators</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">
            For application-wide settings, please contact your administrator.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

