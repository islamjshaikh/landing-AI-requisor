import OpenAI from 'openai';
import { getAiClient } from "./ai-provider";
import { trackTokenUsage } from './token-tracker';

interface AiTool {
  id: number;
  name: string;
  description: string;
  category: string;
  website?: string;
  pricing?: string;
}

interface WorkflowNode {
  id: string;
  name: string;
  description: string;
  role: string;
  category: string;
  website?: string;
  pricing?: string;
}

interface WorkflowEdge {
  from: string;
  to: string;
  description: string;
}

interface GeneratedWorkflow {
  name: string;
  description: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  explanation: string;
}

export async function generateWorkflow(query: string, aiTools: AiTool[]): Promise<GeneratedWorkflow> {
  const openai = (getAiClient() as any);

  try {
    const systemPrompt = `You are an AI workflow architect that creates intelligent sequences of AI tools to accomplish specific tasks.

AVAILABLE TOOLS:
${aiTools.slice(0, 50).map(tool => `- ${tool.name}: ${tool.description} (Category: ${tool.category})`).join('\n')}

INSTRUCTIONS:
1. Analyze the user's query to understand their goal
2. Select 2-5 AI tools that work together logically 
3. Create a workflow where outputs from one tool feed into the next
4. Focus on practical, real workflows that make sense
5. Avoid random tool selection - ensure genuine complementarity
6. Provide clear explanations for tool selection and flow

RESPONSE FORMAT (JSON):
{
  "name": "Workflow Name",
  "description": "Brief description of what this workflow accomplishes",
  "nodes": [
    {
      "id": "node1",
      "name": "Tool Name",
      "description": "Tool description", 
      "role": "Specific role in this workflow",
      "category": "Tool category"
    }
  ],
  "edges": [
    {
      "from": "node1",
      "to": "node2", 
      "description": "How data flows from node1 to node2"
    }
  ],
  "explanation": "Detailed explanation of why these tools work together and how the workflow creates value"
}

QUALITY CRITERIA:
- Tools must actually complement each other
- Workflow should be practical and actionable
- Each tool should have a clear, specific role
- Data flow between tools should make logical sense
- Avoid generic or random tool combinations`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Create a workflow for: "${query}"` }
      ],
      temperature: 0.7,
      max_tokens: 2000
    });

    if (completion.usage) {
      trackTokenUsage("system", "workflow-generator", "gpt-4o", completion.usage).catch(() => {});
    }

    const response = completion.choices[0].message?.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    // Parse the JSON response
    let workflow: GeneratedWorkflow;
    try {
      // Clean the response to extract JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      workflow = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.warn('Failed to parse OpenAI response, using fallback');
      workflow = generateFallbackWorkflow(query, aiTools);
    }

    // Validate and enhance workflow
    if (!workflow.nodes || workflow.nodes.length === 0) {
      workflow = generateFallbackWorkflow(query, aiTools);
    }

    // Add IDs if missing
    workflow.nodes.forEach((node, index) => {
      if (!node.id) {
        node.id = `node${index + 1}`;
      }
    });

    console.log(`Generated workflow "${workflow.name}" with ${workflow.nodes.length} tools`);
    return workflow;

  } catch (error) {
    console.error('OpenAI workflow generation failed:', error);
    return generateFallbackWorkflow(query, aiTools);
  }
}

function generateFallbackWorkflow(query: string, aiTools: AiTool[]): GeneratedWorkflow {
  console.log('Using fallback workflow generation');
  
  // Simple keyword-based matching for fallback
  const keywords = query.toLowerCase().split(' ');
  
  // Score tools based on keyword matching
  const scoredTools = aiTools.map(tool => {
    let score = 0;
    const toolText = `${tool.name} ${tool.description} ${tool.category}`.toLowerCase();
    
    keywords.forEach(keyword => {
      if (toolText.includes(keyword)) {
        score += 1;
      }
    });
    
    // Bonus for exact category matches
    if (keywords.some(keyword => tool.category.toLowerCase().includes(keyword))) {
      score += 2;
    }
    
    return { ...tool, score };
  });

  // Select top 3-4 tools
  const selectedTools = scoredTools
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .filter(tool => tool.score > 0);

  if (selectedTools.length === 0) {
    // If no matches, select diverse popular tools
    selectedTools.push(
      ...aiTools.filter(tool => 
        ['ChatGPT', 'Midjourney', 'GitHub Copilot', 'Notion AI'].includes(tool.name)
      ).slice(0, 3)
    );
  }

  // Create workflow nodes
  const nodes: WorkflowNode[] = selectedTools.map((tool, index) => ({
    id: `node${index + 1}`,
    name: tool.name,
    description: tool.description,
    role: getRoleForTool(tool, query),
    category: tool.category,
    website: tool.website,
    pricing: tool.pricing
  }));

  // Create simple sequential edges
  const edges: WorkflowEdge[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    edges.push({
      from: nodes[i].id,
      to: nodes[i + 1].id,
      description: `Output from ${nodes[i].name} feeds into ${nodes[i + 1].name}`
    });
  }

  return {
    name: `AI Workflow for ${capitalizeFirstLetter(query)}`,
    description: `A curated sequence of AI tools to help with ${query.toLowerCase()}`,
    nodes,
    edges,
    explanation: `This workflow combines ${nodes.length} complementary AI tools to address your request. Each tool builds on the previous one's output to create a comprehensive solution.`
  };
}

function getRoleForTool(tool: AiTool, query: string): string {
  const name = tool.name.toLowerCase();
  const category = tool.category.toLowerCase();
  const queryLower = query.toLowerCase();
  
  if (name.includes('gpt') || name.includes('chat')) return 'Content Generation';
  if (name.includes('midjourney') || name.includes('dall')) return 'Visual Creation';
  if (name.includes('github') || name.includes('copilot')) return 'Code Generation';
  if (name.includes('notion') || name.includes('obsidian')) return 'Organization & Planning';
  if (category.includes('video')) return 'Video Processing';
  if (category.includes('audio')) return 'Audio Processing';
  if (category.includes('design')) return 'Design & Visuals';
  if (category.includes('writing')) return 'Content Writing';
  if (category.includes('code')) return 'Development';
  if (category.includes('data')) return 'Data Analysis';
  
  return 'Processing & Enhancement';
}

function capitalizeFirstLetter(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}