/**
 * Email Template for Newsletter Reports
 * HTML email template styled like Morning Brew
 */

import { NewsletterReport } from './ai-newsletter'
import { formatCurrency, Currency } from '@/lib/currency'

export function generateNewsletterEmailHTML(report: NewsletterReport): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${report.subject}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 40px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      border-bottom: 3px solid #ff6b35;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      margin: 0;
      color: #ff6b35;
      font-size: 28px;
      font-weight: 700;
    }
    .greeting {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 20px;
      color: #333;
    }
    .intro {
      font-size: 16px;
      margin-bottom: 30px;
      color: #555;
    }
    .section {
      margin-bottom: 35px;
      padding-bottom: 25px;
      border-bottom: 1px solid #e0e0e0;
    }
    .section:last-child {
      border-bottom: none;
    }
    .section-title {
      font-size: 22px;
      font-weight: 700;
      margin-bottom: 15px;
      color: #333;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .section-content {
      font-size: 15px;
      color: #555;
      line-height: 1.8;
      margin-bottom: 15px;
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
      margin-top: 15px;
      padding: 20px;
      background-color: #f9f9f9;
      border-radius: 6px;
    }
    .metric {
      text-align: center;
    }
    .metric-value {
      font-size: 24px;
      font-weight: 700;
      color: #ff6b35;
      margin-bottom: 5px;
    }
    .metric-label {
      font-size: 12px;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .highlights {
      background-color: #fff8f0;
      border-left: 4px solid #ff6b35;
      padding: 20px;
      margin: 30px 0;
      border-radius: 4px;
    }
    .highlights h3 {
      margin-top: 0;
      color: #ff6b35;
      font-size: 18px;
    }
    .highlights ul {
      margin: 10px 0;
      padding-left: 20px;
    }
    .highlights li {
      margin-bottom: 10px;
      color: #555;
    }
    .closing {
      font-size: 16px;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e0e0e0;
      color: #555;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e0e0e0;
      text-align: center;
      font-size: 12px;
      color: #888;
    }
    @media only screen and (max-width: 600px) {
      .container {
        padding: 20px;
      }
      .metrics-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>HostHub Report</h1>
    </div>
    
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
      <h3>📊 Quick Highlights</h3>
      <ul>
        ${report.highlights.map((h) => `<li>${h}</li>`).join('')}
      </ul>
    </div>
    ` : ''}
    
    <div class="closing">${report.closing}</div>
    
    <div class="footer">
      <p>This is an automated report from HostHub</p>
      <p>You're receiving this because you're subscribed to scheduled reports.</p>
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

