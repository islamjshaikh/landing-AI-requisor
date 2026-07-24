import { OpenAI } from "openai";
import { getAiClient, userHasOwnKey } from "./ai-provider";
import fs from "fs/promises";
import path from "path";
import * as csv from "csv-parse/sync";
import { existsSync } from "fs";
import { trackTokenUsage } from "./token-tracker";

const openai = (getAiClient() as any);

export interface ProcessedFile {
  content: string;
  metadata: {
    fileName: string;
    fileType: string;
    fileSize: number;
  };
}

export interface FileProcessingResult {
  message: string;
  summary?: string;
  projectPlan?: any;
  projectCanvas?: any;
  extractedData?: any;
  generatedPrompt?: string; // Raw file content for combining with user input later
}

export class FileProcessor {
  async processFiles(
    files: Express.Multer.File[],
    userPrompt: string = "",
  ): Promise<FileProcessingResult> {
    try {
      const processedFiles: ProcessedFile[] = [];

      for (const file of files) {
        const processed = await this.processFile(file);
        processedFiles.push(processed);
      }

      // Combine all file contents
      const combinedContent = processedFiles
        .map((f) => `File: ${f.metadata.fileName}\n\n${f.content}`)
        .join("\n\n---\n\n");

      // Use AI to analyze the content with user context
      const analysis = await this.analyzeContent(
        combinedContent,
        processedFiles,
        userPrompt,
      );

      return analysis;
    } catch (error) {
      console.error("Error processing files:", error);
      throw new Error("Failed to process uploaded files");
    }
  }

