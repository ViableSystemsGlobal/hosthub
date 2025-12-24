/**
 * Hostinger SMTP Email Integration
 */

interface EmailOptions {
  to: string | string[]
  subject: string
  html: string
  text?: string
  from?: string
}

export async function sendEmail(
  options: EmailOptions
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  // Get settings from database or environment variables
  const { prisma } = await import('@/lib/prisma')
  
  let smtpHost = process.env.SMTP_HOST
  let smtpPort = process.env.SMTP_PORT || '587'
  let smtpUser = process.env.SMTP_USER
  let smtpPassword = process.env.SMTP_PASSWORD
  let smtpFrom = process.env.SMTP_FROM || smtpUser
  let emailEnabled = true

  try {
    const settings = await prisma.setting.findMany({
      where: {
        key: {
          in: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM', 'EMAIL_ENABLED'],
        },
      },
    })

    settings.forEach((setting) => {
      if (setting.key === 'SMTP_HOST') smtpHost = setting.value
      if (setting.key === 'SMTP_PORT') smtpPort = setting.value || '587'
      if (setting.key === 'SMTP_USER') smtpUser = setting.value
      if (setting.key === 'SMTP_PASSWORD') smtpPassword = setting.value
      if (setting.key === 'SMTP_FROM') smtpFrom = setting.value || smtpUser
      if (setting.key === 'EMAIL_ENABLED') emailEnabled = setting.value === 'true'
    })
  } catch (error) {
    console.warn('Failed to load email settings from database, using environment variables:', error)
  }

  if (!emailEnabled) {
    return {
      success: false,
      error: 'Email notifications are disabled',
    }
  }

  if (!smtpHost || !smtpUser || !smtpPassword) {
    throw new Error('SMTP configuration is incomplete. Please configure SMTP settings')
  }

  try {
    // Use nodemailer for SMTP sending
    const nodemailer = await import('nodemailer')

    const transporter = nodemailer.default.createTransport({
      // @ts-ignore - nodemailer types are incorrect for v7
      host: smtpHost as string,
      port: parseInt(smtpPort) as number,
      secure: parseInt(smtpPort) === 465, // true for 465, false for other ports
      auth: {
        user: smtpUser as string,
        pass: smtpPassword as string,
      },
      // Increase timeouts for Hostinger and other slow SMTP servers
      connectionTimeout: 30000, // 30 seconds
      greetingTimeout: 30000, // 30 seconds
      socketTimeout: 30000, // 30 seconds
      // Enable connection pooling for better reliability
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      // Retry configuration
      retry: {
        attempts: 3,
        delay: 2000, // 2 seconds between retries
      },
      // TLS options for better compatibility
      tls: {
        rejectUnauthorized: false, // Some SMTP servers have self-signed certificates
        minVersion: 'TLSv1.2',
      },
    })

    const mailOptions = {
      from: options.from || smtpFrom,
      to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
      subject: options.subject,
      text: options.text || stripHtml(options.html),
      html: options.html,
    }

    // Retry logic with exponential backoff
    let lastError: any = null
    const maxRetries = 3
    const retryDelays = [2000, 5000, 10000] // 2s, 5s, 10s

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const info = await transporter.sendMail(mailOptions)
        
        return {
          success: true,
          messageId: info.messageId,
        }
      } catch (error: any) {
        lastError = error
        const isTimeoutError = 
          error.message?.includes('timeout') ||
          error.message?.includes('ETIMEDOUT') ||
          error.code === 'ETIMEDOUT' ||
          error.code === 'ECONNRESET'

        // If it's a timeout error and we have retries left, wait and retry
        if (isTimeoutError && attempt < maxRetries - 1) {
          const delay = retryDelays[attempt] || 5000
          console.warn(`Email send attempt ${attempt + 1} failed (timeout). Retrying in ${delay}ms...`)
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }

        // If it's not a timeout or we're out of retries, throw
        throw error
      }
    }

    // If we get here, all retries failed
    throw lastError
  } catch (error: any) {
    console.error('Email sending error:', error)
    
    // Provide more helpful error messages
    let errorMessage = error.message || 'Failed to send email'
    
    if (error.message?.includes('timeout') || error.code === 'ETIMEDOUT') {
      errorMessage = `SMTP timeout: The email server took too long to respond. This could be due to network issues or server overload. Please try again later or check your SMTP settings.`
    } else if (error.code === 'ECONNREFUSED') {
      errorMessage = `SMTP connection refused: Unable to connect to ${smtpHost}:${smtpPort}. Please check your SMTP host and port settings.`
    } else if (error.code === 'EAUTH') {
      errorMessage = `SMTP authentication failed: Please check your SMTP username and password.`
    }
    
    return {
      success: false,
      error: errorMessage,
    }
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
}

/**
 * Generate HTML email templates
 */
export function generateEmailTemplate(title: string, content: string, actionUrl?: string, actionText?: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f97316; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="margin: 0;">HostHub</h1>
  </div>
  <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <h2 style="color: #f97316; margin-top: 0;">${title}</h2>
    <div style="margin: 20px 0;">
      ${content}
    </div>
    ${actionUrl && actionText ? `
    <div style="margin: 30px 0; text-align: center;">
      <a href="${actionUrl}" style="background-color: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
        ${actionText}
      </a>
    </div>
    ` : ''}
  </div>
  <div style="text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px;">
    <p>This is an automated message from HostHub. Please do not reply to this email.</p>
  </div>
</body>
</html>
  `.trim()
}

