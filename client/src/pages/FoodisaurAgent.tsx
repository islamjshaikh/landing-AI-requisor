import React, { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import html2canvas from "html2canvas";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ChefHat,
  Clock,
  Users,
  ListOrdered,
  Camera,
  Mic,
  Video,
  Download,
  FileText,
  Image,
  Sparkles,
  Loader2,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  Play,
  Pause,
  Volume2,
  AlertCircle,
  Share2,
  BookOpen,
  Palette,
  Film,
  Save,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

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
  difficulty: "easy" | "medium" | "hard";
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
  type: "slide" | "video" | "audio";
  url?: string;
  content?: any;
  duration?: number;
}

const STYLE_OPTIONS = [
  {
    value: "tiktok",
    label: "TikTok Style",
    description: "Fast-paced, trendy, vertical",
  },
  {
    value: "chefsTable",
    label: "Chef's Table",
    description: "Elegant, cinematic, professional",
  },
  { value: "minimal", label: "Minimal", description: "Clean, simple, modern" },
  {
    value: "blog",
    label: "Blog Style",
    description: "Detailed, informative, classic",
  },
];

const VOICE_OPTIONS = [
  {
    value: "friendly",
    label: "Friendly Chef",
    description: "Warm and encouraging",
  },
  {
    value: "professional",
    label: "Professional",
    description: "Clear and authoritative",
  },
  {
    value: "casual",
    label: "Casual Friend",
    description: "Relaxed and conversational",
  },
  {
    value: "energetic",
    label: "Energetic",
    description: "Upbeat and enthusiastic",
  },
];

