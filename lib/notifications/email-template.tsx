/**
 * Reusable Paystack-style Email Template
 * Used for all emails sent from the system
 */

import { prisma } from '@/lib/prisma'

export interface EmailTemplateOptions {
  title?: string
  greeting?: string
  content: string
  actionUrl?: string
  actionText?: string
  footerText?: string
}

export async function generatePaystackStyleEmailHTML(options: EmailTemplateOptions): Promise<string> {
  const {
    title = 'HostHub Notification',
    greeting,
    content,
    actionUrl,
    actionText,
    footerText,
  } = options

  // Get logo URL from settings
  const logoSetting = await prisma.setting.findUnique({
    where: { key: 'APP_LOGO' },
  })
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://hosthub.byaurarealty.com'
  const logoUrl = logoSetting?.value 
    ? (logoSetting.value.startsWith('http') 
        ? logoSetting.value
        : `${baseUrl}${logoSetting.value.startsWith('/') ? '' : '/'}${logoSetting.value}`)
    : null
  const logoSrc = logoUrl || `${baseUrl}/icon-512.png`

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1a1a1a;
      background-color: #f5f5f5;
      padding: 0;
      margin: 0;
    }
    .email-wrapper {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .logo-container {
      text-align: center;
      padding: 40px 20px 30px;
      border-bottom: 1px solid #e5e5e5;
    }
    .logo-container img {
      max-width: 180px;
      height: auto;
    }
    .content {
      padding: 40px 40px 30px;
    }
    .greeting {
      font-size: 16px;
      font-weight: 400;
      margin-bottom: 20px;
      color: #1a1a1a;
    }
    .body-content {
      font-size: 15px;
      line-height: 1.7;
      margin-bottom: 30px;
      color: #4a4a4a;
    }
    .action-button {
      margin: 30px 0;
      text-align: center;
    }
    .action-button a {
      display: inline-block;
      background-color: #1a1a1a;
      color: #ffffff;
      padding: 14px 28px;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 500;
      font-size: 15px;
    }
    .action-button a:hover {
      background-color: #333333;
    }
    .footer {
      margin-top: 40px;
      padding: 30px 40px;
      background-color: #fafafa;
      text-align: center;
      font-size: 12px;
      color: #8a8a8a;
      border-top: 1px solid #e5e5e5;
    }
    .footer p {
      margin-bottom: 4px;
    }
    .footer-brand {
      font-weight: 500;
      color: #1a1a1a;
      margin-top: 8px;
    }
    @media only screen and (max-width: 600px) {
      .content {
        padding: 30px 20px 20px;
      }
      .logo-container {
        padding: 30px 20px 20px;
      }
      .footer {
        padding: 20px;
      }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="logo-container">
      <img src="${logoSrc}" alt="HostHub" style="max-width: 180px; height: auto;" />
    </div>
    
    <div class="content">
      ${greeting ? `<div class="greeting">${greeting}</div>` : ''}
      
      <div class="body-content">${content.replace(/\n/g, '<br>')}</div>
      
      ${actionUrl && actionText ? `
      <div class="action-button">
        <a href="${actionUrl}">${actionText}</a>
      </div>
      ` : ''}
    </div>
    
    <div class="footer">
      ${footerText ? `<p>${footerText}</p>` : ''}
      <p>This is an automated message from HostHub</p>
      <p class="footer-brand">Hosthub by Aura Realty</p>
    </div>
  </div>
</body>
</html>
  `.trim()
}

