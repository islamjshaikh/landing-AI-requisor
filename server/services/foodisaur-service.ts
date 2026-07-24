import { OpenAI } from 'openai';
import { getAiClient, userHasOwnKey } from "./ai-provider";
import { trackTokenUsage } from './token-tracker';
let jsPDF: any;
try {
  jsPDF = require('jspdf').jsPDF;
} catch (e) {
  console.error('Failed to load jsPDF:', e);
}

interface Ingredient {
  item: string;
  quantity: string;
  unit?: string;
}

interface RecipeStep {
  stepNumber: number;
  instruction: string;
  duration?: string;
  tips?: string;
}

interface Recipe {
  title: string;
  description: string;
  prepTime: string;
  cookTime: string;
  servings: number;
  difficulty: 'easy' | 'medium' | 'hard';
  cuisine?: string;
  dietary?: string[];
  ingredients: Ingredient[];
  steps: RecipeStep[];
  nutritionInfo?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    fiber?: number;
  };
  tags?: string[];
  imageUrl?: string;
}

interface MediaContent {
  type: 'slide' | 'video' | 'audio';
  url?: string;
  content?: any;
  duration?: number;
}

export async function generateRecipeFromIdea(idea: string): Promise<Recipe> {
  if (!process.env.OPENAI_API_KEY && !(await userHasOwnKey())) {
    throw new Error('No AI provider configured. Add your own Claude key in Settings, or ask an admin to configure the platform key.');
  }

  const openai = (getAiClient() as any);

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a professional chef and recipe developer. Create detailed, structured recipes from user ideas.
          
          Return the recipe in this exact JSON format:
          {
            "title": "Recipe Name",
            "description": "Brief appealing description",
            "prepTime": "X mins",
            "cookTime": "Y mins",
            "servings": 4,
            "difficulty": "easy|medium|hard",
            "cuisine": "Italian/Asian/etc",
            "dietary": ["vegetarian", "gluten-free"],
            "ingredients": [
              {"item": "ingredient name", "quantity": "1", "unit": "cup"}
            ],
            "steps": [
              {"stepNumber": 1, "instruction": "Step description", "duration": "2 mins", "tips": "Optional tip"}
            ],
            "nutritionInfo": {
              "calories": 350,
              "protein": 20,
              "carbs": 45,
              "fat": 15,
              "fiber": 8
            },
            "tags": ["quick", "healthy", "dinner"]
          }`
        },
        {
          role: "user",
          content: `Create a recipe for: ${idea}`
        }
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: "json_object" }
    });

    if (completion.usage) {
      trackTokenUsage("system", "recipe-generation", "gpt-4o-mini", completion.usage).catch(() => {});
    }

    const recipeData = JSON.parse(completion.choices[0].message.content || '{}');
    
    // Validate and ensure proper structure
    return {
      title: recipeData.title || 'Untitled Recipe',
      description: recipeData.description || '',
      prepTime: recipeData.prepTime || '15 mins',
      cookTime: recipeData.cookTime || '30 mins',
      servings: recipeData.servings || 4,
      difficulty: recipeData.difficulty || 'medium',
      cuisine: recipeData.cuisine,
      dietary: recipeData.dietary || [],
      ingredients: recipeData.ingredients || [],
      steps: recipeData.steps || [],
      nutritionInfo: recipeData.nutritionInfo,
      tags: recipeData.tags || []
    };
  } catch (error) {
    console.error('Error generating recipe:', error);
    throw new Error('Failed to generate recipe from AI');
  }
}

export async function generateMediaContent(
  recipe: Recipe, 
  type: 'slides' | 'voice' | 'video',
  style: string,
  voice: string,
  customization?: {
    bgColor?: string;
    textColor?: string;
    fontFamily?: string;
  }
): Promise<MediaContent[]> {
  if (type === 'slides') {
    return generateSlides(recipe, style, customization);
  } else if (type === 'voice') {
    return generateVoiceNarration(recipe, voice);
  } else if (type === 'video') {
    return generateVideo(recipe, style);
  }
  
  throw new Error(`Unsupported media type: ${type}`);
}

async function generateSlides(
  recipe: Recipe, 
  style: string,
  customization?: {
    bgColor?: string;
    textColor?: string;
    fontFamily?: string;
  }
): Promise<MediaContent[]> {
  const slides: MediaContent[] = [];
  
  // Generate HTML-based slides that can be rendered on frontend
  const slideTemplates: Record<string, {
    bgColor: string;
    textColor: string;
    fontFamily: string;
    fontSize: string;
  }> = {
    'tiktok': {
      bgColor: '#ff0050',
      textColor: '#ffffff',
      fontFamily: 'Arial Black, sans-serif',
      fontSize: '48px'
    },
    'chef': {
      bgColor: '#2c2c2c',
      textColor: '#ffffff',
      fontFamily: 'Georgia, serif',
      fontSize: '36px'
    },
    'minimal': {
      bgColor: '#ffffff',
      textColor: '#333333',
      fontFamily: 'Helvetica, sans-serif',
      fontSize: '32px'
    },
    'blog': {
      bgColor: '#f8f8f8',
      textColor: '#444444',
      fontFamily: 'Merriweather, serif',
      fontSize: '28px'
    }
  };
  
  let template = slideTemplates[style] || slideTemplates.minimal;
  
  // Apply customization if provided
  if (customization) {
    template = {
      ...template,
      bgColor: customization.bgColor || template.bgColor,
      textColor: customization.textColor || template.textColor,
      fontFamily: customization.fontFamily || template.fontFamily
    };
  }
  
  // Title slide
  slides.push({
    type: 'slide',
    content: {
      html: `
        <div style="width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; background-color: ${template.bgColor}; color: ${template.textColor}; font-family: ${template.fontFamily}; text-align: center; padding: 40px;">
          <h1 style="font-size: ${template.fontSize}; margin-bottom: 20px;">${recipe.title}</h1>
          <p style="font-size: 24px; opacity: 0.8;">${recipe.description}</p>
          <div style="margin-top: 40px; font-size: 18px;">
            <span>⏱️ ${recipe.prepTime} prep</span> | 
            <span>🔥 ${recipe.cookTime} cook</span> | 
            <span>🍽️ ${recipe.servings} servings</span>
          </div>
        </div>
      `,
      slideNumber: 1
    }
  });
  
  // Ingredients slide
  const ingredientsList = recipe.ingredients.map(ing => 
    `<li style="margin-bottom: 10px;">${ing.quantity} ${ing.unit || ''} ${ing.item}</li>`
  ).join('');
  
  slides.push({
    type: 'slide',
    content: {
      html: `
        <div style="width: 100%; height: 100%; display: flex; flex-direction: column; background-color: ${template.bgColor}; color: ${template.textColor}; font-family: ${template.fontFamily}; padding: 60px;">
          <h2 style="font-size: ${parseInt(template.fontSize) - 8}px; margin-bottom: 40px;">Ingredients</h2>
          <ul style="font-size: 20px; list-style: none; padding: 0;">
            ${ingredientsList}
          </ul>
        </div>
      `,
      slideNumber: 2
    }
  });
  
  // Steps slides (group every 2 steps per slide)
  for (let i = 0; i < recipe.steps.length; i += 2) {
    const steps = recipe.steps.slice(i, i + 2);
    const stepsHtml = steps.map(step => `
      <div style="margin-bottom: 30px;">
        <h3 style="font-size: 24px; margin-bottom: 10px;">Step ${step.stepNumber}</h3>
        <p style="font-size: 18px; line-height: 1.6;">${step.instruction}</p>
        ${step.tips ? `<p style="font-size: 16px; font-style: italic; opacity: 0.8; margin-top: 10px;">💡 Tip: ${step.tips}</p>` : ''}
      </div>
    `).join('');
    
    slides.push({
      type: 'slide',
      content: {
        html: `
          <div style="width: 100%; height: 100%; display: flex; flex-direction: column; background-color: ${template.bgColor}; color: ${template.textColor}; font-family: ${template.fontFamily}; padding: 60px;">
            <h2 style="font-size: ${parseInt(template.fontSize) - 8}px; margin-bottom: 40px;">Instructions</h2>
            ${stepsHtml}
          </div>
        `,
        slideNumber: 3 + Math.floor(i / 2)
      }
    });
  }
  
  // Nutrition slide (if available)
  if (recipe.nutritionInfo) {
    slides.push({
      type: 'slide',
      content: {
        html: `
          <div style="width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; background-color: ${template.bgColor}; color: ${template.textColor}; font-family: ${template.fontFamily}; text-align: center; padding: 60px;">
            <h2 style="font-size: ${parseInt(template.fontSize) - 8}px; margin-bottom: 40px;">Nutrition Per Serving</h2>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 30px; font-size: 24px;">
              <div>🔥 ${recipe.nutritionInfo.calories} calories</div>
              <div>💪 ${recipe.nutritionInfo.protein}g protein</div>
              <div>🌾 ${recipe.nutritionInfo.carbs}g carbs</div>
              <div>🥑 ${recipe.nutritionInfo.fat}g fat</div>
            </div>
          </div>
        `,
        slideNumber: slides.length + 1
      }
    });
  }
  
  return slides;
}

async function generateVoiceNarration(recipe: Recipe, voice: string): Promise<MediaContent[]> {
  // Generate voice script
  const script = `
    Welcome to today's recipe: ${recipe.title}. ${recipe.description}
    
    This recipe takes ${recipe.prepTime} to prepare and ${recipe.cookTime} to cook, serving ${recipe.servings} people.
    
    Let's start with the ingredients:
    ${recipe.ingredients.map(ing => `${ing.quantity} ${ing.unit || ''} ${ing.item}`).join(', ')}
    
    Now for the instructions:
    ${recipe.steps.map(step => `Step ${step.stepNumber}: ${step.instruction}. ${step.tips ? `Here's a tip: ${step.tips}` : ''}`).join(' ')}
    
    Enjoy your delicious ${recipe.title}!
  `;
  
  return [{
    type: 'audio',
    content: {
      script,
      voice,
      duration: Math.ceil(script.length / 150) // Rough estimate: 150 chars per second
    }
  }];
}

async function generateVideo(recipe: Recipe, style: string): Promise<MediaContent[]> {
  // Generate video storyboard
  return [{
    type: 'video',
    content: {
      storyboard: [
        { scene: 'title', duration: 3, text: recipe.title },
        { scene: 'ingredients', duration: 5, items: recipe.ingredients },
        ...recipe.steps.map(step => ({
          scene: 'step',
          duration: 5,
          stepNumber: step.stepNumber,
          instruction: step.instruction
        })),
        { scene: 'final', duration: 3, text: 'Enjoy!' }
      ],
      style,
      totalDuration: 3 + 5 + (recipe.steps.length * 5) + 3
    }
  }];
}

export async function exportRecipe(
  recipe: Recipe,
  format: 'pdf' | 'png' | 'mp4' | 'html',
  media?: MediaContent[]
): Promise<Buffer | string> {
  console.log('Exporting recipe in format:', format);
  
  switch (format) {
    case 'pdf':
      return generatePDF(recipe);
    case 'html':
      return generateHTML(recipe);
    case 'png':
      // Create a simple PNG placeholder for now
      const pngHtml = generateHTML(recipe);
      return Buffer.from(pngHtml, 'utf-8');
    case 'mp4':
      // Create a simple placeholder
      return Buffer.from('Video export coming soon', 'utf-8');
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

function generatePDF(recipe: Recipe): Buffer {
  try {
    if (!jsPDF) {
      console.log('jsPDF not available, falling back to HTML');
      const html = generateHTML(recipe);
      return Buffer.from(html, 'utf-8');
    }
    
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(24);
    doc.text(recipe.title, 20, 20);
    
    // Description
    doc.setFontSize(12);
    const lines = doc.splitTextToSize(recipe.description, 170);
    doc.text(lines, 20, 35);
    
    // Meta info
    doc.setFontSize(10);
    doc.text(`Prep: ${recipe.prepTime} | Cook: ${recipe.cookTime} | Servings: ${recipe.servings}`, 20, 50);
    
    // Ingredients
    doc.setFontSize(14);
    doc.text('Ingredients:', 20, 65);
    doc.setFontSize(10);
    let yPos = 75;
    recipe.ingredients.forEach((ing: Ingredient) => {
      doc.text(`• ${ing.quantity} ${ing.unit || ''} ${ing.item}`, 25, yPos);
      yPos += 7;
    });
    
    // Steps
    doc.setFontSize(14);
    doc.text('Instructions:', 20, yPos + 10);
    doc.setFontSize(10);
    yPos += 20;
    recipe.steps.forEach((step: RecipeStep) => {
      const stepLines = doc.splitTextToSize(`${step.stepNumber}. ${step.instruction}`, 160);
      doc.text(stepLines, 25, yPos);
      yPos += stepLines.length * 5 + 5;
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
    });
    
    return Buffer.from(doc.output('arraybuffer'));
  } catch (error) {
    console.error('Error generating PDF:', error);
    // Fallback to HTML
    const html = generateHTML(recipe);
    return Buffer.from(html, 'utf-8');
  }
}

function generateHTML(recipe: Recipe): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${recipe.title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      line-height: 1.6;
    }
    h1 { color: #333; margin-bottom: 0.5rem; }
    .meta { color: #666; margin-bottom: 2rem; }
    .ingredients, .instructions { margin: 2rem 0; }
    .ingredients ul { padding-left: 1.5rem; }
    .instructions ol { padding-left: 1.5rem; }
    .nutrition { background: #f5f5f5; padding: 1rem; border-radius: 8px; }
  </style>
</head>
<body>
  <h1>${recipe.title}</h1>
  <p class="description">${recipe.description}</p>
  <div class="meta">
    Prep: ${recipe.prepTime} | Cook: ${recipe.cookTime} | Servings: ${recipe.servings} | Difficulty: ${recipe.difficulty}
  </div>
  
  <div class="ingredients">
    <h2>Ingredients</h2>
    <ul>
      ${recipe.ingredients.map(ing => 
        `<li>${ing.quantity} ${ing.unit || ''} ${ing.item}</li>`
      ).join('')}
    </ul>
  </div>
  
  <div class="instructions">
    <h2>Instructions</h2>
    <ol>
      ${recipe.steps.map(step => 
        `<li>${step.instruction}${step.tips ? `<br><em>Tip: ${step.tips}</em>` : ''}</li>`
      ).join('')}
    </ol>
  </div>
  
  ${recipe.nutritionInfo ? `
  <div class="nutrition">
    <h3>Nutrition Information</h3>
    <p>Per serving: ${recipe.nutritionInfo.calories} calories, 
       ${recipe.nutritionInfo.protein}g protein, 
       ${recipe.nutritionInfo.carbs}g carbs, 
       ${recipe.nutritionInfo.fat}g fat</p>
  </div>
  ` : ''}
</body>
</html>
  `;
}

export async function generateSeoContent(recipe: Recipe): Promise<any> {
  if (!process.env.OPENAI_API_KEY && !(await userHasOwnKey())) {
    throw new Error('No AI provider configured. Add your own Claude key in Settings, or ask an admin to configure the platform key.');
  }

  const openai = (getAiClient() as any);

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an SEO expert specializing in food and recipe content. Generate SEO-optimized content including title, meta description, keywords, and schema markup.
          
          Return the SEO data in this exact JSON format:
          {
            "title": "SEO-optimized title (50-60 characters)",
            "metaDescription": "Compelling meta description (150-160 characters)",
            "keywords": ["keyword1", "keyword2", "keyword3", "..."],
            "schema": {
              "@context": "https://schema.org/",
              "@type": "Recipe",
              "name": "Recipe Name",
              "description": "Recipe description",
              "prepTime": "PT15M",
              "cookTime": "PT30M",
              "totalTime": "PT45M",
              "recipeYield": "4 servings",
              "recipeIngredient": ["ingredient 1", "ingredient 2"],
              "recipeInstructions": [
                {"@type": "HowToStep", "text": "Step 1"},
                {"@type": "HowToStep", "text": "Step 2"}
              ],
              "nutrition": {
                "@type": "NutritionInformation",
                "calories": "XXX calories"
              }
            }
          }`
        },
        {
          role: "user",
          content: `Generate SEO content for this recipe: ${JSON.stringify(recipe)}`
        }
      ],
      temperature: 0.7,
      max_tokens: 1500,
      response_format: { type: "json_object" }
    });

    if (completion.usage) {
      trackTokenUsage("system", "recipe-seo", "gpt-4o-mini", completion.usage).catch(() => {});
    }

    const result = completion.choices[0]?.message?.content;
    if (!result) {
      throw new Error('Failed to generate SEO content');
    }

    return JSON.parse(result);
  } catch (error) {
    console.error('Error generating SEO content:', error);
    throw new Error('Failed to generate SEO content from AI');
  }
}

export async function generatePhotoIdeas(recipe: Recipe, style: string, uploadedImage?: string): Promise<any[]> {
  if (!process.env.OPENAI_API_KEY && !(await userHasOwnKey())) {
    throw new Error('No AI provider configured. Add your own Claude key in Settings, or ask an admin to configure the platform key.');
  }

  const openai = (getAiClient() as any);

  try {
    const messages: any[] = [
      {
        role: "system",
        content: `You are a professional food photographer and stylist. Generate creative photography concepts for recipes based on the style requested.
        
        Return an array of 4-5 photo ideas in this JSON format:
        [
          {
            "title": "Concept Name",
            "description": "Detailed description of the photo concept",
            "props": "List of props needed (bowls, utensils, garnishes, etc.)",
            "lighting": "Lighting setup description",
            "angle": "Camera angle (overhead, 45-degree, eye-level, etc.)",
            "background": "Background/surface description",
            "mood": "Overall mood and feeling",
            "colorPalette": "Dominant colors in the shot"
          }
        ]`
      },
      {
        role: "user",
        content: `Generate ${style} style photography ideas for this recipe: ${recipe.title} - ${recipe.description}. 
        Consider ingredients: ${recipe.ingredients.map(i => i.item).join(', ')}.
        ${uploadedImage ? 'The user has uploaded a reference image showing their preferred style.' : ''}`
      }
    ];

    if (uploadedImage) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: "Use this reference image as inspiration for the photography style:" },
          { type: "image_url", image_url: { url: uploadedImage } }
        ]
      });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.8,
      max_tokens: 2000,
      response_format: { type: "json_object" }
    });

    if (completion.usage) {
      trackTokenUsage("system", "recipe-photo-ideas", "gpt-4o-mini", completion.usage).catch(() => {});
    }

    const result = completion.choices[0]?.message?.content;
    if (!result) {
      throw new Error('Failed to generate photo ideas');
    }

    const parsed = JSON.parse(result);
    return Array.isArray(parsed) ? parsed : parsed.ideas || [];
  } catch (error) {
    console.error('Error generating photo ideas:', error);
    throw new Error('Failed to generate photography ideas from AI');
  }
}