import { NextRequest, NextResponse } from 'next/server'

/**
 * Scrapes property details from an Airbnb listing URL
 * 
 * Note: This uses web scraping which may violate Airbnb's Terms of Service.
 * Use responsibly and consider using official APIs if available.
 * 
 * Limitations:
 * - Airbnb pages are heavily JavaScript-rendered, so some data may not be available
 * - Success rate depends on Airbnb's current HTML structure
 * - May not work if Airbnb implements anti-scraping measures
 * - Photos may require additional processing to download
 */
export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // Extract listing ID from URL
    const listingIdMatch = url.match(/airbnb\.(com|co\.\w{2,3})\/rooms\/(\d+)/i)
    if (!listingIdMatch) {
      return NextResponse.json({ error: 'Invalid Airbnb URL' }, { status: 400 })
    }

    const listingId = listingIdMatch[listingIdMatch.length - 1]

    // Fetch the Airbnb page
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch Airbnb page: ${response.statusText}`)
    }

    const html = await response.text()

    // Try to extract data from JSON-LD structured data (most reliable)
    const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i)
    let structuredData = null
    
    if (jsonLdMatch) {
      try {
        structuredData = JSON.parse(jsonLdMatch[1])
      } catch (e) {
        // Try to find JSON in the page
        const jsonMatch = html.match(/"__NEXT_DATA__":\s*({[\s\S]*?})<\/script>/)
        if (jsonMatch) {
          try {
            const nextData = JSON.parse(jsonMatch[1])
            structuredData = nextData
          } catch (e2) {
            // Continue with regex parsing
          }
        }
      }
    }

    // Extract property details using regex patterns
    const extractedData: any = {
      airbnbListingId: listingId,
      airbnbUrl: url,
    }
    
    // Helper to search for values in JSON string (fallback method)
    const searchInJson = (jsonStr: string, searchTerms: string[]): any => {
      const results: any = {}
      for (const term of searchTerms) {
        // Try to find the term as a key followed by a value
        const patterns = [
          new RegExp(`"${term}"\\s*:\\s*"([^"]+)"`, 'i'),
          new RegExp(`"${term}"\\s*:\\s*(\\d+(?:\\.\\d+)?)`, 'i'),
          new RegExp(`'${term}'\\s*:\\s*"([^"]+)"`, 'i'),
        ]
        for (const pattern of patterns) {
          const match = jsonStr.match(pattern)
          if (match) {
            results[term] = match[1]
            break
          }
        }
      }
      return results
    }

    // Try to extract data from JSON-LD or __NEXT_DATA__
    let propertyData: any = null
    let listingData: any = null
    
    // Helper function to recursively search for data in nested objects
    const findInObject = (obj: any, keys: string[]): any => {
      if (!obj || typeof obj !== 'object') return null
      
      for (const key of keys) {
        if (obj[key] !== undefined && obj[key] !== null) {
          return obj[key]
        }
      }
      
      // Recursively search in nested objects
      for (const value of Object.values(obj)) {
        if (value && typeof value === 'object') {
          const found = findInObject(value, keys)
          if (found) return found
        }
      }
      
      return null
    }
    
    // Look for __NEXT_DATA__ which contains all the React app data
    const nextDataMatch = html.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i)
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1])
        
        // Airbnb stores data in various nested locations - try multiple paths
        const props = nextData?.props?.pageProps || {}
        
        // Try different paths where Airbnb might store listing data
        listingData = 
          props?.listingDetails?.listing ||
          props?.listing ||
          props?.bootstrap?.listing?.listing ||
          props?.initialState?.listing?.listing ||
          findInObject(props, ['listing', 'listingDetails', 'stayProductDetailPage'])
        
        // Also try to get from presentation data
        const presentation = props?.presentation?.stayProductDetailPage
        if (presentation) {
          propertyData = {
            ...listingData,
            // Try to extract from sections
            sections: presentation.sections,
            // Try to get from logEventData
            logEventData: presentation.logEventData,
            // Get from presentation root
            ...presentation,
          }
        } else {
          propertyData = listingData
        }
        
        // If we still don't have propertyData, try recursive search
        if (!propertyData || Object.keys(propertyData).length === 0) {
          const searchResult = findInObject(nextData, [
            'listing',
            'listingDetails', 
            'stayProductDetailPage',
            'roomAndPropertyType',
            'publicAddress'
          ])
          if (searchResult) {
            propertyData = searchResult
          }
        }
      } catch (e) {
        console.error('Failed to parse __NEXT_DATA__:', e)
        // Continue with regex parsing
      }
    }
    
    // Also try to find data in window.__REACT_QUERY_STATE__ or similar
    const reactQueryMatch = html.match(/window\.__REACT_QUERY_STATE__\s*=\s*({[\s\S]*?});/i)
    if (reactQueryMatch && !propertyData) {
      try {
        const reactQueryData = JSON.parse(reactQueryMatch[1])
        // Navigate through React Query state to find listing data
        const queries = reactQueryData?.queries || []
        for (const query of queries) {
          if (query?.state?.data?.listing) {
            propertyData = query.state.data.listing
            break
          }
        }
      } catch (e) {
        // Continue
      }
    }

    // Try to extract name/title from multiple sources
    let name = null
    
    // From propertyData (most reliable if available)
    if (propertyData) {
      name = 
        propertyData.name ||
        propertyData.title ||
        propertyData.heading ||
        propertyData.listingName ||
        propertyData.publicAddress ||
        propertyData.localizedTitle ||
        propertyData.title?.text ||
        propertyData.primaryLine?.text
      
      // Try to get from sections if available
      if (!name && propertyData.sections) {
        const overviewSection = propertyData.sections.find((s: any) => 
          s.sectionId === 'OVERVIEW_DEFAULT' || s.sectionId === 'TITLE_DEFAULT'
        )
        if (overviewSection?.section?.structuredContent?.primaryLine?.text) {
          name = overviewSection.section.structuredContent.primaryLine.text
        }
      }
    }
    
    // From JSON-LD
    if (!name && structuredData && structuredData.name) {
      name = structuredData.name
    }
    
    // From HTML title tag
    if (!name) {
      const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i)
      if (titleMatch) {
        name = titleMatch[1]
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\s*-\s*Airbnb\s*$/, '')
          .trim()
      }
    }
    
    // From meta tags
    if (!name) {
      const metaNameMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
      if (metaNameMatch) {
        name = metaNameMatch[1].trim()
      }
    }
    
    if (name) {
      extractedData.name = String(name).trim()
    }
    
    // Fallback: Search in raw HTML/JSON for name
    if (!extractedData.name) {
      const jsonSearch = searchInJson(html, ['name', 'title', 'heading', 'listingName', 'publicAddress'])
      if (jsonSearch.name || jsonSearch.title || jsonSearch.heading) {
        extractedData.name = String(jsonSearch.name || jsonSearch.title || jsonSearch.heading).trim()
      }
    }

    // Try to extract description
    let description = null
    
    // From propertyData
    if (propertyData) {
      description = 
        propertyData.description ||
        propertyData.summary ||
        propertyData.space ||
        propertyData.neighborhoodOverview ||
        propertyData.localizedDescription
      
      // Try to get from sections
      if (!description && propertyData.sections) {
        const descriptionSection = propertyData.sections.find((s: any) => 
          s.sectionId === 'DESCRIPTION_DEFAULT' || 
          s.sectionId === 'ABOUT_THIS_SPACE'
        )
        if (descriptionSection?.section?.structuredContent) {
          // Try to extract text from structured content
          const content = descriptionSection.section.structuredContent
          if (content.primaryLine?.text) {
            description = content.primaryLine.text
          } else if (Array.isArray(content.bulletPoints)) {
            description = content.bulletPoints.map((bp: any) => bp.text || bp).join('\n')
          }
        }
      }
    }
    
    if (!description && structuredData && structuredData.description) {
      description = structuredData.description
    }
    
    if (!description) {
      const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
                       html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)
      if (descMatch) {
        description = descMatch[1]
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .trim()
      }
    }
    
    if (description) {
      extractedData.description = String(description).trim()
    }
    
    // Fallback: Search in raw HTML/JSON for description
    if (!extractedData.description) {
      const jsonSearch = searchInJson(html, ['description', 'summary', 'space', 'neighborhoodOverview'])
      if (jsonSearch.description || jsonSearch.summary) {
        extractedData.description = String(jsonSearch.description || jsonSearch.summary).trim()
      }
    }

    // Try to extract location
    let location: string | null = null
    
    // From propertyData
    if (propertyData) {
      // Try various location fields
      const city = propertyData.city || 
                   propertyData.localizedCity || 
                   propertyData.address?.city ||
                   propertyData.location?.city
      const country = propertyData.country || 
                      propertyData.localizedCountry || 
                      propertyData.address?.country ||
                      propertyData.location?.country
      const address = propertyData.address?.streetAddress ||
                      propertyData.publicAddress ||
                      propertyData.address?.addressLine1
      
      if (city) extractedData.city = String(city).trim()
      if (country) extractedData.country = String(country).trim()
      if (address) extractedData.address = String(address).trim()
      
      // Try to get full location string
      if (!location && (city || country)) {
        location = [city, country].filter(Boolean).join(', ')
      }
    }
    
    if (structuredData && structuredData.address) {
      // Handle both string and object addresses
      if (typeof structuredData.address === 'string') {
        location = structuredData.address
      } else if (structuredData.address && typeof structuredData.address === 'object') {
        // If it's an object, try to get addressLocality and addressCountry
        if (structuredData.address.addressLocality && !extractedData.city) {
          extractedData.city = String(structuredData.address.addressLocality)
        }
        if (structuredData.address.addressCountry && !extractedData.country) {
          extractedData.country = String(structuredData.address.addressCountry)
        }
        if (structuredData.address.streetAddress && !extractedData.address) {
          extractedData.address = String(structuredData.address.streetAddress)
        }
      }
    }
    
    if (!location) {
      const locationMatch = html.match(/<meta[^>]*property=["']og:locale["'][^>]*content=["']([^"']+)["']/i) ||
                             html.match(/address["']:\s*["']([^"']+)["']/i)
      if (locationMatch) {
        location = locationMatch[1].trim()
      }
    }
    
    if (location && typeof location === 'string' && !extractedData.city && !extractedData.country) {
      // Try to parse city and country from location string
      const parts = location.split(',').map((s: string) => s.trim())
      if (parts.length >= 2) {
        extractedData.city = parts[0]
        extractedData.country = parts[parts.length - 1]
      } else {
        extractedData.address = location
      }
    }

    // Try to extract bedrooms, bathrooms, and guests from property data
    if (propertyData) {
      // Try direct properties
      if (propertyData.bedrooms !== undefined && propertyData.bedrooms !== null) {
        extractedData.bedrooms = parseInt(String(propertyData.bedrooms))
      }
      if (propertyData.bathrooms !== undefined && propertyData.bathrooms !== null) {
        extractedData.bathrooms = parseFloat(String(propertyData.bathrooms))
      }
      if (propertyData.guests !== undefined && propertyData.guests !== null) {
        extractedData.maxGuests = parseInt(String(propertyData.guests))
      }
      if (propertyData.accommodates !== undefined && propertyData.accommodates !== null) {
        extractedData.maxGuests = parseInt(String(propertyData.accommodates))
      }
      
      // Try from roomAndPropertyType
      if (propertyData.roomAndPropertyType) {
        const rpt = propertyData.roomAndPropertyType
        if (rpt.bedrooms !== undefined && !extractedData.bedrooms) {
          extractedData.bedrooms = parseInt(String(rpt.bedrooms))
        }
        if (rpt.bathrooms !== undefined && !extractedData.bathrooms) {
          extractedData.bathrooms = parseFloat(String(rpt.bathrooms))
        }
      }
      
      // Try from sections
      if (propertyData.sections) {
        const detailsSection = propertyData.sections.find((s: any) => 
          s.sectionId === 'ROOM_TYPE_DEFAULT' || 
          s.sectionId === 'AMENITIES_DEFAULT'
        )
        if (detailsSection?.section?.structuredContent) {
          const content = detailsSection.section.structuredContent
          // Look for bedroom/bathroom info in the content
          if (content.bedrooms !== undefined && !extractedData.bedrooms) {
            extractedData.bedrooms = parseInt(String(content.bedrooms))
          }
          if (content.bathrooms !== undefined && !extractedData.bathrooms) {
            extractedData.bathrooms = parseFloat(String(content.bathrooms))
          }
        }
      }
      
      // Try from logEventData
      if (propertyData.logEventData) {
        const logData = propertyData.logEventData
        if (logData.bedrooms !== undefined && !extractedData.bedrooms) {
          extractedData.bedrooms = parseInt(String(logData.bedrooms))
        }
        if (logData.bathrooms !== undefined && !extractedData.bathrooms) {
          extractedData.bathrooms = parseFloat(String(logData.bathrooms))
        }
        if (logData.guests !== undefined && !extractedData.maxGuests) {
          extractedData.maxGuests = parseInt(String(logData.guests))
        }
      }
    }
    
    // Fallback: Search in the raw HTML/JSON for these values
    if (!extractedData.bedrooms) {
      const bedroomsMatch = html.match(/"bedrooms?["']?\s*:\s*(\d+)/i) ||
                           html.match(/(\d+)\s*bedroom/i) ||
                           html.match(/bedrooms?["']?\s*:\s*["']?(\d+)["']?/i)
      if (bedroomsMatch) {
        extractedData.bedrooms = parseInt(bedroomsMatch[1])
      }
    }

    if (!extractedData.bathrooms) {
      const bathroomsMatch = html.match(/"bathrooms?["']?\s*:\s*([\d.]+)/i) ||
                             html.match(/(\d+(?:\.\d+)?)\s*bathroom/i) ||
                             html.match(/bathrooms?["']?\s*:\s*["']?([\d.]+)["']?/i)
      if (bathroomsMatch) {
        extractedData.bathrooms = parseFloat(bathroomsMatch[1])
      }
    }

    if (!extractedData.maxGuests) {
      const guestsMatch = html.match(/"guests?["']?\s*:\s*(\d+)/i) ||
                         html.match(/"accommodates["']?\s*:\s*(\d+)/i) ||
                         html.match(/(\d+)\s*guest/i) ||
                         html.match(/accommodates["']?\s*:\s*(\d+)/i)
      if (guestsMatch) {
        extractedData.maxGuests = parseInt(guestsMatch[1])
      }
    }

    // Try to extract amenities (this is trickier)
    const amenitiesMatch = html.match(/amenities["']:\s*\[(.*?)\]/i) ||
                          html.match(/amenityIds["']:\s*\[(.*?)\]/i)
    if (amenitiesMatch) {
      // This would need more sophisticated parsing
      // For now, we'll leave it empty and let users fill it manually
    }

    // Try to extract photos
    let photos: string[] = []
    
    // First try to get from propertyData
    if (propertyData && propertyData.photos) {
      photos = Array.isArray(propertyData.photos) 
        ? propertyData.photos.map((p: any) => p.url || p.src || p).filter(Boolean)
        : []
    }
    
    // Fallback to regex extraction
    if (photos.length === 0) {
      const photoMatches = html.matchAll(/https?:\/\/[^"'\s]+\.(jpg|jpeg|png|webp)/gi)
      const seen = new Set<string>()
      
      for (const match of photoMatches) {
        let photoUrl = match[0]
        // Filter for Airbnb CDN images
        if (photoUrl.includes('a0.muscache.com') || photoUrl.includes('airbnb') || photoUrl.includes('airbnbapi')) {
          // Clean up the URL - remove size parameters
          photoUrl = photoUrl.split('?')[0] // Remove query params
          if (!seen.has(photoUrl) && photos.length < 20) {
            photos.push(photoUrl)
            seen.add(photoUrl)
          }
        }
      }
    }
    
    if (photos.length > 0) {
      extractedData.photos = photos.slice(0, 10) // Limit to 10 photos
    }

    // Debug: Log what we found (only in development)
    if (process.env.NODE_ENV === 'development') {
      console.log('[Airbnb Scrape] Extracted data:', JSON.stringify(extractedData, null, 2))
      if (propertyData) {
        console.log('[Airbnb Scrape] Property data keys:', Object.keys(propertyData))
      }
    }

    // Ensure all expected fields are present (even if null)
    const finalData = {
      airbnbListingId: extractedData.airbnbListingId || listingId,
      airbnbUrl: extractedData.airbnbUrl || url,
      name: extractedData.name || null,
      nickname: extractedData.nickname || null,
      address: extractedData.address || null,
      city: extractedData.city || null,
      country: extractedData.country || null,
      description: extractedData.description || null,
      bedrooms: extractedData.bedrooms || null,
      bathrooms: extractedData.bathrooms || null,
      maxGuests: extractedData.maxGuests || null,
      amenities: extractedData.amenities || null,
      photos: extractedData.photos || [],
    }

    // Count how many fields were successfully extracted
    const extractedCount = Object.values(finalData).filter(v => v !== null && v !== undefined && (Array.isArray(v) ? v.length > 0 : true)).length
    const totalFields = Object.keys(finalData).length

    return NextResponse.json({
      success: true,
      data: finalData,
      message: `Property details extracted successfully (${extractedCount}/${totalFields} fields found)`,
    })
  } catch (error: any) {
    console.error('Airbnb scrape error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Failed to scrape Airbnb listing',
        message: 'Could not automatically extract property details. Please fill in manually.',
      },
      { status: 500 }
    )
  }
}

