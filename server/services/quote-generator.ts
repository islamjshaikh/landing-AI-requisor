import { storage } from "../storage";
import { BudgetEstimate, BudgetLineItem, Project } from "@shared/schema";
import { MailService } from '@sendgrid/mail';

interface QuoteData {
  estimate: BudgetEstimate;
  lineItems: BudgetLineItem[];
  project: Project;
  categorySummary: {
    [category: string]: {
      hours: number;
      amount: number;
    };
  };
}

export class QuoteGenerator {
  private mailService?: MailService;

  constructor() {
    if (process.env.SENDGRID_API_KEY) {
      this.mailService = new MailService();
      this.mailService.setApiKey(process.env.SENDGRID_API_KEY);
    }
  }

  async generateQuoteHTML(budgetId: number): Promise<string> {
    const quoteData = await this.getQuoteData(budgetId);
    if (!quoteData) {
      throw new Error("Budget estimate not found");
    }

    return this.generateHTMLTemplate(quoteData);
  }

  private async getQuoteData(budgetId: number): Promise<QuoteData | null> {
    const estimate = await storage.getBudgetEstimate(budgetId);
    if (!estimate) return null;

    const lineItems = await storage.getBudgetLineItems(budgetId);
    const project = await storage.getProject(estimate.projectId);
    if (!project) return null;

    // Calculate category summary
    const categorySummary: { [category: string]: { hours: number; amount: number } } = {};
    for (const item of lineItems) {
      if (!categorySummary[item.category]) {
        categorySummary[item.category] = { hours: 0, amount: 0 };
      }
      categorySummary[item.category].hours += item.hours;
      categorySummary[item.category].amount += item.totalAmount;
    }

    return {
      estimate,
      lineItems,
      project,
      categorySummary
    };
  }

  private generateHTMLTemplate(data: QuoteData): string {
    const { estimate, lineItems, project, categorySummary } = data;
    
    const formatCurrency = (cents: number) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: estimate.currency || 'USD'
      }).format(cents / 100);
    };

    const formatDate = (date: Date | string | null) => {
      if (!date) return 'N/A';
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Project Quote - ${project.name}</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: #f8f9fa;
        }
        
        .quote-container {
            background: white;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px;
            text-align: center;
        }
        
        .header h1 {
            margin: 0 0 10px 0;
            font-size: 2.5rem;
            font-weight: 300;
        }
        
        .header p {
            margin: 0;
            opacity: 0.9;
        }
        
        .content {
            padding: 40px;
        }
        
        .section {
            margin-bottom: 30px;
        }
        
        .section-title {
            font-size: 1.25rem;
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 15px;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 5px;
        }
        
        .project-info {
            background: #f7fafc;
            padding: 20px;
            border-radius: 6px;
            border-left: 4px solid #667eea;
        }
        
        .client-info {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }
        
        .info-item {
            background: #f7fafc;
            padding: 15px;
            border-radius: 6px;
        }
        
        .info-label {
            font-weight: 600;
            color: #4a5568;
            margin-bottom: 5px;
        }
        
        .info-value {
            color: #2d3748;
        }
        
        .line-items-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .line-items-table th {
            background: #4a5568;
            color: white;
            padding: 12px;
            text-align: left;
            font-weight: 600;
        }
        
        .line-items-table td {
            padding: 12px;
            border-bottom: 1px solid #e2e8f0;
        }
        
        .line-items-table tr:nth-child(even) {
            background: #f7fafc;
        }
        
        .category-summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }
        
        .category-card {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
        }
        
        .category-name {
            font-size: 1.1rem;
            font-weight: 600;
            margin-bottom: 10px;
        }
        
        .category-hours {
            font-size: 0.9rem;
            opacity: 0.9;
            margin-bottom: 5px;
        }
        
        .category-amount {
            font-size: 1.5rem;
            font-weight: 700;
        }
        
        .total-section {
            background: #2d3748;
            color: white;
            padding: 25px;
            border-radius: 8px;
            text-align: center;
            margin: 30px 0;
        }
        
        .total-amount {
            font-size: 3rem;
            font-weight: 700;
            margin: 10px 0;
        }
        
        .terms {
            background: #fff5f5;
            border: 1px solid #feb2b2;
            border-radius: 6px;
            padding: 20px;
            margin: 20px 0;
        }
        
        .terms h4 {
            color: #c53030;
            margin-top: 0;
        }
        
        .footer {
            text-align: center;
            padding: 30px;
            border-top: 1px solid #e2e8f0;
            color: #718096;
        }
        
        .role-badge {
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.75rem;
            font-weight: 500;
        }
        
        @media print {
            body { background: white; }
            .quote-container { box-shadow: none; }
        }
    </style>
