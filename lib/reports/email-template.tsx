/**
 * Email Template for Newsletter Reports
 * HTML email template styled like Paystack
 */

import { NewsletterReport } from './ai-newsletter'
import { formatCurrency, Currency } from '@/lib/currency'
import { prisma } from '@/lib/prisma'

export async function generateNewsletterEmailHTML(report: NewsletterReport): Promise<string> {
  // Get logo URL from settings
  const logoSetting = await prisma.setting.findUnique({
    where: { key: 'APP_LOGO' },
  })
  const logoUrl = logoSetting?.value 
    ? (typeof window !== 'undefined' 
        ? window.location.origin 
        : process.env.NEXT_PUBLIC_APP_URL || 'https://hosthub.byaurarealty.com') + logoSetting.value
    : null
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://hosthub.byaurarealty.com'
  const logoSrc = logoUrl || `${baseUrl}/icon-512.png`

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${report.subject}</title>
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
    .intro {
      font-size: 15px;
      line-height: 1.7;
      margin-bottom: 30px;
      color: #4a4a4a;
    }
    .section {
      margin-bottom: 35px;
      padding-bottom: 25px;
      border-bottom: 1px solid #e5e5e5;
    }
    .section:last-of-type {
      border-bottom: none;
    }
    .section-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 12px;
      color: #1a1a1a;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .section-content {
      font-size: 14px;
      line-height: 1.7;
      color: #4a4a4a;
      margin-bottom: 15px;
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
      margin-top: 20px;
      padding: 20px;
      background-color: #fafafa;
      border-radius: 4px;
    }
    .metric {
      text-align: center;
    }
    .metric-value {
      font-size: 20px;
      font-weight: 600;
      color: #1a1a1a;
      margin-bottom: 4px;
    }
    .metric-label {
      font-size: 11px;
      color: #8a8a8a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .highlights {
      background-color: #fafafa;
      border-left: 3px solid #1a1a1a;
      padding: 20px;
      margin: 30px 0;
      border-radius: 0 4px 4px 0;
    }
    .highlights h3 {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 12px;
      color: #1a1a1a;
    }
    .highlights ul {
      margin: 0;
      padding-left: 20px;
    }
    .highlights li {
      margin-bottom: 8px;
      font-size: 14px;
      color: #4a4a4a;
      line-height: 1.6;
    }
    .closing {
      font-size: 14px;
      line-height: 1.7;
      margin-top: 30px;
      padding-top: 25px;
      border-top: 1px solid #e5e5e5;
      color: #4a4a4a;
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
      .metrics-grid {
        grid-template-columns: 1fr;
        gap: 15px;
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
      <div class="greeting">${report.greeting}</div>
      
      <div class="intro">${report.intro}</div>
      
      ${report.sections
        .map(
          (section) => `
        <div class="section">
          <div class="section-title">
            ${section.emoji ? `<span>${section.emoji}</span>` : ''}
            <span>${section.title}</span>
          </div>
          <div class="section-content">${section.content.replace(/\n/g, '<br>')}</div>
          ${
            section.metrics
              ? `
          <div class="metrics-grid">
            ${Object.entries(section.metrics)
              .map(
                ([key, value]) => `
            <div class="metric">
              <div class="metric-value">${formatMetricValue(key, value)}</div>
              <div class="metric-label">${formatMetricLabel(key)}</div>
            </div>
            `
              )
              .join('')}
          </div>
          `
              : ''
          }
        </div>
        `
        )
        .join('')}
      
      ${report.highlights.length > 0 ? `
      <div class="highlights">
        <h3>Key Highlights</h3>
        <ul>
          ${report.highlights.map((h) => `<li>${h}</li>`).join('')}
        </ul>
      </div>
      ` : ''}
      
      <div class="closing">${report.closing}</div>
    </div>
    
    <div class="footer">
      <p>This is an automated report from HostHub</p>
      <p>You're receiving this because you're subscribed to scheduled reports.</p>
      <p class="footer-brand">Hosthub by Aura Realty</p>
    </div>
  </div>
</body>
</html>
  `.trim()
}

function formatMetricValue(key: string, value: any): string {
  if (typeof value === 'number') {
    if (key.toLowerCase().includes('revenue') || key.toLowerCase().includes('profit') || key.toLowerCase().includes('expense')) {
      return formatCurrency(value, Currency.GHS)
    }
    if (key.toLowerCase().includes('percent') || key.toLowerCase().includes('occupancy')) {
      return `${value.toFixed(1)}%`
    }
    return value.toLocaleString()
  }
  return String(value)
}

function formatMetricLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim()
}

