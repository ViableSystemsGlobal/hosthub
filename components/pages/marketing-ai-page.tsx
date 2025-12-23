'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Loader2, Copy, Check } from 'lucide-react'
import { toast } from '@/lib/toast'

interface MarketingStrategy {
  pricing: string[]
  promotions: string[]
  listing: string[]
  content: string[]
  campaigns: string[]
}

export function MarketingAIPage() {
  const [properties, setProperties] = useState<any[]>([])
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('')
  const [portfolio, setPortfolio] = useState(false)
  const [strategy, setStrategy] = useState<MarketingStrategy | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    fetchProperties()
  }, [])

  const fetchProperties = async () => {
    try {
      const res = await fetch('/api/properties')
      const data = await res.json()
      setProperties(data)
    } catch (error) {
      console.error('Failed to fetch properties:', error)
    }
  }

  const generateStrategy = async () => {
    setLoading(true)
    setStrategy(null)

    try {
      const res = await fetch('/api/ai/marketing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: portfolio ? undefined : selectedPropertyId,
          portfolio,
        }),
      })

      if (!res.ok) {
        throw new Error('Failed to generate strategy')
      }

      const data = await res.json()
      setStrategy(data)
    } catch (error: any) {
      toast.error('Error', error.message || 'Failed to generate marketing strategy')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Marketing AI Assistant</h1>

      <Card>
        <CardHeader>
          <CardTitle>Generate Marketing Strategy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="portfolio"
              checked={portfolio}
              onChange={(e) => {
                setPortfolio(e.target.checked)
                if (e.target.checked) {
                  setSelectedPropertyId('')
                }
              }}
            />
            <Label htmlFor="portfolio">Portfolio-wide strategy</Label>
          </div>

          {!portfolio && (
            <div className="space-y-2">
              <Label htmlFor="property">Select Property</Label>
              <Select
                value={selectedPropertyId}
                onValueChange={setSelectedPropertyId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a property" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((property) => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button
            onClick={generateStrategy}
            disabled={loading || (!portfolio && !selectedPropertyId)}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              'Generate Strategy'
            )}
          </Button>
        </CardContent>
      </Card>

      {strategy && (
        <div className="space-y-4">
          {strategy.pricing && strategy.pricing.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Pricing Suggestions</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {strategy.pricing.map((item, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="flex-1">{item}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(item, `pricing-${index}`)}
                      >
                        {copied === `pricing-${index}` ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {strategy.promotions && strategy.promotions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Promotions</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {strategy.promotions.map((item, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="flex-1">{item}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(item, `promo-${index}`)}
                      >
                        {copied === `promo-${index}` ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {strategy.listing && strategy.listing.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Listing Improvements</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {strategy.listing.map((item, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="flex-1">{item}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(item, `listing-${index}`)}
                      >
                        {copied === `listing-${index}` ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {strategy.content && strategy.content.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Content Ideas</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {strategy.content.map((item, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="flex-1">{item}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(item, `content-${index}`)}
                      >
                        {copied === `content-${index}` ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {strategy.campaigns && strategy.campaigns.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Campaign Ideas</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {strategy.campaigns.map((item, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="flex-1">{item}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(item, `campaign-${index}`)}
                      >
                        {copied === `campaign-${index}` ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

