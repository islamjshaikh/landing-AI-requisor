import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  Plus, 
  FolderOpen, 
  Clock, 
  BarChart3, 
  Target, 
  Calendar,
  Users,
  TrendingUp,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';

interface Suggestion {
  id: string;
  label: string;
  prompt: string;
  icon: React.ComponentType<{ className?: string }>;
  category: 'create' | 'analyze' | 'manage' | 'view';
  priority?: 'high' | 'medium' | 'low';
}

interface SuggestionPillsProps {
  suggestions?: Suggestion[];
  onSuggestionClick: (prompt: string) => void;
  className?: string;
  showCategories?: boolean;
}

const DEFAULT_SUGGESTIONS: Suggestion[] = [
  {
    id: 'create-project',
    label: 'Create New Project',
    prompt: 'Create a new project for building a mobile app',
    icon: Plus,
    category: 'create',
    priority: 'high'
  },
  {
    id: 'show-projects',
    label: 'Show All Projects',
    prompt: 'Show me all my current projects and their status',
    icon: FolderOpen,
    category: 'view',
    priority: 'high'
  },
  {
    id: 'overdue-tasks',
    label: 'Overdue Tasks',
    prompt: 'What tasks are overdue across all my projects?',
    icon: AlertTriangle,
    category: 'manage',
    priority: 'high'
  },
  {
    id: 'project-analysis',
    label: 'Project Analysis',
    prompt: 'Analyze the health of my current projects',
    icon: BarChart3,
    category: 'analyze',
    priority: 'medium'
  },
  {
    id: 'optimize-timeline',
    label: 'Optimize Timeline',
    prompt: 'Help me optimize the timeline for my current project',
    icon: Target,
    category: 'analyze',
    priority: 'medium'
  },
  {
    id: 'weekly-tasks',
    label: "This Week's Tasks",
    prompt: 'What tasks do I need to focus on this week?',
    icon: Calendar,
    category: 'view',
    priority: 'medium'
  },
  {
    id: 'team-progress',
    label: 'Team Progress',
    prompt: 'How is my team progressing on current projects?',
    icon: Users,
    category: 'view',
    priority: 'low'
  },
  {
    id: 'project-insights',
    label: 'Project Insights',
    prompt: 'Give me insights on project performance and trends',
    icon: TrendingUp,
    category: 'analyze',
    priority: 'low'
  }
];

const CATEGORY_COLORS = {
  create: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
  analyze: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
  manage: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100',
  view: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
};

const CATEGORY_LABELS = {
  create: 'Create',
  analyze: 'Analyze',
  manage: 'Manage',
  view: 'View'
};

export function SuggestionPills({ 
  suggestions = DEFAULT_SUGGESTIONS, 
  onSuggestionClick, 
  className,
  showCategories = false 
}: SuggestionPillsProps) {
  
  const groupedSuggestions = showCategories 
    ? suggestions.reduce((acc, suggestion) => {
        if (!acc[suggestion.category]) {
          acc[suggestion.category] = [];
        }
        acc[suggestion.category].push(suggestion);
        return acc;
      }, {} as Record<string, Suggestion[]>)
    : { all: suggestions };

  const renderSuggestionPill = (suggestion: Suggestion) => {
    const IconComponent = suggestion.icon;
    
    return (
      <Button
        key={suggestion.id}
        variant="outline"
        size="sm"
        onClick={() => onSuggestionClick(suggestion.prompt)}
        className={cn(
          "rounded-full px-4 py-2 text-sm font-medium transition-all duration-200",
          "border-2 hover:shadow-md hover:scale-105",
          "flex items-center gap-2",
          CATEGORY_COLORS[suggestion.category]
        )}
      >
        <IconComponent className="h-4 w-4" />
        {suggestion.label}
      </Button>
    );
  };

  return (
    <div className={cn("space-y-4", className)}>
      {showCategories ? (
        Object.entries(groupedSuggestions).map(([category, categorySupgestions]) => (
          <div key={category} className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS]}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {categorySupgestions.map(renderSuggestionPill)}
            </div>
          </div>
        ))
      ) : (
        <div className="flex flex-wrap gap-2 justify-center">
          {suggestions.map(renderSuggestionPill)}
        </div>
      )}
    </div>
  );
}

export { DEFAULT_SUGGESTIONS, type Suggestion };