export default function FoodisaurAgent() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [currentTab, setCurrentTab] = useState<string>("generate");
  const [recipeIdea, setRecipeIdea] = useState("");
  const [currentRecipe, setCurrentRecipe] = useState<Recipe | null>(null);
  const [selectedStyle, setSelectedStyle] = useState("tiktok");
  const [selectedVoice, setSelectedVoice] = useState("friendly");
  const [mediaContent, setMediaContent] = useState<MediaContent[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreatingMedia, setIsCreatingMedia] = useState(false);

  // Slide customization
  const [customBgColor, setCustomBgColor] = useState("#ff0050");
  const [customTextColor, setCustomTextColor] = useState("#ffffff");
  const [customFont, setCustomFont] = useState("Arial Black, sans-serif");

  // SEO optimization
  const [seoData, setSeoData] = useState<any>(null);
  const [isGeneratingSeo, setIsGeneratingSeo] = useState(false);

  // Food photography
  const [photoStyle, setPhotoStyle] = useState("rustic");
  const [photoIdeas, setPhotoIdeas] = useState<any[]>([]);
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [isGeneratingPhoto, setIsGeneratingPhoto] = useState(false);

  // Generate recipe from idea
  const generateRecipe = async () => {
    if (!recipeIdea.trim()) {
      toast({
        title: "Recipe idea required",
        description:
          "Please enter a recipe idea or ingredients to get started.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch("/api/foodisaur/generate-recipe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ idea: recipeIdea }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate recipe");
      }

      const recipe = await response.json();
      setCurrentRecipe(recipe);
      // Stay on the generate tab so user can see the recipe
      // setCurrentTab('customize');

      toast({
        title: "Recipe generated!",
        description: `Created "${recipe.title}" with ${recipe.steps.length} steps.`,
      });
    } catch (error) {
      console.error("Error generating recipe:", error);
      toast({
        title: "Generation failed",
        description: "Failed to generate recipe. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Generate media content
  const generateMedia = async (type: "slides" | "voice" | "video") => {
    if (!currentRecipe) return;

    setIsCreatingMedia(true);
    try {
      const response = await fetch("/api/foodisaur/generate-media", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipe: currentRecipe,
          type,
          style: selectedStyle,
          voice: selectedVoice,
          customization: {
            bgColor: customBgColor,
            textColor: customTextColor,
            fontFamily: customFont,
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate media");
      }

      const mediaArray = await response.json();
      // If the response is an array, spread it, otherwise wrap in array
      const newMedia = Array.isArray(mediaArray) ? mediaArray : [mediaArray];
      setMediaContent([...mediaContent, ...newMedia]);

      toast({
        title: "Media created!",
        description: `${type} content has been generated successfully.`,
      });
    } catch (error) {
      console.error("Error generating media:", error);
      toast({
        title: "Media generation failed",
        description: `Failed to create ${type}. Please try again.`,
        variant: "destructive",
      });
    } finally {
      setIsCreatingMedia(false);
    }
  };

  // Export recipe
  const exportRecipe = async (format: "pdf" | "png" | "mp4" | "html") => {
    if (!currentRecipe) return;

    try {
      const response = await fetch("/api/foodisaur/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipe: currentRecipe,
          format,
          media: mediaContent,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to export recipe");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${currentRecipe.title.replace(/\s+/g, "-").toLowerCase()}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export successful!",
        description: `Recipe exported as ${format.toUpperCase()}.`,
      });
    } catch (error) {
      console.error("Error exporting recipe:", error);
      toast({
        title: "Export failed",
        description: "Failed to export recipe. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Download slide as image
  const downloadSlide = async (html: string, slideNumber: number) => {
    try {
      // Create a temporary container for the slide
      const container = document.createElement("div");
      container.style.position = "absolute";
      container.style.left = "-9999px";
      container.style.width = "1920px";
      container.style.height = "1080px";
      container.innerHTML = html;
      document.body.appendChild(container);

      // Use html2canvas to convert to image
      const canvas = await html2canvas(container, {
        width: 1920,
        height: 1080,
        scale: 1,
        backgroundColor: null,
        logging: false,
      });

      // Remove temporary container
      document.body.removeChild(container);

      // Convert canvas to blob and download
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${currentRecipe?.title || "recipe"}-slide-${slideNumber}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          toast({
            title: "Slide downloaded!",
            description: `Slide ${slideNumber} saved as PNG image.`,
          });
        }
      }, "image/png");
    } catch (error) {
      console.error("Error downloading slide:", error);
      toast({
        title: "Download failed",
        description: "Failed to download slide. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Download all slides as PowerPoint-like presentation
  const downloadPresentation = async () => {
    try {
      if (
        !currentRecipe ||
        mediaContent.filter((m) => m.type === "slide").length === 0
      ) {
        toast({
          title: "No slides to export",
          description: "Generate slides first before exporting presentation.",
          variant: "destructive",
        });
        return;
      }

      const response = await fetch("/api/foodisaur/export-presentation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipe: currentRecipe,
          slides: mediaContent.filter((m) => m.type === "slide"),
          customization: {
            bgColor: customBgColor,
            textColor: customTextColor,
            fontFamily: customFont,
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to export presentation");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${currentRecipe.title.replace(/\s+/g, "-").toLowerCase()}-presentation.html`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Presentation downloaded!",
        description: "Your recipe presentation has been saved.",
      });
    } catch (error) {
      console.error("Error exporting presentation:", error);
      toast({
        title: "Export failed",
        description: "Failed to export presentation. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Generate SEO optimization
  const generateSeo = async () => {
    if (!currentRecipe) return;

    setIsGeneratingSeo(true);
    try {
      const response = await fetch("/api/foodisaur/generate-seo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ recipe: currentRecipe }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate SEO");
      }

      const seo = await response.json();
      setSeoData(seo);

      toast({
        title: "SEO optimization generated!",
        description: "Your recipe is now optimized for search engines.",
      });
    } catch (error) {
      console.error("Error generating SEO:", error);
      toast({
        title: "SEO generation failed",
        description: "Failed to optimize recipe for SEO. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingSeo(false);
    }
  };

  // Generate photo ideas
  const generatePhotoIdeas = async () => {
    if (!currentRecipe) return;

    setIsGeneratingPhoto(true);
    try {
      const response = await fetch("/api/foodisaur/generate-photo-ideas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipe: currentRecipe,
          style: photoStyle,
          uploadedImage: uploadedImage
            ? await fileToBase64(uploadedImage)
            : null,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate photo ideas");
      }

      const ideas = await response.json();
      setPhotoIdeas(ideas);

      toast({
        title: "Photo ideas generated!",
        description: `${ideas.length} creative photo concepts ready.`,
      });
    } catch (error) {
      console.error("Error generating photo ideas:", error);
      toast({
        title: "Photo generation failed",
        description: "Failed to generate photo ideas. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPhoto(false);
    }
  };

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  // Download all slides as individual images
  const downloadAllSlides = async () => {
    try {
      const slides = mediaContent.filter(
        (m) => m.type === "slide" && m.content?.html,
      );

      if (slides.length === 0) {
        toast({
          title: "No slides to download",
          description: "Generate slides first before downloading.",
          variant: "destructive",
        });
        return;
      }

      // Create a temporary loading toast
      const loadingToast = toast({
        title: "Downloading slides...",
        description: `Processing ${slides.length} slides...`,
      });

      // Download each slide with a small delay to avoid overwhelming the browser
      for (let i = 0; i < slides.length; i++) {
        const slide = slides[i];
        if (slide.content?.html && slide.content?.slideNumber) {
          await downloadSlide(slide.content.html, slide.content.slideNumber);
          // Small delay between downloads
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      toast({
        title: "All slides downloaded!",
        description: `Successfully downloaded ${slides.length} slides.`,
      });
    } catch (error) {
      console.error("Error downloading all slides:", error);
      toast({
        title: "Download failed",
        description: "Failed to download all slides. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Save to cookbook
  const saveToCollection = async () => {
    if (!currentRecipe) return;

    try {
      const response = await fetch("/api/foodisaur/save-recipe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ recipe: currentRecipe }),
      });

      if (!response.ok) {
        throw new Error("Failed to save recipe");
      }

      toast({
        title: "Recipe saved!",
        description: "Added to your personal cookbook collection.",
      });
    } catch (error) {
      console.error("Error saving recipe:", error);
      toast({
        title: "Save failed",
        description: "Failed to save recipe. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardHeader>
          <CardTitle>Authentication Required</CardTitle>
          <CardDescription>
            Please log in to use the Foodisaur Agent.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => (window.location.href = "/api/login")}
            className="w-full"
          >
            Log In
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-yellow-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-br from-red-500 to-orange-600 rounded-xl">
              <ChefHat className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Foodisaur Agent
              </h1>
              <p className="text-gray-600">
                Transform recipe ideas into visual content with AI
              </p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <Tabs
          value={currentTab}
          onValueChange={setCurrentTab}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger
              value="generate"
              className="flex items-center justify-center gap-2"
            >
              <Sparkles className="h-5 w-5" />
              <span className="hidden md:inline">Generate Recipe</span>
            </TabsTrigger>

            <TabsTrigger
              value="customize"
              disabled={!currentRecipe}
              className="flex items-center justify-center gap-2"
            >
              <Palette className="h-5 w-5" />
              <span className="hidden md:inline">Customize Media</span>
            </TabsTrigger>

            <TabsTrigger
              value="seo"
              disabled={!currentRecipe}
              className="flex items-center justify-center gap-2"
            >
              <FileText className="h-5 w-5" />
              <span className="hidden md:inline">SEO Optimize</span>
            </TabsTrigger>

            <TabsTrigger
              value="photography"
              disabled={!currentRecipe}
              className="flex items-center justify-center gap-2"
            >
              <Camera className="h-5 w-5" />
              <span className="hidden md:inline">Food Photography</span>
            </TabsTrigger>

            <TabsTrigger
              value="export"
              disabled={!currentRecipe}
              className="flex items-center justify-center gap-2"
            >
              <Download className="h-5 w-5" />
              <span className="hidden md:inline">Export & Share</span>
            </TabsTrigger>
          </TabsList>

          {/* Generate Recipe Tab */}
          <TabsContent value="generate" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Recipe Generator</CardTitle>
                  <CardDescription>
                    Enter a recipe idea, ingredients, or cuisine type to
                    generate a complete recipe
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="recipe-idea">
                      Recipe Idea or Ingredients
                    </Label>
                    <Textarea
                      id="recipe-idea"
                      placeholder="e.g., 'Spicy vegan ramen with mushrooms and tofu' or 'gluten-free pasta using chickpeas'"
                      value={recipeIdea}
                      onChange={(e) => setRecipeIdea(e.target.value)}
                      className="min-h-[120px]"
                    />
                  </div>

                  {/* Quick Prompts */}
                  <div className="space-y-2">
                    <Label>Quick Ideas</Label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        "High-protein smoothie bowl",
                        "15-minute pasta dinner",
                        "Vegan chocolate dessert",
                        "Keto-friendly breakfast",
                      ].map((prompt) => (
                        <Button
                          key={prompt}
                          variant="outline"
                          size="sm"
                          onClick={() => setRecipeIdea(prompt)}
                        >
                          {prompt}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <Button
                    onClick={generateRecipe}
                    disabled={isGenerating || !recipeIdea.trim()}
                    className="w-full"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating Recipe...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Generate Recipe
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Preview */}
              {currentRecipe && (
                <Card>
                  <CardHeader>
                    <CardTitle>{currentRecipe.title}</CardTitle>
                    <CardDescription>
                      {currentRecipe.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          <span>{currentRecipe.prepTime} prep</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          <span>{currentRecipe.cookTime} cook</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          <span>{currentRecipe.servings} servings</span>
                        </div>
                      </div>

                      <Separator />

                      <div>
                        <h4 className="font-semibold mb-2">Ingredients</h4>
                        <ul className="space-y-1 text-sm">
                          {currentRecipe.ingredients.map((ing, idx) => (
                            <li key={idx}>
                              • {ing.quantity} {ing.unit} {ing.item}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <Separator />

                      <div>
                        <h4 className="font-semibold mb-2">Steps</h4>
                        <ol className="space-y-2 text-sm">
                          {currentRecipe.steps.map((step, idx) => (
                            <li key={idx}>
                              <span className="font-medium">{idx + 1}.</span>{" "}
                              {step.instruction}
                            </li>
                          ))}
                        </ol>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Customize Media Tab */}
          <TabsContent value="customize" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                {/* Style Selection */}
                <Card>
                  <CardHeader>
                    <CardTitle>Visual Style</CardTitle>
                    <CardDescription>
                      Choose how your recipe content will look
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      {STYLE_OPTIONS.map((style) => (
                        <div
                          key={style.value}
                          className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
                            selectedStyle === style.value
                              ? "border-orange-500 bg-orange-50"
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                          onClick={() => setSelectedStyle(style.value)}
                        >
                          <h4 className="font-semibold">{style.label}</h4>
                          <p className="text-sm text-gray-600">
                            {style.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Voice Selection */}
                <Card>
                  <CardHeader>
                    <CardTitle>Voice Style</CardTitle>
                    <CardDescription>
                      Select the tone for AI narration
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      {VOICE_OPTIONS.map((voice) => (
                        <div
                          key={voice.value}
                          className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
                            selectedVoice === voice.value
                              ? "border-orange-500 bg-orange-50"
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                          onClick={() => setSelectedVoice(voice.value)}
                        >
                          <h4 className="font-semibold">{voice.label}</h4>
                          <p className="text-sm text-gray-600">
                            {voice.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Slide Customization */}
                <Card>
                  <CardHeader>
                    <CardTitle>Slide Customization</CardTitle>
                    <CardDescription>
                      Customize colors and fonts for your slides
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="bg-color">Background Color</Label>
                        <div className="flex gap-2 mt-2">
                          <Input
                            id="bg-color"
                            type="color"
                            value={customBgColor}
                            onChange={(e) => setCustomBgColor(e.target.value)}
                            className="w-16 h-10"
                          />
                          <Input
                            type="text"
                            value={customBgColor}
                            onChange={(e) => setCustomBgColor(e.target.value)}
                            className="flex-1"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="text-color">Text Color</Label>
                        <div className="flex gap-2 mt-2">
                          <Input
                            id="text-color"
                            type="color"
                            value={customTextColor}
                            onChange={(e) => setCustomTextColor(e.target.value)}
                            className="w-16 h-10"
                          />
                          <Input
                            type="text"
                            value={customTextColor}
                            onChange={(e) => setCustomTextColor(e.target.value)}
                            className="flex-1"
                          />
                        </div>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="font-family">Font Family</Label>
                      <Select value={customFont} onValueChange={setCustomFont}>
                        <SelectTrigger id="font-family" className="mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Arial Black, sans-serif">
                            Arial Black
                          </SelectItem>
                          <SelectItem value="Georgia, serif">
                            Georgia
                          </SelectItem>
                          <SelectItem value="Helvetica, sans-serif">
                            Helvetica
                          </SelectItem>
                          <SelectItem value="Times New Roman, serif">
                            Times New Roman
                          </SelectItem>
                          <SelectItem value="Courier New, monospace">
                            Courier New
                          </SelectItem>
                          <SelectItem value="Comic Sans MS, cursive">
                            Comic Sans
                          </SelectItem>
                          <SelectItem value="Impact, sans-serif">
                            Impact
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                {/* Media Generation Actions */}
                <Card>
                  <CardHeader>
                    <CardTitle>Generate Media Content</CardTitle>
                    <CardDescription>
                      Create visual and audio content for your recipe
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <Button
                        onClick={() => generateMedia("slides")}
                        disabled={isCreatingMedia}
                        variant="outline"
                        className="flex flex-col items-center gap-2 h-24"
                      >
                        <Image className="h-6 w-6" />
                        <span className="text-sm">Generate Slides</span>
                      </Button>
                      <Button
                        onClick={() => generateMedia("voice")}
                        disabled={isCreatingMedia}
                        variant="outline"
                        className="flex flex-col items-center gap-2 h-24"
                      >
                        <Mic className="h-6 w-6" />
                        <span className="text-sm">Add Voiceover</span>
                      </Button>
                      <Button
                        onClick={() => generateMedia("video")}
                        disabled={isCreatingMedia}
                        variant="outline"
                        className="flex flex-col items-center gap-2 h-24"
                      >
                        <Video className="h-6 w-6" />
                        <span className="text-sm">Create Video</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Media Preview */}
              <div>
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Media Preview</CardTitle>
                        <CardDescription>
                          Generated content will appear here
                        </CardDescription>
                      </div>
                      {mediaContent.some((m) => m.type === "slide") && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={downloadPresentation}
                            className="h-8"
                          >
                            <FileText className="h-4 w-4 mr-1" />
                            Download Presentation
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={downloadAllSlides}
                            className="h-8"
                          >
                            <Download className="h-4 w-4 mr-1" />
                            All Images
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {mediaContent.length > 0 ? (
                      <div className="space-y-4">
                        {mediaContent.map((media, idx) => (
                          <div
                            key={idx}
                            className="border rounded-lg overflow-hidden"
                          >
                            {media.type === "slide" && media.content?.html ? (
                              <div>
                                <div className="bg-gray-100 px-3 py-2 border-b flex items-center justify-between">
                                  <span className="text-sm font-medium">
                                    Slide {media.content.slideNumber}
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() =>
                                      downloadSlide(
                                        media.content.html,
                                        media.content.slideNumber,
                                      )
                                    }
                                    className="h-7 px-2"
                                  >
                                    <Download className="h-3 w-3 mr-1" />
                                    Download
                                  </Button>
                                </div>
                                <div
                                  id={`slide-${media.content.slideNumber}`}
                                  className="aspect-video"
                                  dangerouslySetInnerHTML={{
                                    __html: media.content.html,
                                  }}
                                />
                              </div>
                            ) : media.type === "audio" &&
                              media.content?.script ? (
                              <div className="p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-medium">
                                    Voice Narration
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {media.content.voice} voice
                                  </span>
                                </div>
                                <div className="bg-gray-50 p-3 rounded text-sm text-gray-600 max-h-32 overflow-y-auto">
                                  {media.content.script}
                                </div>
                                <div className="mt-2 text-xs text-gray-500">
                                  Duration: ~{media.content.duration} seconds
                                </div>
                              </div>
                            ) : media.type === "video" &&
                              media.content?.storyboard ? (
                              <div className="p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-medium">
                                    Video Storyboard
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {media.content.style} style
                                  </span>
                                </div>
                                <div className="space-y-1 text-sm">
                                  {media.content.storyboard
                                    .slice(0, 3)
                                    .map((scene: any, i: number) => (
                                      <div key={i} className="text-gray-600">
                                        • {scene.scene}:{" "}
                                        {scene.text ||
                                          scene.instruction ||
                                          "Scene content"}
                                      </div>
                                    ))}
                                  {media.content.storyboard.length > 3 && (
                                    <div className="text-gray-400">
                                      ... and{" "}
                                      {media.content.storyboard.length - 3} more
                                      scenes
                                    </div>
                                  )}
                                </div>
                                <div className="mt-2 text-xs text-gray-500">
                                  Total duration: {media.content.totalDuration}{" "}
                                  seconds
                                </div>
                              </div>
                            ) : (
                              <div className="p-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium capitalize">
                                    {media.type}
                                  </span>
                                  <Button size="sm" variant="ghost">
                                    <Play className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <Film className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                        <p className="text-sm">No media generated yet</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* SEO Optimization Tab */}
          <TabsContent value="seo" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>SEO Optimization</CardTitle>
                  <CardDescription>
                    Generate SEO-optimized content for your recipe to improve
                    search rankings
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={generateSeo}
                    disabled={isGeneratingSeo || !currentRecipe}
                    className="w-full mb-4"
                  >
                    {isGeneratingSeo ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating SEO Content...
                      </>
                    ) : (
                      <>
                        <FileText className="mr-2 h-4 w-4" />
                        Generate SEO Optimization
                      </>
                    )}
                  </Button>

                  {seoData && (
                    <div className="space-y-4">
                      <div>
                        <Label>SEO Title</Label>
                        <div className="mt-1 p-3 bg-gray-50 rounded-md text-sm">
                          {seoData.title}
                        </div>
                      </div>

                      <div>
                        <Label>Meta Description</Label>
                        <div className="mt-1 p-3 bg-gray-50 rounded-md text-sm">
                          {seoData.metaDescription}
                        </div>
                      </div>

                      <div>
                        <Label>Keywords</Label>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {seoData.keywords?.map(
                            (keyword: string, idx: number) => (
                              <Badge key={idx} variant="secondary">
                                {keyword}
                              </Badge>
                            ),
                          )}
                        </div>
                      </div>

                      <div>
                        <Label>Schema Markup</Label>
                        <div className="mt-1 p-3 bg-gray-50 rounded-md">
                          <code className="text-xs">
                            {JSON.stringify(seoData.schema, null, 2)}
                          </code>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>SEO Tips</CardTitle>
                  <CardDescription>
                    Best practices for recipe SEO
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-500 mt-0.5" />
                      <div>
                        <p className="font-medium text-sm">
                          Include cooking method in title
                        </p>
                        <p className="text-xs text-gray-600">
                          e.g., "Easy Baked", "Quick Stir-Fried"
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-500 mt-0.5" />
                      <div>
                        <p className="font-medium text-sm">
                          Add dietary labels
                        </p>
                        <p className="text-xs text-gray-600">
                          Vegan, Gluten-Free, Keto, etc.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-500 mt-0.5" />
                      <div>
                        <p className="font-medium text-sm">
                          Include prep/cook time
                        </p>
                        <p className="text-xs text-gray-600">
                          Users search for "30-minute meals"
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-500 mt-0.5" />
                      <div>
                        <p className="font-medium text-sm">
                          Use structured data
                        </p>
                        <p className="text-xs text-gray-600">
                          Recipe schema markup improves visibility
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Food Photography Tab */}
          <TabsContent value="photography" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>AI Food Photography Ideas</CardTitle>
                  <CardDescription>
                    Generate creative photography concepts for your recipe
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Photography Style</Label>
                    <Select value={photoStyle} onValueChange={setPhotoStyle}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rustic">Rustic & Natural</SelectItem>
                        <SelectItem value="minimal">Minimal & Clean</SelectItem>
                        <SelectItem value="overhead">
                          Overhead Flat Lay
                        </SelectItem>
                        <SelectItem value="moody">Dark & Moody</SelectItem>
                        <SelectItem value="bright">Bright & Airy</SelectItem>
                        <SelectItem value="lifestyle">
                          Lifestyle & Action
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Upload Reference Image (Optional)</Label>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) =>
                        setUploadedImage(e.target.files?.[0] || null)
                      }
                      className="mt-1"
                    />
                    {uploadedImage && (
                      <p className="text-sm text-gray-600 mt-1">
                        Using: {uploadedImage.name}
                      </p>
                    )}
                  </div>

                  <Button
                    onClick={generatePhotoIdeas}
                    disabled={isGeneratingPhoto || !currentRecipe}
                    className="w-full"
                  >
                    {isGeneratingPhoto ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating Photo Ideas...
                      </>
                    ) : (
                      <>
                        <Camera className="mr-2 h-4 w-4" />
                        Generate Photography Ideas
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Photography Concepts</CardTitle>
                  <CardDescription>
                    AI-generated photo ideas for your recipe
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {photoIdeas.length > 0 ? (
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-4">
                        {photoIdeas.map((idea: any, idx: number) => (
                          <div key={idx} className="border rounded-lg p-4">
                            <h4 className="font-semibold text-sm mb-2">
                              {idea.title}
                            </h4>
                            <p className="text-sm text-gray-600 mb-2">
                              {idea.description}
                            </p>
                            <div className="space-y-1">
                              <p className="text-xs">
                                <strong>Props:</strong> {idea.props}
                              </p>
                              <p className="text-xs">
                                <strong>Lighting:</strong> {idea.lighting}
                              </p>
                              <p className="text-xs">
                                <strong>Angle:</strong> {idea.angle}
                              </p>
                              <p className="text-xs">
                                <strong>Background:</strong> {idea.background}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Camera className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">
                        Generate ideas to see photography concepts
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Export Tab */}
          <TabsContent value="export" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Export Options</CardTitle>
                  <CardDescription>
                    Download or share your recipe in various formats
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Button
                      onClick={() => exportRecipe("pdf")}
                      variant="outline"
                      className="flex flex-col items-center gap-2 h-24"
                      disabled={!currentRecipe}
                    >
                      <FileText className="h-6 w-6" />
                      <span>PDF Recipe Card</span>
                    </Button>
                    <Button
                      onClick={() => exportRecipe("png")}
                      variant="outline"
                      className="flex flex-col items-center gap-2 h-24"
                    >
                      <Image className="h-6 w-6" />
                      <span>PNG Image</span>
                    </Button>
                    <Button
                      onClick={() => exportRecipe("mp4")}
                      variant="outline"
                      className="flex flex-col items-center gap-2 h-24"
                      disabled={
                        mediaContent.filter((m) => m.type === "video")
                          .length === 0
                      }
                    >
                      <Video className="h-6 w-6" />
                      <span>MP4 Video</span>
                    </Button>
                    <Button
                      onClick={() => exportRecipe("html")}
                      variant="outline"
                      className="flex flex-col items-center gap-2 h-24"
                    >
                      <FileText className="h-6 w-6" />
                      <span>HTML Embed</span>
                    </Button>
                  </div>

                  <Separator />

                  <Button
                    onClick={saveToCollection}
                    className="w-full"
                    variant="default"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Save to My Cookbook
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Share Recipe</CardTitle>
                  <CardDescription>
                    Share your creation on social media
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Alert>
                      <Share2 className="h-4 w-4" />
                      <AlertTitle>Ready to Share!</AlertTitle>
                      <AlertDescription>
                        Your recipe has been optimized for{" "}
                        {selectedStyle === "tiktok"
                          ? "TikTok"
                          : selectedStyle === "blog"
                            ? "blog posts"
                            : "social media"}
                        .
                      </AlertDescription>
                    </Alert>

                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm">
                        Share to TikTok
                      </Button>
                      <Button variant="outline" size="sm">
                        Share to Instagram
                      </Button>
                      <Button variant="outline" size="sm">
                        Share to YouTube
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