  private async processFile(file: Express.Multer.File): Promise<ProcessedFile> {
    const filePath = file.path;
    const fileType = file.mimetype;
    let content = "";

    try {
      if (fileType === "text/plain") {
        // Process plain text files
        content = await fs.readFile(filePath, "utf-8");
      } else if (
        fileType === "text/csv" ||
        file.originalname.toLowerCase().endsWith(".csv")
      ) {
        // Enhanced CSV processing
        try {
          const csvContent = await fs.readFile(filePath, "utf-8");
          const records = csv.parse(csvContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
            cast: true,
            cast_date: true,
          });

          // Create a more structured representation for CSV data
          const csvAnalysis = {
            filename: file.originalname,
            totalRows: records.length,
            columns: Object.keys(records[0] || {}),
            columnCount: Object.keys(records[0] || {}).length,
            sampleData: records.slice(0, 5), // First 5 rows as sample
            dataTypes: this.analyzeCSVDataTypes(records),
            summary: `CSV file with ${records.length} rows and ${Object.keys(records[0] || {}).length} columns`,
          };

          content = `CSV DATA ANALYSIS:
File: ${file.originalname}
Rows: ${records.length}
Columns: ${csvAnalysis.columns.join(", ")}

SAMPLE DATA (First 5 rows):
${JSON.stringify(csvAnalysis.sampleData, null, 2)}

DATA STRUCTURE:
${JSON.stringify(csvAnalysis.dataTypes, null, 2)}

This CSV contains structured data that may represent project requirements, resource allocation, timelines, budgets, or stakeholder information that should be analyzed for project planning purposes.`;

          console.log(
            "Successfully parsed CSV with enhanced analysis:",
            file.originalname,
          );
        } catch (csvError) {
          console.error("Error parsing CSV:", csvError);
          const rawContent = await fs.readFile(filePath, "utf-8");
          content = `[CSV file: ${file.originalname} - Raw content preview: ${rawContent.substring(0, 500)}...]`;
        }
      } else if (fileType.includes("image/")) {
        // For images, we'll just note their presence
        // In a real implementation, you'd use OCR here
        content = `[Image file: ${file.originalname}]`;
      } else if (fileType === "application/pdf") {
        // Parse PDF files
        try {
          const pdfParse = (await import("pdf-parse-new")).default;
          const dataBuffer = await fs.readFile(filePath);
          const pdfData = await pdfParse(dataBuffer);
          // Sanitize content to remove null bytes which PostgreSQL doesn't accept
          content = pdfData.text.replace(/\x00/g, '');
          console.log("Successfully parsed PDF:", file.originalname);
        } catch (pdfError) {
          console.error("Error parsing PDF:", pdfError);
          content = `[PDF file: ${file.originalname} - Error extracting text. Please provide a summary of this document.]`;
        }
      } else if (
        fileType ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        fileType === "application/msword"
      ) {
        // Parse Word documents using mammoth
        try {
          const mammoth = (await import("mammoth")).default;
          const dataBuffer = await fs.readFile(filePath);
          const result = await mammoth.extractRawText({ buffer: dataBuffer });
          content = result.value;
          console.log("Successfully parsed Word document:", file.originalname);
        } catch (docError) {
          console.error("Error parsing Word document:", docError);
          // Fallback to alternative parsing method
          content = `[Word document: ${file.originalname} - Unable to extract text content. Please provide a summary of this document.]`;
        }
      } else if (
        fileType ===
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        fileType === "application/vnd.ms-excel"
      ) {
        // For Excel files, we'll read them with xlsx which is already installed
        try {
          const XLSX = (await import("xlsx")).default;
          const workbook = XLSX.readFile(filePath);
          const sheets: Record<string, any> = {};
          workbook.SheetNames.forEach((sheetName: string) => {
            sheets[sheetName] = XLSX.utils.sheet_to_json(
              workbook.Sheets[sheetName],
            );
          });
          content = JSON.stringify(sheets, null, 2);
        } catch (xlsxError) {
          console.error("Error parsing Excel:", xlsxError);
          content = `[Excel file: ${file.originalname} - Unable to extract data. Please provide a summary of this spreadsheet.]`;
        }
      } else if (
        fileType ===
          "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
        fileType === "application/vnd.ms-powerpoint" ||
        file.originalname.toLowerCase().endsWith(".pptx") ||
        file.originalname.toLowerCase().endsWith(".ppt")
      ) {
        // Enhanced PowerPoint processing
        try {
          const pptx2json = (await import("pptx2json")).default;
          const result = await pptx2json.toJson(filePath);

          // Extract text content from slides
          let slideContent = "";
          let slideCount = 0;

          if (result && result.slides) {
            result.slides.forEach((slide: any, index: number) => {
              slideCount++;
              slideContent += `\n--- SLIDE ${index + 1} ---\n`;

              if (slide.title) {
                slideContent += `Title: ${slide.title}\n`;
              }

              if (slide.content && Array.isArray(slide.content)) {
                slide.content.forEach((item: any) => {
                  if (typeof item === "string") {
                    slideContent += `${item}\n`;
                  } else if (item.text) {
                    slideContent += `${item.text}\n`;
                  }
                });
              }
            });
          }

          content = `POWERPOINT PRESENTATION ANALYSIS:
File: ${file.originalname}
Total Slides: ${slideCount}

EXTRACTED CONTENT:
${slideContent}

This PowerPoint presentation contains ${slideCount} slides with content that may include project requirements, timelines, stakeholder information, technical specifications, or business objectives that should be analyzed for comprehensive project planning.`;

          console.log(
            "Successfully parsed PowerPoint presentation:",
            file.originalname,
            `(${slideCount} slides)`,
          );
        } catch (pptError) {
          console.error("Error parsing PowerPoint:", pptError);
          // Fallback for PowerPoint files
          content = `POWERPOINT PRESENTATION: ${file.originalname}

This is a PowerPoint presentation that likely contains:
- Project requirements and specifications
- Timeline and milestone information  
- Stakeholder and team information
- Technical architecture or system designs
- Business objectives and success criteria
- Resource allocation and budget information

Please analyze this presentation for project planning purposes. The presentation may contain visual elements, charts, and diagrams that provide important context for the project scope and requirements.`;
        }
      } else if (fileType === "application/rtf" || fileType === "text/rtf") {
        // Handle RTF files
        try {
          const rtfContent = await fs.readFile(filePath, "utf-8");
          // Basic RTF to text conversion (remove RTF formatting)
          content = rtfContent
            .replace(/\\[a-z]+[0-9]*\s*/gi, "")
            .replace(/[{}]/g, "")
            .trim();
          console.log("Successfully parsed RTF file:", file.originalname);
        } catch (rtfError) {
          console.error("Error parsing RTF:", rtfError);
          content = `[RTF document: ${file.originalname} - Please provide a summary of this document.]`;
        }
      } else if (fileType === "application/json") {
        // Handle JSON files
        try {
          const jsonContent = await fs.readFile(filePath, "utf-8");
          const parsed = JSON.parse(jsonContent);
          content = JSON.stringify(parsed, null, 2);
          console.log("Successfully parsed JSON file:", file.originalname);
        } catch (jsonError) {
          console.error("Error parsing JSON:", jsonError);
          content = `[JSON file: ${file.originalname} - Invalid JSON format]`;
        }
      } else if (fileType === "text/xml" || fileType === "application/xml") {
        // Handle XML files
        try {
          content = await fs.readFile(filePath, "utf-8");
          console.log("Successfully read XML file:", file.originalname);
        } catch (xmlError) {
          console.error("Error reading XML:", xmlError);
          content = `[XML file: ${file.originalname} - Unable to read content]`;
        }
      } else {
        content = `[${file.originalname} - File type: ${fileType} - Please describe the content of this file if it contains project-relevant information.]`;
      }

      // Clean up the uploaded file
      await fs.unlink(filePath).catch(() => {});

      return {
        content,
        metadata: {
          fileName: file.originalname,
          fileType: file.mimetype,
          fileSize: file.size,
        },
      };
    } catch (error) {
      console.error(`Error processing file ${file.originalname}:`, error);
      // Clean up on error
      await fs.unlink(filePath).catch(() => {});
      throw error;
    }
  }

  private async analyzeContent(
    content: string,
    files: ProcessedFile[],
    userPrompt: string = "",
  ): Promise<FileProcessingResult> {
    if (!process.env.OPENAI_API_KEY && !(await userHasOwnKey())) {
      return {
        message:
          "I've received your files but need an AI provider to analyze them. Add your own Claude key in Settings, or describe what's in these files so I can help create a project plan.",
        summary: `Received ${files.length} file(s): ${files.map((f) => f.metadata.fileName).join(", ")}`,
      };
    }

    // Calculate total file size for processing optimization
    const totalSize = files.reduce(
      (sum, file) => sum + file.metadata.fileSize,
      0,
    );
    const isLargeDocumentSet = totalSize > 20 * 1024 * 1024; // 20MB+

    // Determine if user wants to generate a plan or just extract content
    const hasUserPrompt = userPrompt && userPrompt.trim().length > 0;
    const shouldGeneratePlan = hasUserPrompt && this.hasGeneratePlanIntent(userPrompt);

    try {
      // If no user prompt or no plan generation intent, just extract and summarize content
      if (!shouldGeneratePlan) {
        return await this.extractContentOnly(content, files, totalSize);
      }

      // For large document sets, use enhanced analysis with chunking strategy
      const systemPrompt = isLargeDocumentSet
        ? this.getLargeDocumentAnalysisPrompt()
        : this.getStandardAnalysisPrompt();

      // Build user message with user prompt context
      let userMessage = this.formatContentForAnalysis(
        content,
        files,
        isLargeDocumentSet,
      );
      userMessage = `USER CONTEXT AND INSTRUCTIONS:\n${userPrompt.trim()}\n\n---\n\nDOCUMENT CONTENT:\n${userMessage}`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userMessage,
          },
        ],
        temperature: 0.7,
        max_tokens: isLargeDocumentSet ? 6000 : 4000,
        response_format: { type: "json_object" },
      });

      if (completion.usage) {
        trackTokenUsage("system", "file-analysis", "gpt-4o", completion.usage).catch(() => {});
      }

      const response = completion.choices[0].message.content || "";

      try {
        const parsed = JSON.parse(response);
        return {
          message:
            parsed.message ||
            "I've analyzed your client requirement documents and created a comprehensive project plan.",
          summary: parsed.summary,
          projectPlan: parsed.projectPlan,
          projectCanvas: parsed.projectPlan,
          extractedData: parsed.extractedData,
        };
      } catch (e) {
        console.log(
          "Response was not valid JSON, falling back to enhanced analysis",
        );
        const enhancedPlan = this.generateEnhancedPlan(files, content);
        return {
          message:
            "I've analyzed your client requirement documents and created a detailed project plan. The plan includes comprehensive analysis phases for large document sets.",
          summary: `Analyzed ${files.length} file(s) totaling ${(totalSize / 1024 / 1024).toFixed(1)}MB: ${files.map((f) => f.metadata.fileName).join(", ")}`,
          projectPlan: enhancedPlan,
          projectCanvas: enhancedPlan,
        };
      }
    } catch (error) {
      console.error("Error analyzing content with AI:", error);
      return {
        message:
          "I've received your client requirement documents but encountered an analysis error. I can still help you create a structured project plan - please describe the key objectives from these documents.",
        summary: `Received ${files.length} file(s) totaling ${(totalSize / 1024 / 1024).toFixed(1)}MB: ${files.map((f) => f.metadata.fileName).join(", ")}`,
      };
    }
  }

  // Check if user prompt indicates intent to generate a project plan
  private hasGeneratePlanIntent(userPrompt: string): boolean {
    const lowerPrompt = userPrompt.toLowerCase();
    const planKeywords = [
      'generate plan', 'create plan', 'make plan', 'build plan',
      'generate project', 'create project', 'make project',
      'plan for', 'plan focusing', 'plan based',
      'create a plan', 'generate a plan', 'make a plan',
      'project plan', 'action plan', 'implementation plan',
      'roadmap', 'milestones', 'tasks',
      'schedule', 'timeline', 'phases'
    ];
    return planKeywords.some(keyword => lowerPrompt.includes(keyword));
  }

  // Extract and summarize file content without generating a full project plan
  private async extractContentOnly(
    content: string,
    files: ProcessedFile[],
    totalSize: number,
  ): Promise<FileProcessingResult> {
    const fileNames = files.map((f) => f.metadata.fileName).join(", ");
    const sizeText = totalSize > 1024 * 1024 
      ? `${(totalSize / 1024 / 1024).toFixed(1)}MB` 
      : `${(totalSize / 1024).toFixed(1)}KB`;

    try {
      // Use AI to create a brief summary without generating a project plan
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a document analysis assistant. Your task is to ONLY summarize the content of uploaded files. 
DO NOT generate any project plans, milestones, or tasks.
DO NOT assume what the user wants to do with the content.
Simply extract key information and provide a brief summary.

Your response MUST be in this JSON format:
{
  "summary": "2-3 sentence summary of what the documents contain",
  "extractedData": {
    "keyTopics": ["Main topics found in the documents"],
    "keyEntities": ["Important names, organizations, or concepts mentioned"],
    "documentType": "Brief description of what type of documents these are"
  },
  "fileContent": "The raw extracted text content (first 2000 chars if longer)"
}`
          },
          {
            role: "user",
            content: `Please summarize the following document content:\n\n${content.substring(0, 8000)}`
          }
        ],
        temperature: 0.3,
        max_tokens: 1500,
        response_format: { type: "json_object" },
      });

      if (completion.usage) {
        trackTokenUsage("system", "file-summary", "gpt-4o", completion.usage).catch(() => {});
      }

      const response = completion.choices[0].message.content || "";
      const parsed = JSON.parse(response);

      return {
        message: `I've analyzed ${files.length} file(s). ${parsed.summary || ''}\n\nPlease describe what you'd like to do with this content - for example, "create a plan focusing on marketing strategy" or "generate a project timeline for implementation".`,
        summary: parsed.summary || `Analyzed ${files.length} file(s): ${fileNames}`,
        extractedData: parsed.extractedData,
        // Store the file content for later use when user provides instructions
        generatedPrompt: content.substring(0, 10000),
      };
    } catch (error) {
      console.error("Error extracting content:", error);
      // Fallback without AI
      return {
        message: `I've received ${files.length} file(s) (${sizeText}): ${fileNames}.\n\nPlease describe what you'd like to do with this content - for example, "create a plan focusing on X" or "generate a project timeline".`,
        summary: `Received ${files.length} file(s): ${fileNames}`,
        generatedPrompt: content.substring(0, 10000),
      };
    }
  }

  private getLargeDocumentAnalysisPrompt(): string {
    return `You are an expert business analyst specializing in large-scale client requirement document analysis for enterprise projects.

            LARGE DOCUMENT SET ANALYSIS FRAMEWORK:
            1. COMPREHENSIVE EXTRACTION: Parse requirements across multiple documents, identifying cross-references, dependencies, and conflicting specifications
            2. STAKEHOLDER MAPPING: Extract all mentioned stakeholders, their roles, responsibilities, and decision-making authority
            3. SCOPE ANALYSIS: Identify functional, non-functional, technical, business, and compliance requirements
            4. RISK ASSESSMENT: Analyze document complexity, ambiguities, missing information, and potential scope creep areas
            5. TIMELINE & BUDGET EXTRACTION: Extract all mentioned deadlines, phases, budget constraints, and resource requirements
            6. INTEGRATION POINTS: Identify system integrations, data flows, API requirements, and technical dependencies
            7. COMPLIANCE & REGULATORY: Extract industry standards, regulatory requirements, security protocols, and audit needs

            PROJECT PLAN GENERATION FOR LARGE PROJECTS:
            - Generate 4-6 major phases with 4-8 tasks each for comprehensive coverage
            - Include dedicated requirement analysis and validation phases
            - Add stakeholder review and approval gates
            - Include risk mitigation and contingency planning
            - Map each task to specific document sections/requirements
            - Include resource allocation and expertise requirements
            - Add quality gates and testing phases
            - Include documentation and knowledge transfer phases

            ENHANCED TASK DESCRIPTIONS (4-6 sentences each):
            • Specific deliverable with measurable acceptance criteria
            • Business impact and strategic alignment
            • Technical approach, tools, and methodologies
            • Stakeholder involvement and approval requirements
            • Risk factors and mitigation strategies
            • Success metrics and validation methods

            Your response MUST be in this JSON format:
            {
              "projectPlan": {
                "name": "Compelling project name based on document content",
                "description": "Comprehensive 5-7 sentence executive summary including problem, solution, approach, impact, and stakeholders",
                "startDate": "YYYY-MM-DD",
                "endDate": "YYYY-MM-DD",
                "milestones": [
                  {
                    "name": "Specific milestone name",
                    "description": "2-3 sentences explaining the milestone's business value and deliverables",
                    "dueDate": "YYYY-MM-DD",
                    "priority": "high/medium/low",
                    "tasks": [
                      {
                        "name": "Action-oriented task with specific deliverable",
                        "description": "4-6 sentences: What deliverable will be created, why it matters, how it will be done, what tools/tech will be used, what success looks like",
                        "dueDate": "YYYY-MM-DD",
                        "priority": "high/medium/low"
                      }
                    ]
                  }
                ]
              },
              "summary": "2-3 sentences summarizing key findings from the documents",
              "message": "Friendly explanation of what was found and how the project plan addresses it",
              "extractedData": {
                "keyRequirements": ["List of extracted requirements"],
                "stakeholders": ["List of identified stakeholders"], 
                "constraints": ["Budget, timeline, technical constraints"],
                "risks": ["Identified risks from the document"]
              }
            }

            CRITICAL: Every task must reference specific content from the uploaded documents. Never generate generic tasks.`;
  }

  private getStandardAnalysisPrompt(): string {
    return `You are an elite business strategist and project architect analyzing uploaded documents to create comprehensive project plans.

            DOCUMENT ANALYSIS FRAMEWORK:
            1. Extract ALL key information: objectives, requirements, constraints, stakeholders, timelines, budgets
            2. Identify implicit needs and unstated assumptions
            3. Map dependencies, risks, and success criteria
            4. Recognize industry context and compliance requirements
            5. Detect technical specifications and integration points

            PROJECT PLAN GENERATION RULES:
            - Generate 3-5 major milestones with 3-6 tasks each
            - Each task must be SPECIFIC with measurable deliverables
            - Include detailed descriptions (3-5 sentences per task) covering:
              • Specific deliverable and acceptance criteria
              • Business rationale and impact
              • Technical approach and tools
              • Dependencies and risks
              • Success metrics
            - Use industry-specific terminology from the document
            - Include AI tool recommendations for acceleration
            - Map tasks to document requirements

            Your response MUST be in this JSON format:
            {
              "projectPlan": {
                "name": "Compelling project name based on document content",
                "description": "Comprehensive 5-7 sentence executive summary including problem, solution, approach, impact, and stakeholders",
                "startDate": "YYYY-MM-DD",
                "endDate": "YYYY-MM-DD",
                "milestones": [
                  {
                    "name": "Specific milestone name",
                    "description": "2-3 sentences explaining the milestone's business value and deliverables",
                    "dueDate": "YYYY-MM-DD",
                    "priority": "high/medium/low",
                    "tasks": [
                      {
                        "name": "Action-oriented task with specific deliverable",
                        "description": "3-5 sentences: What deliverable will be created, why it matters, how it will be done, what tools/tech will be used, what success looks like",
                        "dueDate": "YYYY-MM-DD",
                        "priority": "high/medium/low"
                      }
                    ]
                  }
                ]
              },
              "summary": "2-3 sentences summarizing key findings from the documents",
              "message": "Friendly explanation of what was found and how the project plan addresses it",
              "extractedData": {
                "keyRequirements": ["List of extracted requirements"],
                "stakeholders": ["List of identified stakeholders"],
                "constraints": ["Budget, timeline, technical constraints"],
                "risks": ["Identified risks from the document"]
              }
            }

            CRITICAL: Every task must reference specific content from the uploaded documents. Never generate generic tasks.`;
  }

  private formatContentForAnalysis(
    content: string,
    files: ProcessedFile[],
    isLargeDocumentSet: boolean,
  ): string {
    if (isLargeDocumentSet) {
      return `LARGE DOCUMENT SET ANALYSIS (${files.length} files, ${(files.reduce((sum, f) => sum + f.metadata.fileSize, 0) / 1024 / 1024).toFixed(1)}MB total):

FILES OVERVIEW:
${files.map((f) => `- ${f.metadata.fileName} (${f.metadata.fileType}, ${(f.metadata.fileSize / 1024).toFixed(1)}KB)`).join("\n")}

DOCUMENT CONTENT FOR ANALYSIS:
${content}

ANALYSIS REQUIREMENTS:
Please conduct a comprehensive analysis focusing on:
1. Cross-document requirement dependencies and conflicts
2. Stakeholder roles and decision-making hierarchy
3. Technical integration points and system requirements
4. Compliance, regulatory, and security considerations
5. Resource requirements, timelines, and budget constraints
6. Risk factors and mitigation strategies across all documents`;
    } else {
      return `Please analyze these uploaded files and create a structured project plan:

FILES:
${files.map((f) => `- ${f.metadata.fileName} (${f.metadata.fileType})`).join("\n")}

CONTENT:
${content}`;
    }
  }

  private generateEnhancedPlan(files: ProcessedFile[], content: string): any {
    const today = new Date();
    const startDate = today.toISOString().split("T")[0];
    const totalSize = files.reduce(
      (sum, file) => sum + file.metadata.fileSize,
      0,
    );
    const isLargeProject = totalSize > 20 * 1024 * 1024;
    const projectDuration = isLargeProject ? 12 : 8; // weeks
    const endDate = new Date(
      today.getTime() + projectDuration * 7 * 24 * 60 * 60 * 1000,
    )
      .toISOString()
      .split("T")[0];

    const fileNames = files.map((f) => f.metadata.fileName).join(", ");

    return {
      name: `Client Requirements Implementation Project - ${files[0]?.metadata.fileName.split(".")[0] || "Enterprise"}`,
      description: `Comprehensive project plan derived from ${files.length} client requirement document(s) totaling ${(totalSize / 1024 / 1024).toFixed(1)}MB. This enterprise-grade implementation addresses all specified requirements, stakeholder needs, technical specifications, and compliance standards outlined in the documentation. The project includes thorough analysis phases, iterative development cycles, quality assurance protocols, and stakeholder validation processes to ensure successful delivery of all documented objectives and requirements.`,
      startDate,
      endDate,
      milestones: [
        {
          id: "milestone-1",
          name: "Comprehensive Requirements Analysis & Validation",
          description:
            "Deep dive analysis of all client requirement documents to extract, validate, and prioritize functional and non-functional requirements. Includes stakeholder mapping, constraint identification, and risk assessment based on documented specifications.",
          dueDate: new Date(today.getTime() + 2 * 7 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0],
          priority: "high",
          tasks: [
            {
              id: "task-1-1",
              name: "Multi-Document Requirements Extraction",
              description: `Systematically parse and extract all requirements from the uploaded documents (${fileNames}). Create a comprehensive requirements matrix mapping functional, non-functional, technical, and business requirements. Identify cross-document dependencies, conflicts, and integration points. Use advanced analysis tools to ensure no requirements are overlooked in the ${(totalSize / 1024 / 1024).toFixed(1)}MB of documentation.`,
              dueDate: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0],
              priority: "high",
              status: "To Do",
            },
            {
              id: "task-1-2",
              name: "Stakeholder Impact Analysis",
              description: `Analyze all stakeholder roles, responsibilities, and decision-making authority mentioned in the client documents. Create stakeholder mapping with influence levels, communication preferences, and approval requirements. Identify potential conflicts between stakeholder requirements and establish escalation protocols for requirement clarifications based on the documented organizational structure.`,
              dueDate: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0],
              priority: "high",
              status: "To Do",
            },
            {
              id: "task-1-3",
              name: "Technical Architecture Assessment",
              description: `Review all technical specifications, system integrations, and infrastructure requirements documented in the client files. Assess compatibility with existing systems, identify potential technical risks, and create detailed technical architecture recommendations. Document all API requirements, data flow specifications, and security protocols mentioned in the requirements.`,
              dueDate: new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0],
              priority: "high",
              status: "To Do",
            },
            {
              id: "task-1-4",
              name: "Compliance & Risk Validation",
              description: `Identify all regulatory, compliance, and security requirements specified in the client documentation. Assess project risks including technical, timeline, budget, and scope risks mentioned in the documents. Create comprehensive risk mitigation strategies and compliance validation procedures to ensure all documented standards and regulations are addressed.`,
              dueDate: new Date(today.getTime() + 12 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0],
              priority: "medium",
              status: "To Do",
            },
          ],
        },
        {
          id: "milestone-2",
          name: "Project Planning & Design Phase",
          description:
            "Develop detailed project plans, technical designs, and implementation strategies based on validated requirements. Create work breakdown structures, resource allocation plans, and quality assurance protocols.",
          dueDate: new Date(today.getTime() + 4 * 7 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0],
          priority: "high",
          tasks: [
            {
              id: "task-2-1",
              name: "Detailed Work Breakdown Structure",
              description: `Create comprehensive work breakdown structure based on all requirements extracted from client documents. Define specific deliverables, acceptance criteria, and quality gates for each requirement category. Establish dependencies between tasks and create critical path analysis to optimize project timeline while addressing all documented objectives.`,
              dueDate: new Date(today.getTime() + 17 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0],
              priority: "high",
              status: "To Do",
            },
            {
              id: "task-2-2",
              name: "Resource Allocation & Team Structure",
              description: `Define team structure, skill requirements, and resource allocation based on technical and functional requirements documented in client files. Identify specialized expertise needed for compliance, integration, and technical implementation. Create staffing plan with clear roles and responsibilities aligned with project requirements and stakeholder expectations.`,
              dueDate: new Date(today.getTime() + 21 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0],
              priority: "high",
              status: "To Do",
            },
            {
              id: "task-2-3",
              name: "Quality Assurance Framework Design",
              description: `Develop comprehensive QA framework addressing all quality standards and testing requirements specified in client documentation. Create test plans for functional, performance, security, and compliance testing. Define quality gates, review processes, and validation criteria to ensure all documented requirements are met before delivery.`,
              dueDate: new Date(today.getTime() + 24 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0],
              priority: "medium",
              status: "To Do",
            },
          ],
        },
        {
          id: "milestone-3",
          name: isLargeProject
            ? "Phase 1 Implementation & Integration"
            : "Core Implementation",
          description: isLargeProject
            ? "Execute first phase of implementation focusing on core functionality and critical integrations as prioritized in requirements analysis."
            : "Implement core functionality and features as specified in client requirements documentation.",
          dueDate: new Date(today.getTime() + 8 * 7 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0],
          priority: "high",
          tasks: [
            {
              id: "task-3-1",
              name: "Core Feature Development",
              description: `Implement primary features and functionality as specified in the client requirement documents. Focus on delivering key business objectives and critical user workflows identified in the analysis phase. Ensure all development follows documented technical specifications, coding standards, and integration requirements outlined in the project documentation.`,
              dueDate: new Date(today.getTime() + 6 * 7 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0],
              priority: "high",
              status: "To Do",
            },
            {
              id: "task-3-2",
              name: "System Integration Implementation",
              description: `Execute all system integrations, API connections, and data flows specified in the client requirements. Implement security protocols, authentication mechanisms, and data validation procedures as documented. Ensure all integrations meet performance requirements and compliance standards outlined in the specification documents.`,
              dueDate: new Date(today.getTime() + 7 * 7 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0],
              priority: "high",
              status: "To Do",
            },
          ],
        },
      ],
    };
  }

  private generateBasicPlan(files: ProcessedFile[]): any {
    const today = new Date();
    const startDate = today.toISOString().split("T")[0];
    const endDate = new Date(today.getTime() + 6 * 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0]; // 6 weeks later

    return {
      name: `Project based on ${files[0]?.metadata.fileName || "uploaded documents"}`,
      description: `This project plan was generated from the uploaded documents: ${files.map((f) => f.metadata.fileName).join(", ")}. The plan includes initial analysis, planning, execution, and review phases to address the requirements and objectives outlined in the documentation.`,
      startDate,
      endDate,
      milestones: [
        {
          id: "milestone-1",
          name: "Analysis & Planning",
          description:
            "Review uploaded documents, clarify requirements, and establish project foundation.",
          dueDate: new Date(today.getTime() + 1 * 7 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0],
          priority: "high",
          tasks: [
            {
              id: "task-1-1",
              name: "Document Analysis",
              description:
                "Thoroughly review and analyze all uploaded documents to extract key requirements, objectives, and constraints.",
              dueDate: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0],
              priority: "high",
              status: "To Do",
            },
            {
              id: "task-1-2",
              name: "Requirements Gathering",
              description:
                "Conduct stakeholder interviews and clarify any ambiguous requirements from the documentation.",
              dueDate: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0],
              priority: "high",
              status: "To Do",
            },
          ],
        },
        {
          id: "milestone-2",
          name: "Implementation",
          description:
            "Execute the main deliverables and objectives outlined in the project documentation.",
          dueDate: new Date(today.getTime() + 4 * 7 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0],
          priority: "high",
          tasks: [
            {
              id: "task-2-1",
              name: "Core Development",
              description:
                "Implement the primary features and functionality as specified in the project requirements.",
              dueDate: new Date(today.getTime() + 3 * 7 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0],
              priority: "high",
              status: "To Do",
            },
            {
              id: "task-2-2",
              name: "Testing & Quality Assurance",
              description:
                "Conduct comprehensive testing to ensure all deliverables meet quality standards and requirements.",
              dueDate: new Date(today.getTime() + 3.5 * 7 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0],
              priority: "medium",
              status: "To Do",
            },
          ],
        },
      ],
    };
  }

  private static analyzeCSVDataTypes(
    records: any[],
  ): Record<string, { type: string; sampleValues: any[] }> {
    if (!records || records.length === 0) return {};

    const analysis: Record<string, { type: string; sampleValues: any[] }> = {};
    const sampleRecord = records[0];

    Object.keys(sampleRecord).forEach((column) => {
      const values = records
        .slice(0, 10)
        .map((record) => record[column])
        .filter((val) => val !== null && val !== undefined && val !== "");
      const sampleValues = values.slice(0, 3); // First 3 non-empty values

      // Determine data type
      let type = "text";
      if (values.every((val) => !isNaN(Number(val)) && val !== "")) {
        type = "numeric";
      } else if (
        values.some(
          (val) =>
            /^\d{4}-\d{2}-\d{2}/.test(val) ||
            /^\d{1,2}\/\d{1,2}\/\d{4}/.test(val),
        )
      ) {
        type = "date";
      } else if (
        values.some(
          (val) =>
            typeof val === "boolean" ||
            val === "true" ||
            val === "false" ||
            val === "yes" ||
            val === "no",
        )
      ) {
        type = "boolean";
      }

      analysis[column] = { type, sampleValues };
    });

    return analysis;
  }
}

export const fileProcessor = new FileProcessor();
