/**
 * Twilio WhatsApp API Integration
 * Documentation: https://www.twilio.com/docs/whatsapp
 * 
 * Requirements:
 * - Twilio Account SID
 * - Twilio Auth Token
 * - Twilio WhatsApp-enabled phone number (format: whatsapp:+1234567890)
 * 
 * Note: For production, you need to:
 * 1. Set up a Twilio account
 * 2. Get a WhatsApp Business Account approved by Twilio
 * 3. Configure your WhatsApp sender number
 * 4. For initial messages, use approved message templates
 */

type WhatsAppConfigOverrides = {
  accountSid?: string
  authToken?: string
  fromNumber?: string
  whatsappEnabled?: boolean
  skipSend?: boolean
}

export interface WhatsAppMessageOptions {
  mediaUrl?: string[]
  actionUrl?: string
  actionText?: string
}

export interface WhatsAppTemplateOptions {
  contentSid?: string  // Template Content SID from Twilio
  contentVariables?: Record<string, string>  // Variables for the template (numbered: "1", "2", "3"...)
}

export async function sendWhatsApp(
  phoneNumber: string,
  message: string,
  options?: WhatsAppMessageOptions,
  config?: WhatsAppConfigOverrides,
  templateOptions?: WhatsAppTemplateOptions
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  // Get settings from database or environment variables
  const { prisma } = await import('@/lib/prisma')
  
  let accountSid = config?.accountSid ?? process.env.TWILIO_ACCOUNT_SID
  let authToken = config?.authToken ?? process.env.TWILIO_AUTH_TOKEN
  let fromNumber = config?.fromNumber ?? process.env.TWILIO_WHATSAPP_NUMBER
  let whatsappEnabled = config?.whatsappEnabled ?? true

  try {
    const settings = await prisma.setting.findMany({
      where: {
        key: {
          in: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_WHATSAPP_NUMBER', 'WHATSAPP_ENABLED'],
        },
      },
    })

    settings.forEach((setting) => {
      if (setting.key === 'TWILIO_ACCOUNT_SID' && config?.accountSid === undefined) {
        accountSid = setting.value
      }
      if (setting.key === 'TWILIO_AUTH_TOKEN' && config?.authToken === undefined) {
        authToken = setting.value
      }
      if (setting.key === 'TWILIO_WHATSAPP_NUMBER' && config?.fromNumber === undefined) {
        fromNumber = setting.value
      }
      if (setting.key === 'WHATSAPP_ENABLED' && config?.whatsappEnabled === undefined) {
        whatsappEnabled = setting.value === 'true'
      }
    })

    console.log('WhatsApp Settings loaded:', {
      hasAccountSid: !!accountSid,
      hasAuthToken: !!authToken,
      hasFromNumber: !!fromNumber,
      whatsappEnabled,
    })
  } catch (error) {
    console.warn('Failed to load WhatsApp settings from database, using environment variables:', error)
  }

  if (!whatsappEnabled) {
    return {
      success: false,
      error: 'WhatsApp notifications are disabled',
    }
  }

  if (!accountSid || !authToken || !fromNumber) {
    return {
      success: false,
      error: 'Twilio WhatsApp credentials are not configured. Please enter your Account SID, Auth Token, and WhatsApp number in Settings → WhatsApp (Twilio) and click "Save Changes".',
    }
  }

  // Format phone number for WhatsApp (E.164 format: +1234567890)
  const formattedPhone = formatPhoneNumberForWhatsApp(phoneNumber)

  // Ensure fromNumber is in whatsapp: format with proper E.164 format
  let formattedFrom = fromNumber.trim()
  
  // Remove 'whatsapp:' prefix if present to normalize
  if (formattedFrom.startsWith('whatsapp:')) {
    formattedFrom = formattedFrom.substring(9) // Remove 'whatsapp:' prefix
  }
  
  // Ensure it has + prefix (E.164 format)
  if (!formattedFrom.startsWith('+')) {
    formattedFrom = '+' + formattedFrom
  }
  
  // Add whatsapp: prefix back
  formattedFrom = `whatsapp:${formattedFrom}`

  // Ensure toNumber is in whatsapp: format
  const formattedTo = formattedPhone.startsWith('whatsapp:')
    ? formattedPhone
    : `whatsapp:${formattedPhone}`

  try {
    // Twilio WhatsApp API endpoint
    const apiUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`

    // Build message body
    let body = message
    
    // Add action button if provided (as text link since Twilio doesn't support buttons in all regions)
    if (options?.actionUrl && options?.actionText) {
      body += `\n\n${options.actionText}: ${options.actionUrl}`
    }

    // Prepare form data
    const formData = new URLSearchParams()
    formData.append('From', formattedFrom)
    formData.append('To', formattedTo)
    
    // Use Content API for templates (outside 24h window) or Body for session messages (within 24h)
    if (templateOptions?.contentSid) {
      // Template message - use Content API
      formData.append('ContentSid', templateOptions.contentSid)
      
      // Add content variables if provided
      if (templateOptions.contentVariables && Object.keys(templateOptions.contentVariables).length > 0) {
        const variables = JSON.stringify(templateOptions.contentVariables)
        formData.append('ContentVariables', variables)
      }
    } else {
      // Session message (within 24h) - use Body
      formData.append('Body', body)
    }

    // Add media URLs if provided
    if (options?.mediaUrl && options.mediaUrl.length > 0) {
      // Twilio supports one media URL per message, so we'll use the first one
      // For multiple media, you'd need to send multiple messages
      formData.append('MediaUrl', options.mediaUrl[0])
    }

    console.log('Sending WhatsApp request:', {
      url: apiUrl,
      from: formattedFrom,
      to: formattedTo,
      messageLength: body.length,
      hasMedia: !!(options?.mediaUrl && options.mediaUrl.length > 0),
      usingTemplate: !!(templateOptions?.contentSid),
    })

    // If we're just validating credentials, make a test request
    if (config?.skipSend) {
      // For validation, we'll try to get account info instead
      const validateUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`
      const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64')
      
      const resp = await fetch(validateUrl, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
        },
      })

      if (!resp.ok) {
        const errorText = await resp.text()
        return {
          success: false,
          error: `Twilio API returned status ${resp.status}: ${errorText}`,
        }
      }

      return { success: true, messageId: 'Credentials validated' }
    }

    // Create Basic Auth header
    const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64')

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    })

    const responseText = await response.text()

    console.log('Twilio WhatsApp API Response:', {
      status: response.status,
      statusText: response.statusText,
      body: responseText.substring(0, 500), // Log first 500 chars to avoid logging full response
    })

    if (!response.ok) {
      let errorMessage = 'Failed to send WhatsApp message'
      try {
        const errorData = JSON.parse(responseText)
        errorMessage = errorData.message || errorMessage
        
        // Handle specific Twilio error codes
        if (errorData.code === 21211) {
          errorMessage = 'Invalid phone number format. Please use E.164 format (e.g., +233XXXXXXXXX)'
        } else if (errorData.code === 21608) {
          errorMessage = 'WhatsApp number not approved or not in sandbox. Please check your Twilio WhatsApp setup. For testing, use Twilio sandbox number: whatsapp:+14155238886'
        } else if (errorData.code === 21610) {
          errorMessage = 'Message template not approved. For initial messages, you must use approved templates.'
        } else if (errorData.code === 21212) {
          errorMessage = 'Invalid "From" number. The WhatsApp number you provided is not set up in your Twilio account. Please verify the number in Twilio Console → Messaging → Try it out → Send a WhatsApp message, or use the sandbox number: whatsapp:+14155238886'
        } else if (errorData.code === 63016) {
          errorMessage = 'Message sent outside 24-hour window. Use a pre-approved message template. Go to Twilio Console → Content → Templates to create and approve templates. Then add the Content SID to lib/notifications/whatsapp-templates.ts'
        } else if (errorData.code === 21614) {
          errorMessage = 'WhatsApp template not found or not approved. Please verify the Content SID in your template configuration.'
        }
      } catch (e) {
        errorMessage = responseText || errorMessage
      }
      
      return {
        success: false,
        error: errorMessage,
      }
    }

    const data = JSON.parse(responseText)

    if (data.sid) {
      return {
        success: true,
        messageId: data.sid,
      }
    } else {
      return {
        success: false,
        error: 'Unexpected response from Twilio API',
      }
    }
  } catch (error: any) {
    console.error('WhatsApp sending error:', error)
    return {
      success: false,
      error: error.message || 'Failed to send WhatsApp message',
    }
  }
}

function formatPhoneNumberForWhatsApp(phone: string): string {
  // Remove all non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, '')

  // Remove leading + if present (we'll add it back)
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1)
  }

  // If it doesn't start with country code, assume Ghana (+233)
  if (!cleaned.startsWith('233')) {
    // If it starts with 0, replace with 233
    if (cleaned.startsWith('0')) {
      cleaned = '233' + cleaned.substring(1)
    } else {
      // Assume it's a Ghana number without country code
      cleaned = '233' + cleaned
    }
  }

  // Return in E.164 format (with +)
  return '+' + cleaned
}

