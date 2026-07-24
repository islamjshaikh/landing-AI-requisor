import OpenAI from "openai";
import { getAiClient } from "./ai-provider";
import { trackTokenUsage } from "./token-tracker";
import { persistMemory } from "./agent-memory";

interface ScopeAnswers {
  [key: string]: any;
}

interface ClientInfo {
  name: string;
  email: string;
  company: string;
  budget?: number;
}

interface CustomRates {
  [role: string]: number;
}

interface BudgetLineItem {
  id: string;
  category: string;
  description: string;
  role: string;
  hours: number;
  rate: number;
  total: number;
  isFixed?: boolean;
  notes?: string;
}

interface AIEstimation {
  lineItems: BudgetLineItem[];
  totalHours: number;
  totalCost: number;
  timeline: string;
  assumptions: string[];
  recommendations: string[];
  risks: string[];
}

// Enhanced rate reference data with agency-specific roles
const ADVANCED_REFERENCE_DATA = {
  rates: {
    strategist: 12000, // $120/hour in cents
    designer: 9000,   // $90/hour
    developer: 10500, // $105/hour
    pm: 11000,        // $110/hour (project manager)
    qa: 7500,         // $75/hour
    copywriter: 6000, // $60/hour
    analyst: 9500,    // $95/hour
    consultant: 13500, // $135/hour
  },
  
  projectTypes: {
    branding: {
      baseMultiplier: 1.2,
      commonRoles: ['strategist', 'designer', 'copywriter', 'pm', 'brand_specialist'],
      phases: ['Discovery & Research', 'Brand Strategy', 'Visual Identity Design', 'Brand Guidelines', 'Implementation & Rollout', 'Brand Training']
    },
    web_development: {
      baseMultiplier: 1.0,
      commonRoles: ['developer', 'designer', 'pm', 'qa', 'devops', 'architect', 'security_engineer'],
      phases: ['Technical Discovery', 'Architecture Design', 'UI/UX Design', 'Frontend Development', 'Backend Development', 'Integration & APIs', 'Testing & QA', 'Security Hardening', 'Deployment & Launch', 'Post-Launch Support']
    },
    mobile_app: {
      baseMultiplier: 1.4,
      commonRoles: ['mobile_developer', 'designer', 'pm', 'qa', 'devops', 'backend_developer'],
      phases: ['App Strategy', 'Technical Architecture', 'UI/UX Design', 'iOS Development', 'Android Development', 'Backend APIs', 'Device Testing', 'App Store Preparation', 'Submission & Review', 'Post-Launch Updates']
    },
    saas_platform: {
      baseMultiplier: 1.5,
      commonRoles: ['architect', 'developer', 'designer', 'pm', 'qa', 'devops', 'security_engineer', 'data_engineer'],
      phases: ['Platform Architecture', 'Core Infrastructure', 'Authentication & Security', 'Feature Development', 'Payment Integration', 'Admin Dashboard', 'API Development', 'Performance Optimization', 'Deployment Pipeline', 'Monitoring Setup']
    },
    marketing: {
      baseMultiplier: 1.1,
      commonRoles: ['strategist', 'copywriter', 'designer', 'analyst', 'seo_specialist', 'ppc_specialist'],
      phases: ['Market Research', 'Strategy Development', 'Content Planning', 'Creative Development', 'Campaign Setup', 'Launch & Distribution', 'Performance Tracking', 'Optimization Cycles']
    },
    consulting: {
      baseMultiplier: 1.5,
      commonRoles: ['consultant', 'analyst', 'strategist', 'subject_matter_expert', 'pm'],
      phases: ['Stakeholder Interviews', 'Current State Assessment', 'Gap Analysis', 'Solution Design', 'Implementation Planning', 'Change Management', 'Training & Documentation', 'Success Measurement']
    },
    ecommerce: {
      baseMultiplier: 1.3,
      commonRoles: ['developer', 'designer', 'pm', 'qa', 'payment_specialist', 'seo_specialist'],
      phases: ['Platform Selection', 'Store Design', 'Product Catalog Setup', 'Payment Gateway Integration', 'Shipping Configuration', 'Tax & Compliance', 'Testing & QA', 'Launch Preparation', 'Marketing Integration']
    },
    enterprise_integration: {
      baseMultiplier: 1.8,
      commonRoles: ['architect', 'integration_engineer', 'pm', 'qa', 'security_engineer', 'data_engineer'],
      phases: ['System Analysis', 'Integration Architecture', 'Security Assessment', 'API Development', 'Data Mapping', 'Middleware Setup', 'Testing & Validation', 'Performance Tuning', 'Documentation', 'Handover & Training']
    }
  },

  complexityMultipliers: {
    'Simple': 0.8,
    'Medium': 1.0,
    'Complex': 1.4,
    'Enterprise': 2.0
  },

  timelineMultipliers: {
    '2-4 weeks': 1.3,  // Rush job
    '1-2 months': 1.0, // Normal
    '3-4 months': 0.9, // Extended timeline
    '6+ months': 0.8   // Long-term project
  }
};

