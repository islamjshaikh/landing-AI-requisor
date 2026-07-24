import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Rocket,
  GitBranch,
  CheckCircle,
  Edit,
  Trash2,
  Plus,
  ChevronRight,
  Target,
  Sparkles,
} from "lucide-react";

interface Story {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  priority: "high" | "medium" | "low";
  storyPoints?: number;
  status?: string;
  dueDate?: string;
}

interface Epic {
  id: string;
  name: string;
  description: string;
  stories: Story[];
}

interface ProjectCanvas {
  initiative: {
    id: string;
    name: string;
    description: string;
    epics: Epic[];
  };
}

interface CanvasUpdate {
  action: string;
  target?: string;
  data?: any;
  explanation?: string;
}

interface EnhancedAgileCanvasProps {
  canvas: ProjectCanvas | null;
  onCanvasUpdate: (canvas: ProjectCanvas) => void;
  onUpdateNotification: (message: string) => void;
  lastUpdate?: CanvasUpdate;
}

export function EnhancedAgileCanvas({
  canvas,
  onCanvasUpdate,
  onUpdateNotification,
  lastUpdate,
}: EnhancedAgileCanvasProps) {
  const [editingStoryId, setEditingStoryId] = useState<string | null>(null);
  const [editingEpicId, setEditingEpicId] = useState<string | null>(null);
  const [highlightedElement, setHighlightedElement] = useState<string | null>(
    null,
  );

  // Handle animated updates based on last action
  useEffect(() => {
    if (lastUpdate) {
      // Highlight the updated element
      const elementId = lastUpdate.target || `${lastUpdate.action}_element`;
      setHighlightedElement(elementId);

      // Show notification
      if (lastUpdate.explanation) {
        onUpdateNotification(lastUpdate.explanation);
      }

      // Clear highlight after animation
      setTimeout(() => setHighlightedElement(null), 2000);
    }
  }, [lastUpdate, onUpdateNotification]);

  if (!canvas) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center justify-center h-full"
      >
        <div className="text-center">
          <Target className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No plan generated yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Describe your project to get started
          </p>
        </div>
      </motion.div>
    );
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-700 border-red-200";
      case "medium":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "low":
        return "bg-green-100 text-green-700 border-green-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const handleStoryEdit = (storyId: string, updates: Partial<Story>) => {
    if (!canvas) return;

    const updatedCanvas = { ...canvas };

    for (const epic of updatedCanvas.initiative.epics) {
      const story = epic.stories.find((s) => s.id === storyId);
      if (story) {
        Object.assign(story, updates);
        break;
      }
    }

    onCanvasUpdate(updatedCanvas);
  };

  const handleEpicEdit = (epicId: string, updates: Partial<Epic>) => {
    if (!canvas) return;

    const updatedCanvas = { ...canvas };
    const epic = updatedCanvas.initiative.epics.find((e) => e.id === epicId);

    if (epic) {
      Object.assign(epic, updates);
      onCanvasUpdate(updatedCanvas);
    }
  };

  const handleDeleteStory = (epicId: string, storyId: string) => {
    if (!canvas) return;

    const updatedCanvas = { ...canvas };
    const epic = updatedCanvas.initiative.epics.find((e) => e.id === epicId);

    if (epic) {
      epic.stories = epic.stories.filter((s) => s.id !== storyId);
      onCanvasUpdate(updatedCanvas);
    }
  };

  const handleDeleteEpic = (epicId: string) => {
    if (!canvas) return;

    const updatedCanvas = { ...canvas };
    updatedCanvas.initiative.epics = updatedCanvas.initiative.epics.filter(
      (e) => e.id !== epicId,
    );
    onCanvasUpdate(updatedCanvas);
  };

  const addNewStory = (epicId: string) => {
    if (!canvas) return;

    const updatedCanvas = { ...canvas };
    const epic = updatedCanvas.initiative.epics.find((e) => e.id === epicId);

    if (epic) {
      const newStory: Story = {
        id: `story_${Date.now()}`,
        title: "New User Story",
        description: "Story description...",
        acceptanceCriteria: ["Acceptance criteria..."],
        priority: "medium",
      };
      epic.stories.push(newStory);
      onCanvasUpdate(updatedCanvas);
      setEditingStoryId(newStory.id);
    }
  };

  const addNewEpic = () => {
    if (!canvas) return;

    const updatedCanvas = { ...canvas };
    const newEpic: Epic = {
      id: `epic_${Date.now()}`,
      name: "New Epic",
      description: "Epic description...",
      stories: [],
    };
    updatedCanvas.initiative.epics.push(newEpic);
    onCanvasUpdate(updatedCanvas);
    setEditingEpicId(newEpic.id);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 p-4"
    >
      {/* Initiative Header */}
      <motion.div
        className={`bg-gradient-to-r from-violet-50 to-purple-50 rounded-lg p-6 border ${
          highlightedElement === "initiative" ? "ring-2 ring-violet-400" : ""
        }`}
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center gap-3 mb-3">
          <Rocket className="h-6 w-6 text-violet-600" />
          <h2 className="text-xl font-bold text-gray-900">
            Initiative: {canvas.initiative.name}
          </h2>
          {highlightedElement === "initiative" && (
            <Sparkles className="h-5 w-5 text-violet-500 animate-pulse" />
          )}
        </div>
        <p className="text-gray-700 leading-relaxed">
          {canvas.initiative.description}
        </p>
      </motion.div>

      {/* Epics Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Epics & User Stories
          </h3>
          <Button
            size="sm"
            onClick={addNewEpic}
            className="bg-violet-600 hover:bg-violet-700"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Epic
          </Button>
        </div>

        <AnimatePresence>
          {canvas.initiative.epics.map((epic, epicIndex) => (
            <motion.div
              key={epic.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ delay: epicIndex * 0.1 }}
              className={`${
                highlightedElement === epic.id ? "ring-2 ring-blue-400" : ""
              }`}
            >
              <Collapsible defaultOpen>
                <Card className="overflow-hidden">
                  <CollapsibleTrigger className="w-full">
                    <CardHeader className="bg-gray-50 hover:bg-gray-100 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <GitBranch className="h-5 w-5 text-gray-600" />
                          {editingEpicId === epic.id ? (
                            <Input
                              value={epic.name}
                              onChange={(e) =>
                                handleEpicEdit(epic.id, {
                                  name: e.target.value,
                                })
                              }
                              onBlur={() => setEditingEpicId(null)}
                              onKeyPress={(e) =>
                                e.key === "Enter" && setEditingEpicId(null)
                              }
                              className="font-semibold text-lg"
                              autoFocus
                            />
                          ) : (
                            <CardTitle className="text-left">
                              {epic.name}
                            </CardTitle>
                          )}
                          <Badge variant="secondary" className="text-xs">
                            {epic.stories.length} stories
                          </Badge>
                          {highlightedElement === epic.id && (
                            <Sparkles className="h-4 w-4 text-blue-500 animate-pulse" />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingEpicId(epic.id);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteEpic(epic.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <ChevronRight className="h-5 w-5 text-gray-400" />
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <CardContent className="pt-4">
                      {/* Epic Description */}
                      <div className="mb-4">
                        {editingEpicId === epic.id ? (
                          <Textarea
                            value={epic.description}
                            onChange={(e) =>
                              handleEpicEdit(epic.id, {
                                description: e.target.value,
                              })
                            }
                            onBlur={() => setEditingEpicId(null)}
                            rows={2}
                            className="text-sm"
                          />
                        ) : (
                          <p className="text-sm text-gray-600 mb-4">
                            {epic.description}
                          </p>
                        )}
                      </div>

                      {/* Stories */}
                      <div className="space-y-3">
                        <AnimatePresence>
                          {epic.stories.map((story, storyIndex) => (
                            <motion.div
                              key={story.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              transition={{ delay: storyIndex * 0.05 }}
                              className={`bg-white rounded-lg border p-4 space-y-3 ${
                                highlightedElement === story.id
                                  ? "ring-2 ring-green-400"
                                  : ""
                              }`}
                            >
                              {editingStoryId === story.id ? (
                                // Edit Mode
                                <div className="space-y-3">
                                  <Input
                                    value={story.title}
                                    onChange={(e) =>
                                      handleStoryEdit(story.id, {
                                        title: e.target.value,
                                      })
                                    }
                                    className="font-medium"
                                    placeholder="Story title..."
                                  />
                                  <Textarea
                                    value={story.description}
                                    onChange={(e) =>
                                      handleStoryEdit(story.id, {
                                        description: e.target.value,
                                      })
                                    }
                                    rows={3}
                                    placeholder="Story description..."
                                  />
                                  <div className="flex gap-2">
                                    <Select
                                      value={story.priority}
                                      onValueChange={(
                                        value: "high" | "medium" | "low",
                                      ) =>
                                        handleStoryEdit(story.id, {
                                          priority: value,
                                        })
                                      }
                                    >
                                      <SelectTrigger className="w-32">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="high">
                                          High
                                        </SelectItem>
                                        <SelectItem value="medium">
                                          Medium
                                        </SelectItem>
                                        <SelectItem value="low">Low</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <Input
                                      type="number"
                                      value={story.storyPoints || ""}
                                      onChange={(e) =>
                                        handleStoryEdit(story.id, {
                                          storyPoints:
                                            parseInt(e.target.value) ||
                                            undefined,
                                        })
                                      }
                                      placeholder="Points"
                                      className="w-20"
                                    />
                                    <Button
                                      size="sm"
                                      onClick={() => setEditingStoryId(null)}
                                    >
                                      <CheckCircle className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                // View Mode
                                <>
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <h5 className="font-medium text-sm flex items-center gap-2">
                                        {story.title}
                                        {highlightedElement === story.id && (
                                          <Sparkles className="h-3 w-3 text-green-500 animate-pulse" />
                                        )}
                                      </h5>
                                      <p className="text-sm text-gray-600 mt-1">
                                        {story.description}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-2 ml-4">
                                      <Badge
                                        className={`text-xs ${getPriorityColor(story.priority)}`}
                                      >
                                        {story.priority}
                                      </Badge>
                                      {story.storyPoints && (
                                        <Badge
                                          variant="outline"
                                          className="text-xs"
                                        >
                                          {story.storyPoints} pts
                                        </Badge>
                                      )}
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() =>
                                          setEditingStoryId(story.id)
                                        }
                                      >
                                        <Edit className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() =>
                                          handleDeleteStory(epic.id, story.id)
                                        }
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>

                                  {/* Acceptance Criteria */}
                                  {story.acceptanceCriteria.length > 0 && (
                                    <div className="mt-3">
                                      <p className="text-xs font-medium text-gray-500 mb-2">
                                        Acceptance Criteria:
                                      </p>
                                      <ul className="text-xs text-gray-600 space-y-1">
                                        {story.acceptanceCriteria.map(
                                          (criteria, index) => (
                                            <li
                                              key={index}
                                              className="flex items-start"
                                            >
                                              <CheckCircle className="h-3 w-3 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                                              {criteria}
                                            </li>
                                          ),
                                        )}
                                      </ul>
                                    </div>
                                  )}
                                </>
                              )}
                            </motion.div>
                          ))}
                        </AnimatePresence>

                        {/* Add Story Button */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addNewStory(epic.id)}
                          className="w-full border-dashed border-gray-300 hover:border-violet-400 hover:bg-violet-50"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add User Story
                        </Button>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
