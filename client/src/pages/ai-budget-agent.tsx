import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Brain,
  Calculator,
  FileText,
  Users,
  Clock,
  Calendar,
  DollarSign,
  Sparkles,
  Send,
  Download,
  Mail,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  Loader2,
  AlertCircle,
  TrendingUp,
  Target,
  Briefcase,
  FileSpreadsheet,
  FileDown,
  Eye,
  Smartphone,
  Cloud,
  ShoppingCart,
  Network,
} from "lucide-react";

// Use same-origin in prod, explicit base in dev if you have one
const API_BASE = import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, "") || "";

interface Project {
  id: number;
  name: string;
  description?: string;
}

interface ScopeQuestion {
  id: string;
  question: string;
  type: "text" | "select" | "number" | "multiselect";
  options?: string[];
  required: boolean;
}

interface BudgetLineItem {
  id: string;
  category: string;
  description: string;
  role: string;
  hours: number;
  rate: number; // cents/hour
  total: number; // cents
  isFixed?: boolean;
  notes?: string | null;
}

interface ClientInfo {
  name: string;
  email: string;
  company: string;
  budget?: number;
}

interface AIEstimation {
  lineItems: BudgetLineItem[];
  totalHours: number;
  totalCost: number; // cents
  timeline: string;
  assumptions: string[];
  recommendations: string[];
  risks: string[];
}

function sanitizeEstimation(est: AIEstimation) {
  return {
    ...est,
    totalHours: Number(est.totalHours) || 0,
    totalCost: Number(est.totalCost) || 0,
    lineItems: est.lineItems.map((li) => ({
      ...li,
      hours: Number(li.hours) || 0,
      rate: Number(li.rate) || 0, // still in cents as your UI expects
      total: Number(li.total) || Number(li.hours) * Number(li.rate) || 0,
      notes: li.notes ?? null,
    })),
  };
}
// localStorage persistence helpers
const STORAGE_KEY = "ai-budget-agent-data";

const saveToStorage = (key: string, value: any) => {
  try {
    const existingData = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    existingData[key] = value;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existingData));
  } catch (error) {
    console.error("Failed to save to localStorage:", error);
  }
};

const loadFromStorage = (key: string, defaultValue: any = null) => {
  try {
    const existingData = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return existingData[key] ?? defaultValue;
  } catch (error) {
    console.error("Failed to load from localStorage:", error);
    return defaultValue;
  }
};