export class AdvancedBudgetAgent {
  private openai: OpenAI;

  constructor() {
    // No hard OPENAI_API_KEY requirement: getAiClient() resolves the provider
    // per user at call time (own Claude key or platform default).
    this.openai = (getAiClient() as any);
  }

  async generateAdvancedEstimation(
    projectType: string,
    scopeAnswers: ScopeAnswers,
    customRates: CustomRates,
    clientInfo: ClientInfo,
    /** Optional. When supplied, the call is logged to long-term memory. */
    userId?: string,
  ): Promise<AIEstimation> {
    console.log("AdvancedBudgetAgent: Starting advanced estimation generation...");

    const prompt = this.buildAdvancedPrompt(projectType, scopeAnswers, customRates, clientInfo);

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a senior technical project estimator with 15+ years of experience across enterprise software, mobile apps, SaaS platforms, and complex integrations. You've managed projects from startups to Fortune 500 companies and understand the hidden complexities that generic estimators miss.

CRITICAL EXPERTISE AREAS:
1. **Mobile App Development**: App store compliance, iOS/Android differences, submission processes, review cycles, version fragmentation, device testing matrices
2. **Third-Party Integrations**: API rate limits, authentication flows, data mapping complexity, webhook reliability, sandbox limitations, vendor documentation quality
3. **Infrastructure & DevOps**: CI/CD pipelines, environment management, security compliance, load testing, monitoring setup, disaster recovery
4. **Hidden Complexities**: Legal reviews, accessibility compliance, internationalization, performance optimization, security audits, data migration
5. **Industry-Specific Requirements**: HIPAA for healthcare, PCI-DSS for payments, GDPR for EU, SOC2 for enterprise, COPPA for children's apps

YOUR ESTIMATION APPROACH:
- Identify ALL hidden tasks that junior estimators miss
- Account for real-world friction (vendor delays, technical debt, integration surprises)
- Include buffer for discoveries made during implementation
- Consider team ramp-up time and knowledge transfer
- Factor in client-side delays and approval cycles
- Add specific line items for often-forgotten tasks

PROJECT TYPE: ${projectType}

Generate estimates that experienced CTOs would approve, not generic templates.`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7, // Increased for more creative, detailed estimates
        max_tokens: 4000, // Allow for comprehensive responses
      });

      if (response.usage) {
        trackTokenUsage("system", "advanced-budget-estimation", "gpt-4o", response.usage).catch(() => {});
      }

      const responseContent = response.choices[0].message?.content;
      if (!responseContent) {
        throw new Error('No response content from OpenAI');
      }

      const aiResult = JSON.parse(responseContent);
      console.log("AdvancedBudgetAgent: AI estimation generated successfully");

      // Long-term memory log.
      void persistMemory({
        ctx: { userId, agentName: "advanced-budget-agent", retrieve: false },
        userQuery: prompt.slice(0, 4000),
        agentResponse: responseContent,
      });

      // Validate and enhance the response
      return this.validateAndEnhanceEstimation(aiResult, projectType, customRates);

    } catch (error) {
      console.error('AdvancedBudgetAgent error:', error);
      
      // Fallback to algorithmic estimation
      console.log("AdvancedBudgetAgent: Using fallback estimation");
      return this.generateFallbackEstimation(projectType, scopeAnswers, customRates);
    }
  }

  private buildAdvancedPrompt(
    projectType: string,
    scopeAnswers: ScopeAnswers,
    customRates: CustomRates,
    clientInfo: ClientInfo
  ): string {
    const projectConfig = ADVANCED_REFERENCE_DATA.projectTypes[projectType as keyof typeof ADVANCED_REFERENCE_DATA.projectTypes];
    
    // Extract technical details from scope answers
    const hasMobileApp = scopeAnswers.platforms?.includes('mobile') || 
                        scopeAnswers.features?.includes('mobile app') ||
                        scopeAnswers.description?.toLowerCase().includes('mobile') ||
                        scopeAnswers.description?.toLowerCase().includes('ios') ||
                        scopeAnswers.description?.toLowerCase().includes('android');
    
    const hasIntegrations = scopeAnswers.integrations?.length > 0 || 
                           scopeAnswers.features?.includes('third party') ||
                           scopeAnswers.description?.toLowerCase().includes('integration') ||
                           scopeAnswers.description?.toLowerCase().includes('api');
    
    const isEnterprise = scopeAnswers.complexity === 'Enterprise' || 
                        scopeAnswers.scale === 'enterprise' ||
                        clientInfo.budget > 100000;
    
    return `
Generate a HIGHLY DETAILED budget estimation for a ${projectType.replace('_', ' ')} project.

PROJECT SCOPE:
${Object.entries(scopeAnswers).map(([key, value]) => `- ${key}: ${Array.isArray(value) ? value.join(', ') : value}`).join('\n')}

CLIENT CONTEXT:
- Company: ${clientInfo.company}
- Budget Range: ${clientInfo.budget ? `$${clientInfo.budget.toLocaleString()}` : 'Not specified'}
- Industry: ${scopeAnswers.industry || 'Not specified'}

TECHNICAL COMPLEXITY FACTORS:
${hasMobileApp ? `
MOBILE APP REQUIREMENTS DETECTED:
- Include App Store submission preparation (screenshots, descriptions, keywords)
- Account for Apple Developer Program setup and certificates
- Factor in Google Play Console configuration
- Add time for app review cycles (7-14 days for Apple, 2-3 days for Google)
- Include device testing across multiple iOS/Android versions
- Account for push notification setup (APNs/FCM)
- Add crash reporting and analytics integration
- Consider offline functionality requirements
- Include deep linking and universal links setup
- Factor in app update strategy and versioning
` : ''}

${hasIntegrations ? `
THIRD-PARTY INTEGRATIONS DETECTED:
- Analyze each integration's API documentation quality
- Include sandbox/development account setup time
- Factor in rate limiting and quota management
- Add error handling and retry logic implementation
- Include webhook endpoint development and testing
- Account for data mapping and transformation complexity
- Add integration testing with mock data
- Include monitoring and alerting setup
- Factor in vendor communication delays
- Add fallback strategies for API failures
` : ''}

${isEnterprise ? `
ENTERPRISE REQUIREMENTS:
- Include security audit preparation
- Add SOC2/ISO compliance documentation
- Factor in penetration testing cycles
- Include disaster recovery planning
- Add multi-environment setup (dev/staging/prod)
- Include load testing and performance optimization
- Factor in SLA monitoring and reporting
- Add comprehensive logging and audit trails
- Include role-based access control (RBAC)
- Factor in data retention and archival policies
` : ''}

HOURLY RATES:
${Object.entries(customRates).map(([role, rate]) => `- ${role}: $${(rate / 100).toFixed(0)}/hr`).join('\n')}

CRITICAL REQUIREMENTS:
1. Include EVERY technical task, not just high-level phases
2. Add specific line items for often-missed tasks:
   - Environment setup and configuration
   - Security hardening and SSL certificates
   - Database migration scripts
   - API documentation
   - Error tracking setup (Sentry, Rollbar)
   - CI/CD pipeline configuration
   - Monitoring and alerting setup
   - Performance optimization passes
   - Accessibility compliance (WCAG)
   - Browser/device compatibility testing
   
3. For each integration, include:
   - API exploration and documentation review
   - Authentication flow implementation
   - Rate limit handling
   - Error recovery mechanisms
   - Data synchronization logic
   - Webhook processing
   
4. Account for real-world friction:
   - Client feedback cycles (add 20% buffer)
   - Scope clarification meetings
   - Technical discoveries during implementation
   - Vendor support response times
   - Testing across environments
   - Bug fix cycles after each phase

Return JSON format:
{
  "lineItems": [
    {
      "id": "unique_id",
      "category": "Phase or area (e.g., Discovery, Design, Development)",
      "description": "Specific task description",
      "role": "Role from custom rates",
      "hours": number,
      "rate": rate_in_cents,
      "total": total_in_cents,
      "notes": "Optional reasoning or details"
    }
  ],
  "totalHours": total_estimated_hours,
  "totalCost": total_cost_in_cents,
  "timeline": "Estimated timeline (e.g., '8-10 weeks')",
  "assumptions": [
    "List of key assumptions made in the estimate"
  ],
  "recommendations": [
    "Suggestions to optimize budget or timeline"
  ],
  "risks": [
    "Potential risks that could affect budget"
  ]
}

ESTIMATION GUIDELINES:
- Be comprehensive but realistic
- Include buffer time for revisions and client feedback
- Account for all necessary roles and skills
- Consider the project complexity level
- Factor in timeline constraints
- Include project management and coordination time
- Add contingency for scope changes (5-10%)
`;
  }

  private validateAndEnhanceEstimation(
    aiResult: any,
    projectType: string,
    customRates: CustomRates
  ): AIEstimation {
    // Ensure all required fields exist
    const estimation: AIEstimation = {
      lineItems: aiResult.lineItems || [],
      totalHours: aiResult.totalHours || 0,
      totalCost: aiResult.totalCost || 0,
      timeline: aiResult.timeline || 'To be determined',
      assumptions: aiResult.assumptions || [],
      recommendations: aiResult.recommendations || [],
      risks: aiResult.risks || []
    };

    // Validate and fix line items
    estimation.lineItems = estimation.lineItems.map((item: any, index: number) => ({
      id: item.id || `line_${index + 1}`,
      category: item.category || 'General',
      description: item.description || 'Project task',
      role: item.role || 'developer',
      hours: Math.max(1, item.hours || 8),
      rate: item.rate || customRates[item.role] || 8000,
      total: item.total || (item.hours * (item.rate || customRates[item.role] || 8000)),
      notes: item.notes || ''
    }));

    // Recalculate totals
    estimation.totalHours = estimation.lineItems.reduce((sum, item) => sum + item.hours, 0);
    estimation.totalCost = estimation.lineItems.reduce((sum, item) => sum + item.total, 0);

    // Add sophisticated default content if missing
    if (estimation.assumptions.length === 0) {
      const assumptions = [
        'Client will provide feedback within 48 hours of each deliverable',
        'All third-party API credentials and access will be provided before integration phase',
        'Current scope is final - changes will require change orders',
        'Client has necessary licenses for any proprietary software or services',
        'Testing will be conducted on latest stable browser/OS versions'
      ];
      
      if (projectType.includes('mobile')) {
        assumptions.push(
          'Client has active Apple Developer and Google Play Console accounts',
          'App store review times are estimated at 7-14 days for iOS, 2-3 days for Android',
          'Client will handle app store listing content (descriptions, keywords, screenshots)'
        );
      }
      
      if (projectType.includes('enterprise') || projectType.includes('saas')) {
        assumptions.push(
          'Client IT team will be available for infrastructure discussions',
          'Security review process is defined and will not exceed 2 weeks',
          'Production deployment windows are pre-approved'
        );
      }
      
      estimation.assumptions = assumptions;
    }

    if (estimation.recommendations.length === 0) {
      const recommendations = [
        'Implement bi-weekly sprint reviews to catch issues early',
        'Use staging environment for client reviews before production deployment',
        'Document all API integrations thoroughly for future maintenance',
        'Set up automated testing to reduce QA cycles',
        'Consider phased rollout to minimize risk'
      ];
      
      if (customRates && Object.keys(customRates).length > 0) {
        const avgRate = Object.values(customRates).reduce((a, b) => a + b, 0) / Object.values(customRates).length;
        if (avgRate < 8000) { // Less than $80/hour average
          recommendations.push(
            'Consider increasing rates to attract senior talent for critical components',
            'Budget for code review by senior developers to ensure quality'
          );
        }
      }
      
      estimation.recommendations = recommendations;
    }

    if (estimation.risks.length === 0) {
      const risks = [
        'Third-party API changes or deprecations during development',
        'Discovery of technical debt in existing systems during integration',
        'Scope expansion due to stakeholder involvement post-kickoff',
        'Performance issues discovered during load testing',
        'Security vulnerabilities requiring additional hardening'
      ];
      
      if (projectType.includes('mobile')) {
        risks.push(
          'App store rejection requiring additional development cycles',
          'OS updates during development affecting compatibility',
          'Device-specific issues discovered during testing'
        );
      }
      
      if (projectType.includes('integration') || projectType.includes('enterprise')) {
        risks.push(
          'Legacy system limitations not documented in initial assessment',
          'Data migration complexity exceeding initial estimates',
          'Compliance requirements changing during project timeline'
        );
      }
      
      estimation.risks = risks;
    }

    return estimation;
  }

  private generateFallbackEstimation(
    projectType: string,
    scopeAnswers: ScopeAnswers,
    customRates: CustomRates
  ): AIEstimation {
    console.log("AdvancedBudgetAgent: Generating fallback estimation");

    const projectConfig = ADVANCED_REFERENCE_DATA.projectTypes[projectType as keyof typeof ADVANCED_REFERENCE_DATA.projectTypes];
    const complexityMultiplier = ADVANCED_REFERENCE_DATA.complexityMultipliers[scopeAnswers.complexity as keyof typeof ADVANCED_REFERENCE_DATA.complexityMultipliers] || 1.0;
    const timelineMultiplier = ADVANCED_REFERENCE_DATA.timelineMultipliers[scopeAnswers.timeline as keyof typeof ADVANCED_REFERENCE_DATA.timelineMultipliers] || 1.0;

    const baseHours = 40; // Base hours per role
    const adjustedHours = Math.round(baseHours * complexityMultiplier * timelineMultiplier);

    const lineItems: BudgetLineItem[] = [];
    let totalCost = 0;
    let totalHours = 0;

    // Generate line items based on project type
    if (projectConfig) {
      projectConfig.commonRoles.forEach((role, index) => {
        const rate = customRates[role] || ADVANCED_REFERENCE_DATA.rates[role as keyof typeof ADVANCED_REFERENCE_DATA.rates] || 8000;
        const hours = adjustedHours + (index * 5); // Vary hours slightly
        const total = hours * rate;

        lineItems.push({
          id: `fallback_${index + 1}`,
          category: projectConfig.phases[index] || 'General',
          description: `${role.charAt(0).toUpperCase() + role.slice(1)} work for ${projectConfig.phases[index] || 'project phase'}`,
          role,
          hours,
          rate,
          total,
          notes: 'Estimated based on project complexity and timeline'
        });

        totalHours += hours;
        totalCost += total;
      });
    }

    // Add project management
    const pmHours = Math.round(totalHours * 0.15); // 15% PM overhead
    const pmRate = customRates.pm || ADVANCED_REFERENCE_DATA.rates.pm;
    const pmTotal = pmHours * pmRate;

    lineItems.push({
      id: 'pm_overhead',
      category: 'Project Management',
      description: 'Project coordination, client communication, and timeline management',
      role: 'pm',
      hours: pmHours,
      rate: pmRate,
      total: pmTotal,
      notes: 'Standard project management overhead'
    });

    totalHours += pmHours;
    totalCost += pmTotal;

    return {
      lineItems,
      totalHours,
      totalCost,
      timeline: this.estimateTimeline(totalHours),
      assumptions: [
        'Standard agency workflow and processes',
        'Client provides timely feedback',
        'No major scope changes during execution',
        'All required assets provided by client'
      ],
      recommendations: [
        'Define clear project scope and deliverables',
        'Establish regular milestone check-ins',
        'Consider 10-15% contingency for scope changes',
        'Document all requirements before starting'
      ],
      risks: [
        'Scope creep due to undefined requirements',
        'Client feedback delays',
        'Technical complexity variations',
        'Resource availability constraints'
      ]
    };
  }

  private estimateTimeline(totalHours: number): string {
    const weeksNeeded = Math.ceil(totalHours / 40); // Assuming 40 hours per week
    
    if (weeksNeeded <= 4) return `${weeksNeeded} weeks`;
    if (weeksNeeded <= 8) return `${Math.ceil(weeksNeeded / 4) * 4} weeks`;
    if (weeksNeeded <= 16) return `${Math.ceil(weeksNeeded / 4)} months`;
    return `${Math.ceil(weeksNeeded / 12)} quarters`;
  }
}