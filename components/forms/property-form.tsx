'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Currency } from '@prisma/client'
import { toast } from '@/lib/toast'
import { Upload, X, Image as ImageIcon, ExternalLink } from 'lucide-react'

interface PropertyFormProps {
  propertyId?: string
  initialData?: any
}

export function PropertyForm({ propertyId, initialData }: PropertyFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [owners, setOwners] = useState<any[]>([])
  const [managers, setManagers] = useState<any[]>([])
  const [formData, setFormData] = useState({
    ownerId: initialData?.ownerId || '',
    managerId: initialData?.managerId || '',
    name: initialData?.name || '',
    nickname: initialData?.nickname || '',
    address: initialData?.address || '',
    city: initialData?.city || '',
    country: initialData?.country || 'Ghana',
    currency: initialData?.currency || Currency.GHS,
    airbnbListingId: initialData?.airbnbListingId || '',
    airbnbUrl: initialData?.airbnbUrl || '',
    bookingComId: initialData?.bookingComId || '',
    instagramHandle: initialData?.instagramHandle || '',
    defaultCommissionRate: initialData?.defaultCommissionRate || 0.15,
    cleaningFeeRules: initialData?.cleaningFeeRules || 'separate',
    status: initialData?.status || 'active',
    photos: initialData?.photos || [],
    bedrooms: initialData?.bedrooms || '',
    bathrooms: initialData?.bathrooms || '',
    maxGuests: initialData?.maxGuests || '',
    amenities: initialData?.amenities || '',
    description: initialData?.description || '',
  })
  const [uploading, setUploading] = useState(false)
  const [fetchingAirbnb, setFetchingAirbnb] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!propertyId) {
      fetchOwners()
    }
    fetchManagers()
  }, [propertyId])

  const fetchOwners = async () => {
    try {
      const res = await fetch('/api/owners')
      const data = await res.json()
      setOwners(data)
    } catch (error) {
      console.error('Failed to fetch owners:', error)
    }
  }

  const fetchManagers = async () => {
    try {
      const res = await fetch('/api/users?role=MANAGER')
      const data = await res.json()
      setManagers(data)
    } catch (error) {
      console.error('Failed to fetch managers:', error)
    }
  }

  const extractAirbnbListingId = (url: string): string | null => {
    // Match various Airbnb URL formats:
    // https://www.airbnb.com/rooms/12345678
    // https://airbnb.com/rooms/12345678
    // https://www.airbnb.co.uk/rooms/12345678
    const patterns = [
      /airbnb\.(com|co\.\w{2,3})\/rooms\/(\d+)/i,
      /\/rooms\/(\d+)/i,
    ]
    
    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match) {
        return match[match.length - 1] // Get the last capture group (listing ID)
      }
    }
    return null
  }

  const handleAirbnbUrlChange = (url: string) => {
    setFormData({ ...formData, airbnbUrl: url })
    const listingId = extractAirbnbListingId(url)
    if (listingId) {
      setFormData(prev => ({ ...prev, airbnbListingId: listingId, airbnbUrl: url }))
    }
  }

  const fetchAirbnbData = async () => {
    if (!formData.airbnbUrl) {
      toast.error('Please enter an Airbnb URL first')
      return
    }

    setFetchingAirbnb(true)
    try {
      const res = await fetch('/api/properties/airbnb-scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: formData.airbnbUrl }),
      })

      const result = await res.json()

      if (result.success && result.data) {
        const data = result.data
        
        // Update form with scraped data, only if fields are empty
        setFormData(prev => ({
          ...prev,
          name: prev.name || data.name || '',
          nickname: prev.nickname || data.nickname || '',
          address: prev.address || data.address || '',
          city: prev.city || data.city || '',
          country: prev.country || data.country || 'Ghana',
          airbnbListingId: data.airbnbListingId || prev.airbnbListingId,
          airbnbUrl: data.airbnbUrl || prev.airbnbUrl,
          description: prev.description || data.description || '',
          bedrooms: prev.bedrooms || data.bedrooms?.toString() || '',
          bathrooms: prev.bathrooms || data.bathrooms?.toString() || '',
          maxGuests: prev.maxGuests || data.maxGuests?.toString() || '',
          photos: prev.photos.length > 0 ? prev.photos : (data.photos || []),
        }))

        toast.success('Property details fetched', result.message || 'Successfully extracted property information from Airbnb')
      } else {
        toast.error('Could not fetch details', result.message || 'Please fill in the details manually')
      }
    } catch (error: any) {
      console.error('Failed to fetch Airbnb data:', error)
      toast.error('Fetch failed', 'Could not automatically fetch property details. Please fill in manually.')
    } finally {
      setFetchingAirbnb(false)
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploading(true)
    const uploadPromises = Array.from(files).map(async (file) => {
      const formData = new FormData()
      formData.append('file', file)

      try {
        const res = await fetch('/api/properties/upload', {
          method: 'POST',
          body: formData,
        })

        if (!res.ok) {
          const error = await res.json()
          throw new Error(error.error || 'Upload failed')
        }

        const data = await res.json()
        return data.url
      } catch (error: any) {
        toast.error('Upload failed', error.message)
        return null
      }
    })

    const urls = await Promise.all(uploadPromises)
    const validUrls = urls.filter((url): url is string => url !== null)
    
    if (validUrls.length > 0) {
      setFormData(prev => ({
        ...prev,
        photos: [...prev.photos, ...validUrls],
      }))
      toast.success('Images uploaded', `${validUrls.length} image(s) added`)
    }

    setUploading(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const removePhoto = (index: number) => {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index),
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const url = propertyId
        ? `/api/properties/${propertyId}`
        : '/api/properties'
      const method = propertyId ? 'PATCH' : 'POST'

      // Prepare data for submission - ensure all fields are included
      const submitData = {
        ownerId: formData.ownerId,
        managerId: formData.managerId || null,
        name: formData.name || 'Untitled Property',
        nickname: formData.nickname || null,
        address: formData.address || null,
        city: formData.city || null,
        country: formData.country || null,
        currency: formData.currency,
        airbnbListingId: formData.airbnbListingId || null,
        airbnbUrl: formData.airbnbUrl || null,
        bookingComId: formData.bookingComId || null,
        instagramHandle: formData.instagramHandle || null,
        defaultCommissionRate: formData.defaultCommissionRate,
        cleaningFeeRules: formData.cleaningFeeRules,
        status: formData.status,
        photos: formData.photos || [],
        bedrooms: formData.bedrooms ? parseInt(String(formData.bedrooms)) : null,
        bathrooms: formData.bathrooms ? parseFloat(String(formData.bathrooms)) : null,
        maxGuests: formData.maxGuests ? parseInt(String(formData.maxGuests)) : null,
        amenities: formData.amenities || null,
        description: formData.description || null,
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to save property')
      }

      toast.success(
        propertyId ? 'Property updated' : 'Property created',
        propertyId ? 'Property has been updated successfully' : 'New property has been added successfully'
      )
      router.push('/admin/properties')
      router.refresh()
    } catch (error: any) {
      toast.error('Error', error.message)
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>{propertyId ? 'Edit Property' : 'New Property'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!propertyId && (
              <div className="space-y-2">
                <Label htmlFor="ownerId">Owner *</Label>
                <Select
                  value={formData.ownerId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, ownerId: value })
                  }
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select owner" />
                  </SelectTrigger>
                  <SelectContent>
                    {owners.map((owner) => (
                      <SelectItem key={owner.id} value={owner.id}>
                        {owner.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nickname">Nickname</Label>
                <Input
                  id="nickname"
                  value={formData.nickname}
                  onChange={(e) =>
                    setFormData({ ...formData, nickname: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="managerId">Manager (Optional)</Label>
              <Select
                value={formData.managerId || 'none'}
                onValueChange={(value) =>
                  setFormData({ ...formData, managerId: value === 'none' ? '' : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select manager" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No manager</SelectItem>
                  {managers.map((manager) => (
                    <SelectItem key={manager.id} value={manager.id}>
                      {manager.name || manager.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) =>
                    setFormData({ ...formData, city: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={formData.country}
                  onChange={(e) =>
                    setFormData({ ...formData, country: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Select
                  value={formData.currency}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      currency: value as Currency,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={Currency.GHS}>GHS</SelectItem>
                    <SelectItem value={Currency.USD}>USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="defaultCommissionRate">
                  Commission Rate ({formData.defaultCommissionRate * 100}%)
                </Label>
                <Input
                  id="defaultCommissionRate"
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={formData.defaultCommissionRate}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      defaultCommissionRate: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="airbnbUrl">Airbnb Listing URL</Label>
              <div className="flex gap-2">
                <Input
                  id="airbnbUrl"
                  type="url"
                  placeholder="https://www.airbnb.com/rooms/12345678"
                  value={formData.airbnbUrl}
                  onChange={(e) => handleAirbnbUrlChange(e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={fetchAirbnbData}
                  disabled={fetchingAirbnb || !formData.airbnbUrl}
                  title="Fetch property details from Airbnb"
                >
                  {fetchingAirbnb ? 'Fetching...' : 'Fetch Details'}
                </Button>
                {formData.airbnbListingId && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => window.open(`https://www.airbnb.com/rooms/${formData.airbnbListingId}`, '_blank')}
                    title="Open in Airbnb"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Paste the Airbnb listing URL and click "Fetch Details" to automatically extract property information
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="airbnbListingId">Airbnb Listing ID</Label>
                <Input
                  id="airbnbListingId"
                  value={formData.airbnbListingId}
                  onChange={(e) =>
                    setFormData({ ...formData, airbnbListingId: e.target.value })
                  }
                  placeholder="Auto-filled from URL"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bookingComId">Booking.com ID</Label>
                <Input
                  id="bookingComId"
                  value={formData.bookingComId}
                  onChange={(e) =>
                    setFormData({ ...formData, bookingComId: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="instagramHandle">Instagram Handle</Label>
              <Input
                id="instagramHandle"
                value={formData.instagramHandle}
                onChange={(e) =>
                  setFormData({ ...formData, instagramHandle: e.target.value })
                }
                placeholder="@username"
              />
            </div>

            {/* Property Details */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bedrooms">Bedrooms</Label>
                <Input
                  id="bedrooms"
                  type="number"
                  min="0"
                  value={formData.bedrooms}
                  onChange={(e) =>
                    setFormData({ ...formData, bedrooms: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bathrooms">Bathrooms</Label>
                <Input
                  id="bathrooms"
                  type="number"
                  min="0"
                  step="0.5"
                  value={formData.bathrooms}
                  onChange={(e) =>
                    setFormData({ ...formData, bathrooms: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxGuests">Max Guests</Label>
                <Input
                  id="maxGuests"
                  type="number"
                  min="1"
                  value={formData.maxGuests}
                  onChange={(e) =>
                    setFormData({ ...formData, maxGuests: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amenities">Amenities</Label>
              <Textarea
                id="amenities"
                value={formData.amenities}
                onChange={(e) =>
                  setFormData({ ...formData, amenities: e.target.value })
                }
                placeholder="WiFi, Air Conditioning, Pool, Parking, etc."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Property description..."
                rows={4}
              />
            </div>

            {/* Image Upload */}
            <div className="space-y-2">
              <Label>Property Photos</Label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                  id="photo-upload"
                />
                <label
                  htmlFor="photo-upload"
                  className="flex flex-col items-center justify-center cursor-pointer"
                >
                  <Upload className="w-8 h-8 text-gray-400 mb-2" />
                  <span className="text-sm text-gray-600">
                    {uploading ? 'Uploading...' : 'Click to upload or drag and drop'}
                  </span>
                  <span className="text-xs text-gray-500 mt-1">
                    PNG, JPG, WebP up to 10MB
                  </span>
                </label>
              </div>

              {formData.photos.length > 0 && (
                <div className="grid grid-cols-4 gap-4 mt-4">
                  {formData.photos.map((photo, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={photo}
                        alt={`Property ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(index)}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cleaningFeeRules">Cleaning Fee Rules</Label>
                <Select
                  value={formData.cleaningFeeRules}
                  onValueChange={(value) =>
                    setFormData({ ...formData, cleaningFeeRules: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="included">Included</SelectItem>
                    <SelectItem value="separate">Separate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) =>
                    setFormData({ ...formData, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving...' : 'Save Property'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