export default function AIBudgetAgent() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [currentStep, setCurrentStep] = useState<"scope" | "budget" | "quote">(
    () => {
      // If we have an AI estimation saved, go to budget step
      const savedEstimation = loadFromStorage("aiEstimation", null);
      if (savedEstimation) {
        return "budget";
      }
      return loadFromStorage("currentStep", "scope");
    },
  );
  // Persist currentStep changes
  useEffect(() => {
    saveToStorage("currentStep", currentStep);
  }, [currentStep]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    null,
  );
  const [projectType, setProjectType] = useState<string>(() =>
    loadFromStorage("projectType", ""),
  );

  // Persist projectType changes
  useEffect(() => {
    saveToStorage("projectType", projectType);
  }, [projectType]);

  const [scopeAnswers, setScopeAnswers] = useState<Record<string, any>>(() =>
    loadFromStorage("scopeAnswers", {}),
  );
  // Persist scopeAnswers changes
  useEffect(() => {
    saveToStorage("scopeAnswers", scopeAnswers);
  }, [scopeAnswers]);
  const [clientInfo, setClientInfo] = useState<ClientInfo>(() =>
    loadFromStorage("clientInfo", {
      name: "",
      email: "",
      company: "",
    }),
  );
  // Persist clientInfo changes
  useEffect(() => {
    saveToStorage("clientInfo", clientInfo);
  }, [clientInfo]);

  const [customRates, setCustomRates] = useState<{ [role: string]: number }>(
    () =>
      loadFromStorage("customRates", {
        Strategist: 12000,
        Designer: 9000,
        Developer: 11000,
        "Mobile Developer": 12500,
        "DevOps Engineer": 13000,
        "Security Engineer": 14000,
        "Data Engineer": 12000,
        Architect: 15000,
        Copywriter: 6000,
        "Project Manager": 10000,
        Analyst: 8500,
        "QA Engineer": 8000,
        "Integration Specialist": 11500,
      }),
  );

  // Persist customRates changes
  useEffect(() => {
    saveToStorage("customRates", customRates);
  }, [customRates]);

  const [editingLineItem, setEditingLineItem] = useState<string | null>(null);
  const [editedLineItem, setEditedLineItem] = useState<BudgetLineItem | null>(
    null,
  );
  const [aiEstimation, setAiEstimation] = useState<AIEstimation | null>(() =>
    loadFromStorage("aiEstimation", null),
  );
  // Persist aiEstimation changes
  useEffect(() => {
    saveToStorage("aiEstimation", aiEstimation);
  }, [aiEstimation]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [savedQuoteId, setSavedQuoteId] = useState<number | null>(null);

  // Role management state
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [newRoleName, setNewRoleName] = useState<string>("");
  const [newRoleRate, setNewRoleRate] = useState<number>(8000);
  const [showAddRole, setShowAddRole] = useState(false);

  // Line item editing functions
  const startEditingLineItem = (lineItem: BudgetLineItem) => {
    setEditingLineItem(lineItem.id);
    setEditedLineItem({ ...lineItem });
  };

  const cancelEditingLineItem = () => {
    setEditingLineItem(null);
    setEditedLineItem(null);
  };

  const saveLineItemEdit = () => {
    if (!editedLineItem || !aiEstimation) return;

    const updatedLineItems = aiEstimation.lineItems.map((item) =>
      item.id === editedLineItem.id
        ? {
            ...editedLineItem,
            total: (editedLineItem.hours || 0) * (editedLineItem.rate || 0),
          }
        : item,
    );

    const newTotalCost = updatedLineItems.reduce(
      (sum, item) => sum + (item.total || 0),
      0,
    );
    const newTotalHours = updatedLineItems.reduce(
      (sum, item) => sum + (item.hours || 0),
      0,
    );

    setAiEstimation({
      ...aiEstimation,
      lineItems: updatedLineItems,
      totalCost: newTotalCost,
      totalHours: newTotalHours,
    });

    setEditingLineItem(null);
    setEditedLineItem(null);

    toast({
      title: "Line Item Updated",
      description: "Budget breakdown has been updated successfully.",
    });
  };

  const deleteLineItem = (lineItemId: string) => {
    if (!aiEstimation) return;

    const updatedLineItems = aiEstimation.lineItems.filter(
      (item) => item.id !== lineItemId,
    );
    const newTotalCost = updatedLineItems.reduce(
      (sum, item) => sum + (item.total || 0),
      0,
    );
    const newTotalHours = updatedLineItems.reduce(
      (sum, item) => sum + (item.hours || 0),
      0,
    );

    setAiEstimation({
      ...aiEstimation,
      lineItems: updatedLineItems,
      totalCost: newTotalCost,
      totalHours: newTotalHours,
    });

    toast({
      title: "Line Item Deleted",
      description: "Item has been removed from the budget breakdown.",
    });
  };

  const updateCustomRate = (role: string, rate: number) => {
    setCustomRates((prev) => ({
      ...prev,
      [role]: rate,
    }));
  };

  // Role management functions
  const addNewRole = () => {
    if (!newRoleName.trim() || customRates[newRoleName]) {
      toast({
        title: "Invalid Role",
        description: "Please enter a unique role name.",
        variant: "destructive",
      });
      return;
    }

    setCustomRates((prev) => ({
      ...prev,
      [newRoleName]: newRoleRate,
    }));

    toast({
      title: "Role Added",
      description: `${newRoleName} has been added with rate $${(newRoleRate / 100).toFixed(2)}/hr`,
    });

    setNewRoleName("");
    setNewRoleRate(8000);
    setShowAddRole(false);
  };

  const deleteRole = (role: string) => {
    const updatedRates = { ...customRates };
    delete updatedRates[role];
    setCustomRates(updatedRates);

    toast({
      title: "Role Deleted",
      description: `${role} has been removed from the rate list.`,
    });
  };

  const startEditingRole = (role: string) => {
    setEditingRole(role);
  };

  const saveRoleEdit = (role: string, newRate: number) => {
    updateCustomRate(role, newRate);
    setEditingRole(null);

    toast({
      title: "Rate Updated",
      description: `${role} rate updated to $${(newRate / 100).toFixed(2)}/hr`,
    });
  };

  const cancelRoleEdit = () => {
    setEditingRole(null);
  };

  // Excel export function
  const exportToExcel = () => {
    if (!aiEstimation) return;

    import("xlsx")
      .then((XLSX) => {
        const wb = XLSX.utils.book_new();

        const wsData = [
          ["Project Budget Estimate"],
          [""],
          ["Client:", clientInfo.company || clientInfo.name],
          ["Project Type:", projectType.replace("_", " ")],
          ["Timeline:", aiEstimation.timeline],
          ["Total Hours:", aiEstimation.totalHours],
          [
            "Total Cost:",
            `$${(aiEstimation.totalCost / 100).toLocaleString()}`,
          ],
          [""],
          [
            "Category",
            "Description",
            "Role",
            "Hours",
            "Rate ($/hr)",
            "Total ($)",
          ],
          ...aiEstimation.lineItems.map((item) => [
            item.category,
            item.description,
            item.role,
            item.hours,
            (item.rate / 100).toFixed(0),
            (item.total / 100).toFixed(2),
          ]),
          [""],
          [
            "",
            "",
            "",
            "",
            "TOTAL:",
            `$${(aiEstimation.totalCost / 100).toLocaleString()}`,
          ],
          [""],
          ["Assumptions:"],
          ...aiEstimation.assumptions.map((assumption) => [assumption]),
          [""],
          ["Recommendations:"],
          ...aiEstimation.recommendations.map((rec) => [rec]),
          [""],
          ["Risks:"],
          ...aiEstimation.risks.map((risk) => [risk]),
        ];

        const ws = XLSX.utils.aoa_to_sheet(wsData);

        ws["!cols"] = [
          { width: 15 },
          { width: 40 },
          { width: 12 },
          { width: 8 },
          { width: 12 },
          { width: 12 },
        ];

        XLSX.utils.book_append_sheet(wb, ws, "Budget Estimate");

        const filename = `Budget_Estimate_${clientInfo.company || clientInfo.name || "Project"}_${new Date().toISOString().split("T")[0]}.xlsx`;
        XLSX.writeFile(wb, filename);

        toast({
          title: "Excel Export Complete",
          description:
            "Budget estimate has been exported to Excel successfully.",
        });
      })
      .catch((error) => {
        console.error("Excel export error:", error);
        toast({
          title: "Export Failed",
          description: "Failed to export to Excel. Please try again.",
          variant: "destructive",
        });
      });
  };

  // PDF export function
  const exportToPDF = async () => {
    if (!aiEstimation) return;

    try {
      const [jsPDF, html2canvas] = await Promise.all([
        import("jspdf"),
        import("html2canvas"),
      ]);

      const PDFClass = jsPDF.default || jsPDF;

      const pdf = new PDFClass("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      pdf.setFontSize(24);
      pdf.setFont("helvetica", "bold");
      pdf.text("PROJECT PROPOSAL", pageWidth / 2, 20, { align: "center" });

      pdf.setFontSize(16);
      pdf.setFont("helvetica", "normal");
      pdf.text(
        `for ${clientInfo.company || clientInfo.name}`,
        pageWidth / 2,
        30,
        { align: "center" },
      );

      let yPos = 50;
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.text("Project Details:", 20, yPos);

      yPos += 10;
      pdf.setFont("helvetica", "normal");
      pdf.text(
        `Project Type: ${projectType.replace("_", " ").toUpperCase()}`,
        20,
        yPos,
      );
      yPos += 8;
      pdf.text(`Timeline: ${aiEstimation.timeline}`, 20, yPos);
      yPos += 8;
      pdf.text(`Total Hours: ${aiEstimation.totalHours} hours`, 20, yPos);
      yPos += 8;
      pdf.text(
        `Total Investment: $${(aiEstimation.totalCost / 100).toLocaleString()}`,
        20,
        yPos,
      );

      yPos += 20;
      pdf.setFont("helvetica", "bold");
      pdf.text("Project Breakdown:", 20, yPos);
      yPos += 10;

      pdf.setFontSize(10);
      pdf.text("Category", 20, yPos);
      pdf.text("Description", 50, yPos);
      pdf.text("Role", 120, yPos);
      pdf.text("Hours", 150, yPos);
      pdf.text("Rate", 170, yPos);
      pdf.text("Total", 190, yPos);
      yPos += 5;

      pdf.line(20, yPos, pageWidth - 20, yPos);
      yPos += 5;

      pdf.setFont("helvetica", "normal");
      aiEstimation.lineItems.forEach((item) => {
        if (yPos > pageHeight - 30) {
          pdf.addPage();
          yPos = 20;
        }

        pdf.text(item.category.substring(0, 12), 20, yPos);
        pdf.text(item.description.substring(0, 30), 50, yPos);
        pdf.text(item.role, 120, yPos);
        pdf.text(item.hours.toString(), 150, yPos);
        pdf.text(`$${(item.rate / 100).toFixed(0)}`, 170, yPos);
        pdf.text(`$${(item.total / 100).toLocaleString()}`, 190, yPos);
        yPos += 6;
      });

      yPos += 10;
      pdf.setFont("helvetica", "bold");
      pdf.text("Assumptions:", 20, yPos);
      yPos += 8;
      pdf.setFont("helvetica", "normal");
      aiEstimation.assumptions.forEach((assumption, index) => {
        if (yPos > pageHeight - 20) {
          pdf.addPage();
          yPos = 20;
        }
        pdf.text(`${index + 1}. ${assumption}`, 20, yPos);
        yPos += 6;
      });

      const filename = `Proposal_${clientInfo.company || clientInfo.name || "Project"}_${new Date().toISOString().split("T")[0]}.pdf`;
      pdf.save(filename);

      toast({
        title: "PDF Export Complete",
        description:
          "Professional proposal has been exported to PDF successfully.",
      });
    } catch (error) {
      console.error("PDF export error:", error);
      toast({
        title: "Export Failed",
        description: "Failed to export to PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Excel export for quote
  const exportQuoteToExcel = () => {
    if (!aiEstimation) return;

    import("xlsx")
      .then((XLSX) => {
        const wb = XLSX.utils.book_new();

        const quoteData = [
          ["PROJECT PROPOSAL"],
          [""],
          ["Client Information:"],
          ["Name:", clientInfo.name],
          ["Email:", clientInfo.email],
          ["Company:", clientInfo.company],
          [""],
          ["Project Overview:"],
          ["Type:", projectType.replace("_", " ")],
          ["Timeline:", aiEstimation.timeline],
          ["Total Hours:", aiEstimation.totalHours],
          [
            "Total Investment:",
            `$${(aiEstimation.totalCost / 100).toLocaleString()}`,
          ],
          [""],
          ["STATEMENT OF WORK"],
          [""],
          ["Deliverables:", "Hours", "Rate", "Total"],
          ...aiEstimation.lineItems.map((item) => [
            `${item.category}: ${item.description}`,
            item.hours,
            `$${(item.rate / 100).toFixed(0)}`,
            `$${(item.total / 100).toFixed(2)}`,
          ]),
          [""],
          ["Project Assumptions:"],
          ...aiEstimation.assumptions.map((assumption) => [assumption]),
          [""],
          ["Recommendations:"],
          ...aiEstimation.recommendations.map((rec) => [rec]),
          [""],
          ["Risk Factors:"],
          ...aiEstimation.risks.map((risk) => [risk]),
        ];

        const ws = XLSX.utils.aoa_to_sheet(quoteData);
        ws["!cols"] = [
          { width: 50 },
          { width: 10 },
          { width: 12 },
          { width: 15 },
        ];

        XLSX.utils.book_append_sheet(wb, ws, "Project Proposal");

        const filename = `Proposal_${clientInfo.company || clientInfo.name || "Project"}_${new Date().toISOString().split("T")[0]}.xlsx`;
        XLSX.writeFile(wb, filename);

        toast({
          title: "Excel Export Complete",
          description:
            "Complete proposal has been exported to Excel successfully.",
        });
      })
      .catch((error) => {
        console.error("Excel export error:", error);
        toast({
          title: "Export Failed",
          description: "Failed to export to Excel. Please try again.",
          variant: "destructive",
        });
      });
  };

  // Fetch projects
  const { data: projects = [], isLoading: projectsLoading } = useQuery<
    Project[]
  >({
    queryKey: ["/api/projects"],
    enabled: isAuthenticated,
  });

  // Dynamic scoping questions based on project type
  const getScopeQuestions = (): ScopeQuestion[] => {
    const baseQuestions: ScopeQuestion[] = [
      {
        id: "timeline",
        question: "What is your target timeline?",
        type: "select",
        options: ["2-4 weeks", "1-2 months", "3-4 months", "6+ months"],
        required: true,
      },
      {
        id: "team_size",
        question: "How many team members do you need?",
        type: "number",
        required: true,
      },
      {
        id: "complexity",
        question: "Project complexity level?",
        type: "select",
        options: ["Simple", "Medium", "Complex", "Enterprise"],
        required: true,
      },
      {
        id: "deliverables",
        question: "Key deliverables needed?",
        type: "multiselect",
        options: [
          "Strategy Document",
          "Wireframes",
          "Visual Design",
          "Development",
          "Testing",
          "Launch Support",
        ],
        required: true,
      },
    ];

    if (projectType === "branding") {
      baseQuestions.push(
        {
          id: "brand_elements",
          question: "Which brand elements do you need?",
          type: "multiselect",
          options: [
            "Logo Design",
            "Brand Guidelines",
            "Color Palette",
            "Typography",
            "Marketing Materials",
            "Website",
          ],
          required: true,
        },
        {
          id: "industry",
          question: "What industry is this for?",
          type: "text",
          required: false,
        },
      );
    } else if (projectType === "web_development") {
      baseQuestions.push(
        {
          id: "platform",
          question: "Platform requirements?",
          type: "multiselect",
          options: [
            "Responsive Web",
            "Progressive Web App",
            "API Development",
            "Admin Dashboard",
          ],
          required: true,
        },
        {
          id: "integrations",
          question:
            "Third-party integrations needed? (e.g., Stripe, Auth0, AWS)",
          type: "text",
          required: false,
        },
        {
          id: "features",
          question: "Key features required?",
          type: "multiselect",
          options: [
            "User Authentication",
            "Payment Processing",
            "Real-time Updates",
            "File Uploads",
            "Email Notifications",
            "Analytics",
          ],
          required: true,
        },
      );
    } else if (projectType === "mobile_app") {
      baseQuestions.push(
        {
          id: "platforms",
          question: "Which mobile platforms?",
          type: "multiselect",
          options: [
            "iOS (iPhone)",
            "iOS (iPad)",
            "Android Phone",
            "Android Tablet",
          ],
          required: true,
        },
        {
          id: "app_features",
          question: "Core app features needed?",
          type: "multiselect",
          options: [
            "Push Notifications",
            "Offline Mode",
            "Location Services",
            "Camera/Photo",
            "In-App Purchases",
            "Social Login",
            "Biometric Auth",
          ],
          required: true,
        },
        {
          id: "backend_requirements",
          question: "Backend infrastructure needs?",
          type: "multiselect",
          options: [
            "User Management",
            "API Development",
            "Database",
            "File Storage",
            "Real-time Sync",
            "Analytics",
          ],
          required: true,
        },
        {
          id: "app_store_support",
          question: "Need help with app store submission?",
          type: "select",
          options: [
            "Yes - Full Support",
            "Yes - Guidance Only",
            "No - We'll handle it",
          ],
          required: true,
        },
      );
    } else if (projectType === "saas_platform") {
      baseQuestions.push(
        {
          id: "user_scale",
          question: "Expected user scale?",
          type: "select",
          options: [
            "0-1000 users",
            "1000-10K users",
            "10K-100K users",
            "100K+ users",
          ],
          required: true,
        },
        {
          id: "billing_model",
          question: "Billing model?",
          type: "multiselect",
          options: [
            "Monthly Subscription",
            "Annual Plans",
            "Usage-based",
            "Freemium",
            "One-time Purchase",
          ],
          required: true,
        },
        {
          id: "infrastructure",
          question: "Infrastructure requirements?",
          type: "multiselect",
          options: [
            "Multi-tenancy",
            "Auto-scaling",
            "CI/CD Pipeline",
            "Monitoring/Alerts",
            "Backup/DR",
            "CDN",
            "Load Balancing",
          ],
          required: true,
        },
        {
          id: "compliance",
          question: "Compliance requirements?",
          type: "multiselect",
          options: ["SOC2", "GDPR", "HIPAA", "PCI-DSS", "ISO 27001", "None"],
          required: true,
        },
      );
    } else if (projectType === "ecommerce") {
      baseQuestions.push(
        {
          id: "product_count",
          question: "Number of products?",
          type: "select",
          options: ["1-50", "50-500", "500-5000", "5000+"],
          required: true,
        },
        {
          id: "payment_gateways",
          question: "Payment methods needed?",
          type: "multiselect",
          options: [
            "Credit Cards",
            "PayPal",
            "Apple Pay",
            "Google Pay",
            "Cryptocurrency",
            "Buy Now Pay Later",
          ],
          required: true,
        },
        {
          id: "ecommerce_features",
          question: "E-commerce features required?",
          type: "multiselect",
          options: [
            "Inventory Management",
            "Multi-currency",
            "Tax Calculation",
            "Shipping Integration",
            "Discount Codes",
            "Subscription Products",
          ],
          required: true,
        },
      );
    } else if (projectType === "enterprise_integration") {
      baseQuestions.push(
        {
          id: "systems_to_integrate",
          question:
            "Which systems need integration? (e.g., Salesforce, SAP, Oracle)",
          type: "text",
          required: true,
        },
        {
          id: "data_volume",
          question: "Expected data volume?",
          type: "select",
          options: ["< 1GB/day", "1-10GB/day", "10-100GB/day", "> 100GB/day"],
          required: true,
        },
        {
          id: "integration_type",
          question: "Integration approach?",
          type: "multiselect",
          options: [
            "Real-time Sync",
            "Batch Processing",
            "Event-driven",
            "API Gateway",
            "ETL Pipeline",
            "Message Queue",
          ],
          required: true,
        },
        {
          id: "security_requirements",
          question: "Security requirements?",
          type: "multiselect",
          options: [
            "VPN Access",
            "OAuth/SAML",
            "Data Encryption",
            "Audit Logging",
            "Role-based Access",
            "API Key Management",
          ],
          required: true,
        },
      );
    } else if (projectType === "marketing") {
      baseQuestions.push(
        {
          id: "channels",
          question: "Marketing channels to focus on?",
          type: "multiselect",
          options: [
            "Social Media",
            "Email Marketing",
            "Content Marketing",
            "Paid Advertising",
            "SEO",
          ],
          required: true,
        },
        {
          id: "target_audience",
          question: "Target audience description?",
          type: "text",
          required: true,
        },
      );
    }

    return baseQuestions;
  };

  // Generate AI estimation
  const generateEstimation = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch(
        `${API_BASE}/api/budget-agent/generate-advanced`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            projectType,
            scopeAnswers,
            customRates,
            clientInfo,
          }),
        },
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Failed to generate estimation");
      }

      const estimation = await response.json();
      setAiEstimation(estimation);
      setCurrentStep("budget");

      toast({
        title: "AI Estimation Complete",
        description:
          "Your project scope has been analyzed and budget estimated.",
      });
    } catch (error: any) {
      console.error("Error generating estimation:", error);
      toast({
        title: "Generation Failed",
        description: String(error?.message || error),
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Save quote mutation
  const saveQuoteMutation = useMutation({
    mutationFn: async () => {
      if (!aiEstimation) throw new Error("No estimation to save");

      const payload: any = {
        projectType,
        clientInfo,
        scopeAnswers, // include these so backend can store scoping context
        estimation: sanitizeEstimation(aiEstimation),
      };
      if (selectedProjectId) payload.projectId = selectedProjectId;

      const response = await fetch(`${API_BASE}/api/budget-agent/save-quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // IMPORTANT if cookie session
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text || "Save failed"}`);
      }

      return response.json();
    },
    onSuccess: (data: { quoteId?: number }) => {
      if (data?.quoteId) setSavedQuoteId(data.quoteId);
      toast({
        title: "Quote Saved",
        description: "Your quote has been saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/budget-estimates"] });
    },
    onError: (err: any) => {
      console.error(err);
      toast({
        title: "Save Failed",
        description: String(err?.message || err),
        variant: "destructive",
      });
    },
  });

  // Validate required fields then run save
  const handleSaveClick = () => {
    if (!projectType) {
      toast({
        title: "Missing Project Type",
        description: "Please select a project type.",
        variant: "destructive",
      });
      return;
    }
    if (!aiEstimation || !aiEstimation.lineItems?.length) {
      toast({
        title: "Nothing To Save",
        description: "Generate an estimation before saving.",
        variant: "destructive",
      });
      return;
    }
    if (!clientInfo.email?.trim()) {
      toast({
        title: "Client Email Required",
        description: "Please enter the client's email before saving.",
        variant: "destructive",
      });
      return;
    }
    // Optional: hard-require name/company
    // if (!clientInfo.name?.trim() || !clientInfo.company?.trim()) {
    //   toast({
    //     title: "Client Details Required",
    //     description: "Please add client name and company.",
    //     variant: "destructive",
    //   });
    //   return;
    // }

    saveQuoteMutation.mutate();
  };

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login prompt if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <Brain className="mx-auto h-12 w-12 text-blue-600 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            AI Budget & Quote Agent
          </h2>
          <p className="text-gray-600 mb-6">
            Please log in to access advanced AI-powered budget estimation and
            professional quote generation
          </p>
          <Button
            onClick={() => (window.location.href = "/api/login")}
            className="w-full"
            size="lg"
          >
            Log In with Replit
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-3 rounded-xl mr-4">
              <Brain className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                AI Budget & Quote Agent
                <Badge
                  variant="secondary"
                  className="ml-3 bg-purple-100 text-purple-700"
                >
                  Advanced
                </Badge>
              </h1>
              <p className="text-gray-600 mt-1">
                Intelligent project scoping, budget estimation, and professional
                quote generation
              </p>
            </div>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center justify-center mb-6">
            <div className="flex items-center space-x-4">
              <div
                className={`flex items-center ${currentStep === "scope" ? "text-blue-600" : currentStep === "budget" || currentStep === "quote" ? "text-green-600" : "text-gray-400"}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === "scope" ? "bg-blue-100 border-2 border-blue-600" : currentStep === "budget" || currentStep === "quote" ? "bg-green-100 border-2 border-green-600" : "bg-gray-100 border-2 border-gray-300"}`}
                >
                  {currentStep === "budget" || currentStep === "quote" ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <span className="text-sm font-medium">1</span>
                  )}
                </div>
                <span className="ml-2 font-medium">AI Scoping</span>
              </div>

              <div
                className={`w-8 h-0.5 ${currentStep === "budget" || currentStep === "quote" ? "bg-green-600" : "bg-gray-300"}`}
              />

              <div
                className={`flex items-center ${currentStep === "budget" ? "text-blue-600" : currentStep === "quote" ? "text-green-600" : "text-gray-400"}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === "budget" ? "bg-blue-100 border-2 border-blue-600" : currentStep === "quote" ? "bg-green-100 border-2 border-green-600" : "bg-gray-100 border-2 border-gray-300"}`}
                >
                  {currentStep === "quote" ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <span className="text-sm font-medium">2</span>
                  )}
                </div>
                <span className="ml-2 font-medium">Budget Review</span>
              </div>

              <div
                className={`w-8 h-0.5 ${currentStep === "quote" ? "bg-green-600" : "bg-gray-300"}`}
              />

              <div
                className={`flex items-center ${currentStep === "quote" ? "text-blue-600" : "text-gray-400"}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === "quote" ? "bg-blue-100 border-2 border-blue-600" : "bg-gray-100 border-2 border-gray-300"}`}
                >
                  <span className="text-sm font-medium">3</span>
                </div>
                <span className="ml-2 font-medium">Quote Generation</span>
              </div>
            </div>
          </div>
        </div>

        {/* Step 1: AI Scoping Assistant */}
        {currentStep === "scope" && (
          <div className="max-w-4xl mx-auto">
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur">
              <CardHeader className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-t-lg">
                <CardTitle className="flex items-center">
                  <Sparkles className="mr-2 h-5 w-5" />
                  AI-Powered Project Scoping
                </CardTitle>
                <CardDescription className="text-blue-100">
                  Answer a few questions so our AI can generate accurate
                  estimates
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {/* Project Selection */}
                <div className="space-y-4">
                  <Label className="text-base font-medium">
                    Link to Existing Project (Optional)
                  </Label>
                  <Select
                    value={selectedProjectId?.toString() || ""}
                    onValueChange={(value) =>
                      setSelectedProjectId(value ? parseInt(value) : null)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a project or leave blank for new quote" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem
                          key={project.id}
                          value={project.id.toString()}
                        >
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Project Type */}
                <div className="space-y-4">
                  <Label className="text-base font-medium">
                    What type of project is this? *
                  </Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      {
                        id: "branding",
                        label: "Branding",
                        icon: <Target className="h-5 w-5" />,
                      },
                      {
                        id: "web_development",
                        label: "Web Development",
                        icon: <Calculator className="h-5 w-5" />,
                      },
                      {
                        id: "mobile_app",
                        label: "Mobile App",
                        icon: <Smartphone className="h-5 w-5" />,
                      },
                      {
                        id: "saas_platform",
                        label: "SaaS Platform",
                        icon: <Cloud className="h-5 w-5" />,
                      },
                      {
                        id: "marketing",
                        label: "Marketing",
                        icon: <TrendingUp className="h-5 w-5" />,
                      },
                      {
                        id: "consulting",
                        label: "Consulting",
                        icon: <Briefcase className="h-5 w-5" />,
                      },
                      {
                        id: "ecommerce",
                        label: "E-commerce",
                        icon: <ShoppingCart className="h-5 w-5" />,
                      },
                      {
                        id: "enterprise_integration",
                        label: "Enterprise Integration",
                        icon: <Network className="h-5 w-5" />,
                      },
                    ].map((type) => (
                      <Button
                        key={type.id}
                        variant={
                          projectType === type.id ? "default" : "outline"
                        }
                        className={`h-20 flex flex-col items-center justify-center space-y-2 ${
                          projectType === type.id
                            ? "bg-blue-600 hover:bg-blue-700"
                            : ""
                        }`}
                        onClick={() => setProjectType(type.id)}
                      >
                        {type.icon}
                        <span className="text-sm">{type.label}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Dynamic Questions */}
                {projectType && (
                  <div className="space-y-6 pt-6 border-t">
                    <h3 className="text-lg font-semibold flex items-center">
                      <Brain className="mr-2 h-5 w-5 text-blue-600" />
                      AI Scoping Questions
                    </h3>

                    {getScopeQuestions().map((question) => (
                      <div key={question.id} className="space-y-3">
                        <Label className="text-base">
                          {question.question}
                          {question.required && (
                            <span className="text-red-500 ml-1">*</span>
                          )}
                        </Label>

                        {question.type === "text" && (
                          <Textarea
                            placeholder="Enter your answer..."
                            value={scopeAnswers[question.id] || ""}
                            onChange={(e) =>
                              setScopeAnswers({
                                ...scopeAnswers,
                                [question.id]: e.target.value,
                              })
                            }
                            className="min-h-[100px]"
                          />
                        )}

                        {question.type === "select" && (
                          <Select
                            value={scopeAnswers[question.id] || ""}
                            onValueChange={(value) =>
                              setScopeAnswers({
                                ...scopeAnswers,
                                [question.id]: value,
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select an option..." />
                            </SelectTrigger>
                            <SelectContent>
                              {question.options?.map((option) => (
                                <SelectItem key={option} value={option}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}

                        {question.type === "number" && (
                          <Input
                            type="number"
                            placeholder="Enter number..."
                            value={scopeAnswers[question.id] || ""}
                            onChange={(e) =>
                              setScopeAnswers({
                                ...scopeAnswers,
                                [question.id]: parseInt(e.target.value) || 0,
                              })
                            }
                          />
                        )}

                        {question.type === "multiselect" && (
                          <div className="grid grid-cols-2 gap-2">
                            {question.options?.map((option) => {
                              const isSelected = (
                                scopeAnswers[question.id] || []
                              ).includes(option);
                              return (
                                <Button
                                  key={option}
                                  variant={isSelected ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => {
                                    const current =
                                      scopeAnswers[question.id] || [];
                                    const updated = isSelected
                                      ? current.filter(
                                          (item: string) => item !== option,
                                        )
                                      : [...current, option];
                                    setScopeAnswers({
                                      ...scopeAnswers,
                                      [question.id]: updated,
                                    });
                                  }}
                                  className="justify-start"
                                >
                                  {isSelected && (
                                    <Check className="mr-2 h-4 w-4" />
                                  )}
                                  {option}
                                </Button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Client Information */}
                <div className="space-y-4 pt-6 border-t">
                  <h3 className="text-lg font-semibold">Client Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Client Name</Label>
                      <Input
                        placeholder="John Doe"
                        value={clientInfo.name}
                        onChange={(e) =>
                          setClientInfo({ ...clientInfo, name: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Client Email</Label>
                      <Input
                        type="email"
                        placeholder="john@company.com"
                        value={clientInfo.email}
                        onChange={(e) =>
                          setClientInfo({
                            ...clientInfo,
                            email: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Company</Label>
                      <Input
                        placeholder="Company Name"
                        value={clientInfo.company}
                        onChange={(e) =>
                          setClientInfo({
                            ...clientInfo,
                            company: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Budget Range (Optional)</Label>
                      <Input
                        type="number"
                        placeholder="50000"
                        value={clientInfo.budget || ""}
                        onChange={(e) =>
                          setClientInfo({
                            ...clientInfo,
                            budget: parseInt(e.target.value) || undefined,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Enhanced Rate Management */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Calculator className="h-5 w-5 text-blue-600" />
                      <h3 className="text-lg font-semibold text-gray-900">
                        Hourly Rates
                      </h3>
                      <Badge variant="secondary" className="text-xs">
                        Customize
                      </Badge>
                    </div>
                    <Button
                      onClick={() => setShowAddRole(true)}
                      variant="outline"
                      size="sm"
                      className="flex items-center space-x-2"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Add Role</span>
                    </Button>
                  </div>
                  <p className="text-sm text-gray-600">
                    Set custom hourly rates for different roles to ensure
                    accurate budget estimation.
                  </p>

                  {/* Add New Role Form */}
                  {showAddRole && (
                    <Card className="bg-blue-50 border-blue-200">
                      <CardContent className="p-4">
                        <div className="flex items-center space-x-4">
                          <div className="flex-1">
                            <Label className="text-sm font-medium">
                              Role Name
                            </Label>
                            <Input
                              placeholder="e.g., UX Designer"
                              value={newRoleName}
                              onChange={(e) => setNewRoleName(e.target.value)}
                              className="mt-1"
                            />
                          </div>
                          <div className="w-32">
                            <Label className="text-sm font-medium">
                              Rate ($/hr)
                            </Label>
                            <div className="relative mt-1">
                              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                              <Input
                                type="number"
                                value={newRoleRate / 100}
                                onChange={(e) =>
                                  setNewRoleRate(
                                    parseInt(e.target.value) * 100 || 0,
                                  )
                                }
                                className="pl-8"
                                placeholder="80"
                              />
                            </div>
                          </div>
                          <div className="flex space-x-2 pt-6">
                            <Button
                              onClick={addNewRole}
                              size="sm"
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              onClick={() => {
                                setShowAddRole(false);
                                setNewRoleName("");
                                setNewRoleRate(8000);
                              }}
                              size="sm"
                              variant="outline"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Existing Roles */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(customRates).map(([role, rate]) => (
                      <div key={role} className="relative group">
                        <Card className="transition-all duration-200 hover:shadow-md border group-hover:border-blue-200">
                          <CardContent className="p-4">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label className="text-sm font-medium">
                                  {role}
                                </Label>
                                <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button
                                    onClick={() => startEditingRole(role)}
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0"
                                  >
                                    <Edit3 className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    onClick={() => deleteRole(role)}
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>

                              {editingRole === role ? (
                                <div className="flex items-center space-x-2">
                                  <div className="relative flex-1">
                                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <Input
                                      type="number"
                                      defaultValue={rate / 100}
                                      onBlur={(e) =>
                                        saveRoleEdit(
                                          role,
                                          parseInt(e.target.value) * 100 || 0,
                                        )
                                      }
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          const v = (
                                            e.target as HTMLInputElement
                                          ).value;
                                          saveRoleEdit(
                                            role,
                                            parseInt(v) * 100 || 0,
                                          );
                                        } else if (e.key === "Escape") {
                                          cancelRoleEdit();
                                        }
                                      }}
                                      className="pl-8 h-8 text-sm"
                                      autoFocus
                                    />
                                  </div>
                                  <Button
                                    onClick={() => cancelRoleEdit()}
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="relative">
                                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                  <Input
                                    type="number"
                                    value={rate / 100}
                                    onChange={(e) =>
                                      updateCustomRate(
                                        role,
                                        parseInt(e.target.value) * 100 || 0,
                                      )
                                    }
                                    className="pl-8"
                                    placeholder="120"
                                  />
                                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-gray-400">
                                    /hr
                                  </span>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    ))}
                  </div>

                  {Object.keys(customRates).length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p className="text-lg font-medium">No roles defined</p>
                      <p className="text-sm">
                        Add your first role to get started with budget
                        estimation
                      </p>
                      <Button
                        onClick={() => setShowAddRole(true)}
                        className="mt-4"
                        variant="outline"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add First Role
                      </Button>
                    </div>
                  )}
                </div>

                {/* Generate Button */}
                <div className="pt-6 border-t">
                  <Button
                    onClick={generateEstimation}
                    disabled={!projectType || isGenerating}
                    className="w-full h-12 text-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        AI is analyzing your project...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-5 w-5" />
                        Generate AI Estimation
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 2: Budget Review */}
        {currentStep === "budget" && aiEstimation && (
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-100 text-sm">Total Hours</p>
                      <p className="text-2xl font-bold">
                        {aiEstimation.totalHours}
                      </p>
                    </div>
                    <Clock className="h-8 w-8 text-blue-200" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-100 text-sm">Total Cost</p>
                      <p className="text-2xl font-bold">
                        ${(aiEstimation.totalCost / 100).toLocaleString()}
                      </p>
                    </div>
                    <DollarSign className="h-8 w-8 text-green-200" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-purple-100 text-sm">Timeline</p>
                      <p className="text-xl font-bold">
                        {aiEstimation.timeline}
                      </p>
                    </div>
                    <Calendar className="h-8 w-8 text-purple-200" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-orange-100 text-sm">Line Items</p>
                      <p className="text-2xl font-bold">
                        {aiEstimation.lineItems.length}
                      </p>
                    </div>
                    <FileText className="h-8 w-8 text-orange-200" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Budget Breakdown */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Calculator className="mr-2 h-5 w-5" />
                  Budget Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {aiEstimation.lineItems.map((item) => (
                    <div
                      key={item.id}
                      className="border rounded-lg p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      {editingLineItem === item.id ? (
                        // Edit Mode
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">
                                Category
                              </Label>
                              <Input
                                value={editedLineItem?.category || ""}
                                onChange={(e) =>
                                  setEditedLineItem((prev) =>
                                    prev
                                      ? { ...prev, category: e.target.value }
                                      : null,
                                  )
                                }
                                placeholder="Category"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">
                                Role
                              </Label>
                              <Select
                                value={editedLineItem?.role}
                                onValueChange={(value) =>
                                  setEditedLineItem((prev) =>
                                    prev ? { ...prev, role: value } : null,
                                  )
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select role" />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.keys(customRates).map((role) => (
                                    <SelectItem key={role} value={role}>
                                      {role}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-sm font-medium">
                              Description
                            </Label>
                            <Textarea
                              value={editedLineItem?.description || ""}
                              onChange={(e) =>
                                setEditedLineItem((prev) =>
                                  prev
                                    ? { ...prev, description: e.target.value }
                                    : null,
                                )
                              }
                              placeholder="Task description"
                              rows={2}
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">
                                Hours
                              </Label>
                              <Input
                                type="number"
                                value={editedLineItem?.hours || 0}
                                onChange={(e) =>
                                  setEditedLineItem((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          hours: parseInt(e.target.value) || 0,
                                        }
                                      : null,
                                  )
                                }
                                placeholder="40"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">
                                Rate/Hour ($)
                              </Label>
                              <Input
                                type="number"
                                value={
                                  editedLineItem ? editedLineItem.rate / 100 : 0
                                }
                                onChange={(e) =>
                                  setEditedLineItem((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          rate:
                                            (parseInt(e.target.value) || 0) *
                                            100,
                                        }
                                      : null,
                                  )
                                }
                                placeholder="120"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">
                                Total
                              </Label>
                              <div className="flex items-center h-10 px-3 bg-gray-100 border rounded-md">
                                <span className="font-medium">
                                  $
                                  {editedLineItem
                                    ? (
                                        (editedLineItem.hours *
                                          editedLineItem.rate) /
                                        100
                                      ).toLocaleString()
                                    : "0"}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-sm font-medium">
                              Notes (Optional)
                            </Label>
                            <Textarea
                              value={editedLineItem?.notes || ""}
                              onChange={(e) =>
                                setEditedLineItem((prev) =>
                                  prev
                                    ? { ...prev, notes: e.target.value }
                                    : null,
                                )
                              }
                              placeholder="Additional notes or requirements"
                              rows={2}
                            />
                          </div>

                          <div className="flex items-center justify-between pt-4 border-t">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={cancelEditingLineItem}
                              className="flex items-center"
                            >
                              <X className="mr-1 h-4 w-4" />
                              Cancel
                            </Button>
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                  deleteLineItem(item.id);
                                  cancelEditingLineItem();
                                }}
                                className="flex items-center"
                              >
                                <Trash2 className="mr-1 h-4 w-4" />
                                Delete
                              </Button>
                              <Button
                                size="sm"
                                onClick={saveLineItemEdit}
                                className="flex items-center bg-green-600 hover:bg-green-700"
                              >
                                <Check className="mr-1 h-4 w-4" />
                                Save Changes
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        // View Mode
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <Badge variant="outline">{item.category}</Badge>
                              <Badge variant="secondary">{item.role}</Badge>
                            </div>
                            <p className="font-medium text-gray-900">
                              {item.description}
                            </p>
                            {item.notes && (
                              <p className="text-sm text-gray-600 mt-1">
                                {item.notes}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center space-x-4">
                            <div className="text-right">
                              <p className="text-sm text-gray-600">
                                {item.hours}h × ${(item.rate / 100).toFixed(0)}
                                /hr
                              </p>
                              <p className="text-lg font-bold text-green-600">
                                ${(item.total / 100).toLocaleString()}
                              </p>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => startEditingLineItem(item)}
                                className="flex items-center"
                              >
                                <Edit3 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => deleteLineItem(item.id)}
                                className="flex items-center text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Total Summary */}
                  <div className="border-t pt-4 mt-6">
                    <div className="flex justify-between items-center">
                      <div className="space-y-1">
                        <p className="text-sm text-gray-600">
                          Total Hours: {aiEstimation.totalHours}
                        </p>
                        <p className="text-sm text-gray-600">
                          Average Rate: $
                          {aiEstimation.totalHours
                            ? Math.round(
                                aiEstimation.totalCost /
                                  aiEstimation.totalHours /
                                  100,
                              )
                            : 0}
                          /hr
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">
                          Total Project Cost
                        </p>
                        <p className="text-2xl font-bold text-green-600">
                          ${(aiEstimation.totalCost / 100).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* AI Insights */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center text-blue-600">
                    <Check className="mr-2 h-4 w-4" />
                    Assumptions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {aiEstimation.assumptions.map((assumption, index) => (
                      <li
                        key={index}
                        className="text-sm text-gray-700 flex items-start"
                      >
                        <span className="w-2 h-2 bg-blue-400 rounded-full mt-2 mr-2 flex-shrink-0" />
                        {assumption}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center text-green-600">
                    <TrendingUp className="mr-2 h-4 w-4" />
                    Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {aiEstimation.recommendations.map((rec, index) => (
                      <li
                        key={index}
                        className="text-sm text-gray-700 flex items-start"
                      >
                        <span className="w-2 h-2 bg-green-400 rounded-full mt-2 mr-2 flex-shrink-0" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center text-orange-600">
                    <AlertCircle className="mr-2 h-4 w-4" />
                    Risks
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {aiEstimation.risks.map((risk, index) => (
                      <li
                        key={index}
                        className="text-sm text-gray-700 flex items-start"
                      >
                        <span className="w-2 h-2 bg-orange-400 rounded-full mt-2 mr-2 flex-shrink-0" />
                        {risk}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep("scope")}
                  className="flex items-center"
                >
                  <Edit3 className="mr-2 h-4 w-4" />
                  Edit Scope
                </Button>

                <Button
                  variant="outline"
                  onClick={exportToExcel}
                  className="flex items-center bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                >
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Export to Excel
                </Button>
              </div>

              <Button
                onClick={() => setCurrentStep("quote")}
                className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
              >
                <FileText className="mr-2 h-4 w-4" />
                Generate Quote
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Quote Generation & SOW Review */}
        {currentStep === "quote" && aiEstimation && (
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <Card className="shadow-lg">
              <CardHeader className="bg-gradient-to-r from-green-500 to-blue-600 text-white rounded-t-lg">
                <CardTitle className="flex items-center">
                  <FileText className="mr-2 h-5 w-5" />
                  Professional Quote & Statement of Work
                </CardTitle>
                <CardDescription className="text-green-100">
                  Complete proposal ready for client review and download
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Project Overview */}
              <div className="lg:col-span-1 space-y-6">
                {/* Client Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center">
                      <Users className="mr-2 h-5 w-5" />
                      Client Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label className="text-sm font-medium text-gray-600">
                        Client Name
                      </Label>
                      <p className="text-gray-900">{clientInfo.name}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-600">
                        Company
                      </Label>
                      <p className="text-gray-900">{clientInfo.company}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-600">
                        Email
                      </Label>
                      <p className="text-gray-900">{clientInfo.email}</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Project Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center">
                      <Briefcase className="mr-2 h-5 w-5" />
                      Project Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between">
                      <span className="font-medium">Project Type:</span>
                      <span className="capitalize">
                        {projectType.replace("_", " ")}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Timeline:</span>
                      <span>{aiEstimation.timeline}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Total Hours:</span>
                      <span>{aiEstimation.totalHours} hours</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-xl font-bold text-green-600">
                      <span>Total Investment:</span>
                      <span>
                        ${(aiEstimation.totalCost / 100).toLocaleString()}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Download Actions */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center">
                      <Download className="mr-2 h-5 w-5" />
                      Download Options
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Button
                      onClick={exportToPDF}
                      className="w/full h-12 bg-red-600 hover:bg-red-700"
                    >
                      <FileDown className="mr-2 h-4 w-4" />
                      Download PDF Proposal
                    </Button>

                    <Button
                      onClick={exportQuoteToExcel}
                      variant="outline"
                      className="w-full h-12 bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                    >
                      <FileSpreadsheet className="mr-2 h-4 w-4" />
                      Download Excel SOW
                    </Button>

                    <Button
                      onClick={handleSaveClick}
                      disabled={
                        saveQuoteMutation.isPending ||
                        !aiEstimation ||
                        !projectType ||
                        !clientInfo.email?.trim()
                      }
                      variant="outline"
                      className="w-full h-12"
                    >
                      {saveQuoteMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="mr-2 h-4 w-4" />
                      )}
                      Save to Database
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column - Statement of Work Details */}
              <div className="lg:col-span-2 space-y-6">
                {/* Project Proposal Header */}
                <Card>
                  <CardContent className="p-8 text-center bg-gradient-to-r from-blue-50 to-green-50">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                      PROJECT PROPOSAL
                    </h1>
                    <p className="text-xl text-gray-600">
                      for {clientInfo.company || clientInfo.name}
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                      Prepared on {new Date().toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>

                {/* Statement of Work */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl flex items-center">
                      <Eye className="mr-2 h-5 w-5" />
                      Statement of Work
                    </CardTitle>
                    <CardDescription>
                      Detailed breakdown of all project deliverables and
                      services
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {aiEstimation.lineItems.map((item) => (
                        <div
                          key={item.id}
                          className="border rounded-lg p-4 bg-gray-50"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-2">
                                <Badge variant="outline" className="text-xs">
                                  {item.category}
                                </Badge>
                                <Badge variant="secondary" className="text-xs">
                                  {item.role}
                                </Badge>
                              </div>
                              <h4 className="font-semibold text-gray-900">
                                {item.description}
                              </h4>
                              {item.notes && (
                                <p className="text-sm text-gray-600 mt-1">
                                  {item.notes}
                                </p>
                              )}
                            </div>
                            <div className="text-right ml-4">
                              <p className="text-sm text-gray-600">
                                {item.hours}h × ${(item.rate / 100).toFixed(0)}
                                /hr
                              </p>
                              <p className="text-lg font-bold text-green-600">
                                ${(item.total / 100).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Total */}
                      <div className="border-t pt-4">
                        <div className="flex justify-between items-center text-xl font-bold">
                          <span>Total Project Investment:</span>
                          <span className="text-green-600">
                            ${(aiEstimation.totalCost / 100).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Project Terms & Conditions */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center text-blue-600">
                        <Target className="mr-2 h-4 w-4" />
                        Assumptions
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {aiEstimation.assumptions.map((assumption, index) => (
                          <li
                            key={index}
                            className="text-sm text-gray-700 flex items-start"
                          >
                            <span className="w-2 h-2 bg-blue-400 rounded-full mt-2 mr-2 flex-shrink-0" />
                            {assumption}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center text-green-600">
                        <TrendingUp className="mr-2 h-4 w-4" />
                        Recommendations
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {aiEstimation.recommendations.map((rec, index) => (
                          <li
                            key={index}
                            className="text-sm text-gray-700 flex items-start"
                          >
                            <span className="w-2 h-2 bg-green-400 rounded-full mt-2 mr-2 flex-shrink-0" />
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center text-orange-600">
                        <AlertCircle className="mr-2 h-4 w-4" />
                        Risk Factors
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {aiEstimation.risks.map((risk, index) => (
                          <li
                            key={index}
                            className="text-sm text-gray-700 flex items-start"
                          >
                            <span className="w-2 h-2 bg-orange-400 rounded-full mt-2 mr-2 flex-shrink-0" />
                            {risk}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </div>

                {/* Navigation Actions */}
                <div className="flex items-center justify-between pt-6">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentStep("budget")}
                    className="flex items-center"
                  >
                    <Edit3 className="mr-2 h-4 w-4" />
                    Edit Budget
                  </Button>

                  <div className="text-center">
                    <p className="text-sm text-gray-500">
                      Quote ready for client delivery
                    </p>
                    <p className="text-xs text-gray-400">
                      Valid for 30 days from proposal date
                    </p>
                  </div>

                  <Button
                    variant="outline"
                    disabled={!savedQuoteId}
                    className="flex items-center"
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    Email to Client
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Success Message */}
        {savedQuoteId && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center">
                <Check className="h-5 w-5 text-green-600 mr-2" />
                <span className="text-green-800 font-medium">
                  Quote saved successfully! ID: #{savedQuoteId}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
