import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { IssueForm } from '@/components/forms/issue-form'

export default function NewIssuePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">New Issue</h1>
      <Card>
        <CardHeader>
          <CardTitle>Create Issue</CardTitle>
        </CardHeader>
        <CardContent>
          <IssueForm />
        </CardContent>
      </Card>
    </div>
  )
}

