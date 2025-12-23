/**
 * Deywuro SMS API Integration
 * Documentation: https://www.deywuro.com/NewUI/Landing/images/NPONTU_SMS_API_DOCUMENT_NEW.pdf
 * 
 * API Endpoint: https://deywuro.com/api/sms
 * Methods: POST or GET
 * 
 * Parameters:
 * - username: Client deywuro username
 * - password: Client deywuro password
 * - destination: target phone number(s), comma-separated for multiple
 * - source: sender title (max 11 characters, alphanumeric)
 * - message: SMS content
 * 
 * Response Codes:
 * - 0: Success
 * - 401: Invalid Credential
 * - 403: Insufficient balance
 * - 404: Not routable
 * - 500: Others
 * - 402: Missing required fields
 */

interface DeywuroSMSResponse {
  code: number
  message: string
}

type SMSConfigOverrides = {
  username?: string
  password?: string
  source?: string
  smsEnabled?: boolean
  skipSend?: boolean
}

export async function sendSMS(
  phoneNumber: string,
  message: string,
  config?: SMSConfigOverrides
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  // Get settings from database or environment variables
  const { prisma } = await import('@/lib/prisma')
  
  let username = config?.username ?? process.env.DEYWURO_USERNAME
  let password = config?.password ?? process.env.DEYWURO_PASSWORD
  let source = 'HostHub'
  if (config?.source !== undefined && config.source !== null && config.source !== '') {
    source = config.source
  } else if (process.env.DEYWURO_SOURCE) {
    source = process.env.DEYWURO_SOURCE
  }
  let smsEnabled = config?.smsEnabled ?? true

  try {
    const settings = await prisma.setting.findMany({
      where: {
        key: {
          in: ['DEYWURO_USERNAME', 'DEYWURO_PASSWORD', 'DEYWURO_SOURCE', 'SMS_ENABLED'],
        },
      },
    })

    settings.forEach((setting) => {
      if (setting.key === 'DEYWURO_USERNAME' && config?.username === undefined) username = setting.value
      if (setting.key === 'DEYWURO_PASSWORD' && config?.password === undefined) password = setting.value
      if (setting.key === 'DEYWURO_SOURCE' && config?.source === undefined) source = setting.value || 'HostHub'
      if (setting.key === 'SMS_ENABLED' && config?.smsEnabled === undefined) smsEnabled = setting.value === 'true'
    })

    // Debug logging (remove sensitive data in production)
    console.log('SMS Settings loaded:', {
      hasUsername: !!username,
      hasPassword: !!password,
      source,
      smsEnabled,
    })
  } catch (error) {
    console.warn('Failed to load SMS settings from database, using environment variables:', error)
  }

  if (!smsEnabled) {
    return {
      success: false,
      error: 'SMS notifications are disabled',
    }
  }

  if (!username || !password) {
    return {
      success: false,
      error: 'Deywuro credentials are not configured. Please enter your username and password in Settings → SMS (Deywuro) and click "Save Changes".',
    }
  }

  // Format phone number (remove spaces, ensure it starts with country code)
  const formattedPhone = formatPhoneNumber(phoneNumber)

  // Validate source (max 11 characters, alphanumeric)
  const validatedSource = source.substring(0, 11).replace(/[^a-zA-Z0-9]/g, '')

  try {
    // Deywuro API endpoint
    const apiUrl = 'https://deywuro.com/api/sms'

    // Use POST method with form data
    const formData = new URLSearchParams()
    formData.append('username', username.trim())
    formData.append('password', password.trim())
    formData.append('destination', formattedPhone)
    formData.append('source', validatedSource)
    formData.append('message', message)

    console.log('Sending SMS request:', {
      url: apiUrl,
      username: username.trim(),
      passwordLength: password.trim().length,
      destination: formattedPhone,
      source: validatedSource,
      messageLength: message.length,
    })

    const doRequest = async () => {
      const resp = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      })
      const body = await resp.text()
      return { resp, body }
    }

    // If we're just validating credentials, still call API but treat non-routing codes as success.
    if (config?.skipSend) {
      const { resp, body } = await doRequest()
      if (!resp.ok) {
        return {
          success: false,
          error: `SMS API returned status ${resp.status}: ${body}`,
        }
      }
      try {
        const parsed = JSON.parse(body) as DeywuroSMSResponse
        if (parsed.code === 0 || parsed.code === 402 || parsed.code === 404) {
          return { success: true, messageId: parsed.message }
        }
        return { success: false, error: parsed.message || 'Failed to validate credentials' }
      } catch (e) {
        return { success: false, error: 'Invalid response from Deywuro API' }
      }
    }

    const { resp: response, body: responseText } = await doRequest()

    console.log('Deywuro API Response:', {
      status: response.status,
      statusText: response.statusText,
      body: responseText,
    })

    if (!response.ok) {
      throw new Error(`SMS API returned status ${response.status}: ${responseText}`)
    }

    let data: DeywuroSMSResponse
    try {
      data = JSON.parse(responseText)
    } catch (parseError) {
      console.error('Failed to parse Deywuro response as JSON:', responseText)
      throw new Error(`Invalid response from Deywuro API: ${responseText}`)
    }

    // Check response code
    if (data.code === 0) {
      return {
        success: true,
        messageId: data.message, // The message contains success info like "1 sms successfully sent!"
      }
    } else {
      // Map error codes to messages
      let errorMessage = data.message || 'Failed to send SMS'
      switch (data.code) {
        case 401:
          errorMessage = 'Invalid Deywuro credentials. Please check your username and password in Settings → SMS (Deywuro) and ensure they are correct.'
          break
        case 403:
          errorMessage = 'Insufficient balance in Deywuro account'
          break
        case 404:
          errorMessage = 'Phone number not routable'
          break
        case 402:
          errorMessage = 'Missing required fields'
          break
        case 500:
          errorMessage = 'Deywuro server error'
          break
      }
      return {
        success: false,
        error: errorMessage,
      }
    }
  } catch (error: any) {
    console.error('SMS sending error:', error)
    return {
      success: false,
      error: error.message || 'Failed to send SMS',
    }
  }
}

function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '')

  // If it doesn't start with country code, assume Ghana (+233)
  if (!cleaned.startsWith('233') && !cleaned.startsWith('+233')) {
    // If it starts with 0, replace with 233
    if (cleaned.startsWith('0')) {
      cleaned = '233' + cleaned.substring(1)
    } else {
      // Assume it's a Ghana number without country code
      cleaned = '233' + cleaned
    }
  }

  return cleaned
}
