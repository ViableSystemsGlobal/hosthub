'use client'

import { useEffect, useState, use } from 'react'
import { ExpenseForm } from '@/components/forms/expense-form'

export default function EditExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [expense, setExpense] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/expenses/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setExpense(data)
        setLoading(false)
      })
  }, [id])

  if (loading) return <div>Loading...</div>
  return <ExpenseForm expenseId={id} initialData={expense} />
}

