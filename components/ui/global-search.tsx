'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { Search, Building2, Users, Calendar, AlertTriangle, Phone, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchResult {
  type: 'property' | 'owner' | 'booking' | 'issue' | 'contact'
  id: string
  title: string
  subtitle: string
  url: string
  icon: string
}

const iconMap: Record<string, any> = {
  Building2,
  Users,
  Calendar,
  AlertTriangle,
  Phone,
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K to open search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(true)
      }
      // Escape to close
      if (e.key === 'Escape' && open) {
        setOpen(false)
        setQuery('')
        setResults([])
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open])

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setResults([])
      setSelectedIndex(-1)
    }
  }, [open])

  useEffect(() => {
    const search = async () => {
      if (query.trim().length < 2) {
        setResults([])
        return
      }

      setLoading(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
        if (res.ok) {
          const data = await res.json()
          setResults(data.results || [])
        }
      } catch (error) {
        console.error('Search error:', error)
      } finally {
        setLoading(false)
      }
    }

    const debounce = setTimeout(search, 300)
    return () => clearTimeout(debounce)
  }, [query])

  useEffect(() => {
    if (selectedIndex >= 0 && resultsRef.current) {
      const selectedElement = resultsRef.current.children[selectedIndex] as HTMLElement
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [selectedIndex])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1))
    } else if (e.key === 'Enter' && selectedIndex >= 0 && results[selectedIndex]) {
      e.preventDefault()
      handleSelectResult(results[selectedIndex])
    }
  }

  const handleSelectResult = (result: SearchResult) => {
    router.push(result.url)
    setOpen(false)
    setQuery('')
    setResults([])
  }

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      property: 'Property',
      owner: 'Owner',
      booking: 'Booking',
      issue: 'Issue',
      contact: 'Contact',
    }
    return labels[type] || type
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-2 px-3 py-2 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <Search className="w-4 h-4" />
        <span>Search...</span>
        <kbd className="hidden lg:inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-semibold text-gray-500 bg-white border border-gray-200 rounded">
          ⌘K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl p-0" showCloseButton={false}>
          <div className="p-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search properties, owners, bookings, issues..."
                className="pl-10 pr-4 py-2"
              />
            </div>
          </div>

          <div ref={resultsRef} className="max-h-96 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            )}

            {!loading && query.trim().length < 2 && (
              <div className="px-4 py-8 text-center text-gray-500 text-sm">
                Type at least 2 characters to search
              </div>
            )}

            {!loading && query.trim().length >= 2 && results.length === 0 && (
              <div className="px-4 py-8 text-center text-gray-500 text-sm">
                No results found for &quot;{query}&quot;
              </div>
            )}

            {!loading && results.length > 0 && (
              <div className="py-2">
                {results.map((result, index) => {
                  const Icon = iconMap[result.icon] || Search
                  return (
                    <button
                      key={`${result.type}-${result.id}`}
                      onClick={() => handleSelectResult(result)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left',
                        selectedIndex === index && 'bg-gray-50'
                      )}
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                        <Icon className="w-4 h-4 text-gray-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-gray-900 truncate">
                          {result.title}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {result.subtitle}
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-xs text-gray-400">
                        {getTypeLabel(result.type)}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="px-4 py-2 border-t bg-gray-50 text-xs text-gray-500">
            <div className="flex items-center justify-between">
              <span>Use ↑↓ to navigate, Enter to select, Esc to close</span>
              <span>⌘K to open</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