</head>
<body>
    <div class="quote-container">
        <div class="header">
            <h1>Project Quote</h1>
            <p>Professional Development Services</p>
        </div>
        
        <div class="content">
            <div class="section">
                <div class="section-title">Project Overview</div>
                <div class="project-info">
                    <h3>${project.name}</h3>
                    <p>${project.description || 'No description provided'}</p>
                </div>
            </div>
            
            <div class="section">
                <div class="section-title">Quote Information</div>
                <div class="client-info">
                    <div class="info-item">
                        <div class="info-label">Quote Date</div>
                        <div class="info-value">${formatDate(estimate.createdAt)}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Valid Until</div>
                        <div class="info-value">${formatDate(estimate.validUntil)}</div>
                    </div>
                    ${estimate.clientName ? `
                    <div class="info-item">
                        <div class="info-label">Client</div>
                        <div class="info-value">${estimate.clientName}</div>
                    </div>
                    ` : ''}
                    ${estimate.clientCompany ? `
                    <div class="info-item">
                        <div class="info-label">Company</div>
                        <div class="info-value">${estimate.clientCompany}</div>
                    </div>
                    ` : ''}
                </div>
            </div>
            
            <div class="section">
                <div class="section-title">Project Breakdown</div>
                <table class="line-items-table">
                    <thead>
                        <tr>
                            <th>Task</th>
                            <th>Category</th>
                            <th>Role</th>
                            <th>Hours</th>
                            <th>Rate</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${lineItems.map(item => `
                        <tr>
                            <td>${item.description}</td>
                            <td>${item.category}</td>
                            <td><span class="role-badge">${item.role}</span></td>
                            <td>${item.hours}h</td>
                            <td>${formatCurrency(item.rate)}/hr</td>
                            <td><strong>${formatCurrency(item.totalAmount)}</strong></td>
                        </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            
            <div class="section">
                <div class="section-title">Category Summary</div>
                <div class="category-summary">
                    ${Object.entries(categorySummary).map(([category, summary]) => `
                    <div class="category-card">
                        <div class="category-name">${category}</div>
                        <div class="category-hours">${summary.hours} hours</div>
                        <div class="category-amount">${formatCurrency(summary.amount)}</div>
                    </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="total-section">
                <h3>Total Project Cost</h3>
                <div class="total-amount">${formatCurrency(estimate.totalAmount)}</div>
                <p>Estimated total for complete project delivery</p>
            </div>
            
            ${estimate.terms ? `
            <div class="terms">
                <h4>Terms & Conditions</h4>
                <p>${estimate.terms}</p>
            </div>
            ` : ''}
            
            ${estimate.notes ? `
            <div class="section">
                <div class="section-title">Additional Notes</div>
                <p>${estimate.notes}</p>
            </div>
            ` : ''}
        </div>
        
        <div class="footer">
            <p>Generated by Requisor AI Budget Agent • ${formatDate(new Date())}</p>
            <p>This quote is valid until ${formatDate(estimate.validUntil)}</p>
        </div>
    </div>
</body>
</html>`;
  }

  async emailQuote(budgetId: number, recipientEmail: string, senderEmail: string): Promise<boolean> {
    if (!this.mailService) {
      throw new Error("Email service not configured. SENDGRID_API_KEY required.");
    }

    const quoteData = await this.getQuoteData(budgetId);
    if (!quoteData) {
      throw new Error("Budget estimate not found");
    }

    const htmlContent = this.generateHTMLTemplate(quoteData);
    
    try {
      await this.mailService.send({
        to: recipientEmail,
        from: senderEmail,
        subject: `Project Quote: ${quoteData.project.name}`,
        html: htmlContent,
        text: `Project Quote for ${quoteData.project.name}\n\nTotal: ${new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: quoteData.estimate.currency || 'USD'
        }).format(quoteData.estimate.totalAmount / 100)}\n\nPlease see the attached HTML version for full details.`
      });
      
      return true;
    } catch (error) {
      console.error('Email sending failed:', error);
      throw new Error('Failed to send quote email');
    }
  }
}