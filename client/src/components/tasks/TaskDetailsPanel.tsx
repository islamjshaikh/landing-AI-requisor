import { useState, useEffect } from "react";
import { X, Calendar as CalendarIcon, Clock, User, MessageSquare, Paperclip, Plus, Send, Edit2, Trash2, Download, CheckSquare, Sparkles, ChevronDown, ChevronRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import type { Task } from "@shared/schema";
import { useDropzone } from "react-dropzone";
import FileViewer from "./FileViewer";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface TaskDetailsPanelProps {
  task: Task;
  projectId: number;
  onClose: () => void;
}

interface Comment {
  id: number;
  taskId: number;
  userId: string;
  content: string;
  isEdited: boolean;
  createdAt: string;
  updatedAt: string;
  user?: {
    email: string;
    firstName?: string;
    lastName?: string;
  };
}

interface Attachment {
  id: number;
  taskId: number;
  userId: string;
  filename: string;
  originalName: string;
  fileType: string;
  mimeType: string;
  fileSize: number;
  uploadPath: string;
  createdAt: string;
  user?: {
    email: string;
    firstName?: string;
    lastName?: string;
  };
}

export function TaskDetailsPanel({ task, projectId, onClose }: TaskDetailsPanelProps) {
  const [activeTab, setActiveTab] = useState<"details" | "subtasks" | "comments" | "files">("details");
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [description, setDescription] = useState(task.description || "");
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(task.name || "");
  const [isEditingDueDate, setIsEditingDueDate] = useState(false);
  const [editDueDate, setEditDueDate] = useState<Date | undefined>(
    task.dueDate ? new Date(task.dueDate) : undefined
  );
  const [newComment, setNewComment] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editingCommentContent, setEditingCommentContent] = useState("");
  const [selectedFile, setSelectedFile] = useState<Attachment | null>(null);
  const [newSubtaskName, setNewSubtaskName] = useState("");
  const [showSubtaskInput, setShowSubtaskInput] = useState(false);
  const [isGeneratingSubtasks, setIsGeneratingSubtasks] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch comments
  const { data: comments = [] } = useQuery<Comment[]>({
    queryKey: [`/api/tasks/${task.id}/comments`],
    enabled: !!task.id,
  });

  // Fetch attachments
  const { data: attachments = [] } = useQuery<Attachment[]>({
    queryKey: [`/api/tasks/${task.id}/attachments`],
    enabled: !!task.id,
  });

  // Fetch subtasks
  const { data: subtasks = [] } = useQuery<Task[]>({
    queryKey: [`/api/tasks/${task.id}/subtasks`],
    enabled: !!task.id,
  });

  // Update description mutation
  const updateDescriptionMutation = useMutation({
    mutationFn: async (newDescription: string) => {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: newDescription }),
      });
      if (!response.ok) throw new Error("Failed to update description");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Description updated" });
      setIsEditingDescription(false);
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/tasks`] });
    },
  });

  const updateNameMutation = useMutation({
    mutationFn: async (newName: string) => {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      if (!response.ok) throw new Error("Failed to update name");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Task name updated" });
      setIsEditingName(false);
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/tasks`] });
    },
  });

  const updateDueDateMutation = useMutation({
    mutationFn: async (newDate: Date | null) => {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dueDate: newDate ? newDate.toISOString() : null }),
      });
      if (!response.ok) throw new Error("Failed to update due date");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Due date updated" });
      setIsEditingDueDate(false);
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/tasks`] });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, isCompleted: newStatus === "done" }),
      });
      if (!response.ok) throw new Error("Failed to update status");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Status updated" });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/tasks`] });
    },
  });

  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await fetch(`/api/tasks/${task.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!response.ok) throw new Error("Failed to add comment");
      return response.json();
    },
    onSuccess: () => {
      setNewComment("");
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${task.id}/comments`] });
      toast({ title: "Comment added" });
    },
  });

  // Update comment mutation
  const updateCommentMutation = useMutation({
    mutationFn: async ({ id, content }: { id: number; content: string }) => {
      const response = await fetch(`/api/tasks/comments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!response.ok) throw new Error("Failed to update comment");
      return response.json();
    },
    onSuccess: () => {
      setEditingCommentId(null);
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${task.id}/comments`] });
      toast({ title: "Comment updated" });
    },
  });

  // Create subtask mutation
  const createSubtaskMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await fetch(`/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name,
          projectId: task.projectId,
          parentTaskId: task.id,
          isSubtask: true,
          status: "todo",
          priority: "medium"
        }),
      });
      if (!response.ok) throw new Error("Failed to create subtask");
      return response.json();
    },
    onSuccess: () => {
      setNewSubtaskName("");
      setShowSubtaskInput(false);
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${task.id}/subtasks`] });
      toast({ title: "Subtask created" });
    },
  });

  // Update subtask mutation
  const updateSubtaskMutation = useMutation({
    mutationFn: async ({ id, isCompleted }: { id: number; isCompleted: boolean }) => {
      const response = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCompleted, status: isCompleted ? "done" : "todo" }),
      });
      if (!response.ok) throw new Error("Failed to update subtask");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${task.id}/subtasks`] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/tasks`] });
    },
  });

  // Delete subtask mutation
  const deleteSubtaskMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/tasks/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete subtask");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${task.id}/subtasks`] });
      toast({ title: "Subtask deleted" });
    },
  });

  // Generate AI subtasks mutation
  const generateSubtasksMutation = useMutation({
    mutationFn: async () => {
      setIsGeneratingSubtasks(true);
      const response = await fetch(`/api/tasks/${task.id}/generate-subtasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to generate subtasks");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${task.id}/subtasks`] });
      toast({ title: "AI subtasks generated successfully" });
    },
    onSettled: () => {
      setIsGeneratingSubtasks(false);
    },
  });

  // Delete comment mutation
  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: number) => {
      const response = await fetch(`/api/tasks/comments/${commentId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete comment");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${task.id}/comments`] });
      toast({ title: "Comment deleted" });
    },
  });

  // Delete attachment mutation
  const deleteAttachmentMutation = useMutation({
    mutationFn: async (attachmentId: number) => {
      const response = await fetch(`/api/tasks/attachments/${attachmentId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete attachment");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${task.id}/attachments`] });
      toast({ title: "File deleted" });
    },
  });

  // File upload
  const uploadFileMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      
      const response = await fetch(`/api/tasks/${task.id}/attachments`, {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to upload file");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${task.id}/attachments`] });
      toast({ title: "File uploaded successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      acceptedFiles.forEach((file) => {
        if (file.size > 20 * 1024 * 1024) {
          toast({
            title: "File too large",
            description: `${file.name} exceeds 20MB limit`,
            variant: "destructive",
          });
          return;
        }
        uploadFileMutation.mutate(file);
      });
    },
    maxSize: 20 * 1024 * 1024,
  });

  const priorityColor = {
    low: "bg-green-100 text-green-800",
    medium: "bg-yellow-100 text-yellow-800",
    high: "bg-red-100 text-red-800",
  };

  const statusColor = {
    "not-started": "bg-gray-100 text-gray-800",
    "in-progress": "bg-blue-100 text-blue-800",
    completed: "bg-green-100 text-green-800",
  };

  const getUserInitials = (user?: { firstName?: string; lastName?: string; email: string }) => {
    if (!user) return "?";
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    return user.email.substring(0, 2).toUpperCase();
  };

  const getUserName = (user?: { firstName?: string; lastName?: string; email: string }) => {
    if (!user) return "Unknown";
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user.email;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div className="fixed right-0 top-0 h-full w-[500px] bg-white border-l shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b">
        {isEditingName ? (
          <div className="flex items-center gap-2 flex-1 mr-4">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="text-xl font-semibold"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && editName.trim()) {
                  updateNameMutation.mutate(editName.trim());
                } else if (e.key === 'Escape') {
                  setIsEditingName(false);
                  setEditName(task.name || "");
                }
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (editName.trim()) updateNameMutation.mutate(editName.trim());
              }}
              disabled={updateNameMutation.isPending}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { setIsEditingName(false); setEditName(task.name || ""); }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <h2
            className="text-xl font-semibold truncate flex-1 mr-4 cursor-pointer hover:text-blue-600 transition-colors"
            onClick={() => setIsEditingName(true)}
            title="Click to edit name"
          >
            {task.name}
          </h2>
        )}
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Task Meta Info */}
      <div className="px-6 py-4 bg-gray-50 border-b space-y-3">
        <div className="flex items-center gap-4 text-sm">
          <Badge className={priorityColor[task.priority || "medium"]}>
            {task.priority || "medium"} priority
          </Badge>
          <Badge
            className={cn(
              statusColor[task.status] || "bg-gray-100 text-gray-800",
              "cursor-pointer hover:opacity-80"
            )}
            onClick={() => {
              const statusCycle: Record<string, string> = {
                "not-started": "in-progress",
                "in-progress": "done",
                "done": "not-started",
                "todo": "in-progress",
              };
              const next = statusCycle[task.status] || "in-progress";
              updateStatusMutation.mutate(next);
            }}
            title="Click to cycle status"
          >
            {(task.status || "").replace("-", " ").replace("_", " ")}
          </Badge>
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <Popover open={isEditingDueDate} onOpenChange={setIsEditingDueDate}>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors text-left">
                <CalendarIcon className="h-4 w-4" />
                <span>
                  {task.dueDate
                    ? `Due ${format(new Date(task.dueDate), "MMM dd, yyyy")}`
                    : "Set due date"}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={editDueDate}
                onSelect={(date) => {
                  setEditDueDate(date);
                  updateDueDateMutation.mutate(date || null);
                }}
                initialFocus
              />
              {task.dueDate && (
                <div className="p-2 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-red-600 hover:text-red-700"
                    onClick={() => {
                      setEditDueDate(undefined);
                      updateDueDateMutation.mutate(null);
                    }}
                  >
                    Remove due date
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
          <div className="flex items-center gap-2 text-gray-600">
            <Clock className="h-4 w-4" />
            <span>Created {format(new Date(task.createdAt), "MMM dd")}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        <button
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "details"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
          onClick={() => setActiveTab("details")}
        >
          Details
        </button>
        <button
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "subtasks"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
          onClick={() => setActiveTab("subtasks")}
        >
          Subtasks ({subtasks?.length || 0})
        </button>
        <button
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "comments"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
          onClick={() => setActiveTab("comments")}
        >
          Comments ({comments.length})
        </button>
        <button
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "files"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
          onClick={() => setActiveTab("files")}
        >
          Files ({attachments.length})
        </button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        {activeTab === "subtasks" && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-900">Subtasks</h3>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => generateSubtasksMutation.mutate()}
                  disabled={isGeneratingSubtasks}
                >
                  <Sparkles className="h-4 w-4 mr-1" />
                  AI Subtasks
                </Button>
                <Button
                  size="sm"
                  onClick={() => setShowSubtaskInput(true)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Subtask
                </Button>
              </div>
            </div>

            {/* Add subtask input */}
            {showSubtaskInput && (
              <div className="flex gap-2 mb-4">
                <Input
                  value={newSubtaskName}
                  onChange={(e) => setNewSubtaskName(e.target.value)}
                  placeholder="Enter subtask name..."
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && newSubtaskName.trim()) {
                      createSubtaskMutation.mutate(newSubtaskName);
                    }
                  }}
                />
                <Button
                  size="sm"
                  onClick={() => createSubtaskMutation.mutate(newSubtaskName)}
                  disabled={!newSubtaskName.trim() || createSubtaskMutation.isPending}
                >
                  Add
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowSubtaskInput(false);
                    setNewSubtaskName("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            )}

            {/* Subtasks list */}
            <div className="space-y-2">
              {subtasks.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">
                  No subtasks yet. Add subtasks manually or use AI to generate them.
                </p>
              ) : (
                subtasks.map((subtask) => (
                  <div
                    key={subtask.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <Checkbox
                      checked={subtask.isCompleted}
                      onCheckedChange={(checked) => 
                        updateSubtaskMutation.mutate({ 
                          id: subtask.id, 
                          isCompleted: checked as boolean 
                        })
                      }
                    />
                    <div className="flex-1">
                      <p className={`text-sm ${subtask.isCompleted ? 'line-through text-gray-500' : ''}`}>
                        {subtask.name}
                      </p>
                      {subtask.description && (
                        <p className="text-xs text-gray-500 mt-1">{subtask.description}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteSubtaskMutation.mutate(subtask.id)}
                      className="h-7 w-7 p-0 text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === "details" && (
          <div className="p-6 space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-900">Description</h3>
                {!isEditingDescription && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditingDescription(true)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              
              {isEditingDescription ? (
                <div className="space-y-2">
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Add a description..."
                    rows={6}
                    className="resize-none"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => updateDescriptionMutation.mutate(description)}
                      disabled={updateDescriptionMutation.isPending}
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setIsEditingDescription(false);
                        setDescription(task.description || "");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-600 whitespace-pre-wrap">
                  {task.description || (
                    <span className="text-gray-400 italic">No description added</span>
                  )}
                </div>
              )}
            </div>

            {/* Additional task details can go here */}
          </div>
        )}

        {activeTab === "comments" && (
          <div className="p-6 space-y-4">
            {/* Add comment form */}
            <div className="space-y-2">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                rows={3}
                className="resize-none"
              />
              <Button
                size="sm"
                onClick={() => newComment.trim() && addCommentMutation.mutate(newComment)}
                disabled={!newComment.trim() || addCommentMutation.isPending}
              >
                <Send className="h-4 w-4 mr-2" />
                Post Comment
              </Button>
            </div>

            <Separator />

            {/* Comments list */}
            <div className="space-y-4">
              {comments.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">
                  No comments yet. Be the first to comment!
                </p>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {getUserInitials(comment.user)}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {getUserName(comment.user)}
                          </span>
                          <span className="text-xs text-gray-500">
                            {format(new Date(comment.createdAt), "MMM dd, h:mm a")}
                          </span>
                          {comment.isEdited && (
                            <span className="text-xs text-gray-400">(edited)</span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingCommentId(comment.id);
                              setEditingCommentContent(comment.content);
                            }}
                            className="h-7 w-7 p-0"
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteCommentMutation.mutate(comment.id)}
                            className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      
                      {editingCommentId === comment.id ? (
                        <div className="space-y-2">
                          <Textarea
                            value={editingCommentContent}
                            onChange={(e) => setEditingCommentContent(e.target.value)}
                            rows={3}
                            className="resize-none text-sm"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() =>
                                updateCommentMutation.mutate({
                                  id: comment.id,
                                  content: editingCommentContent,
                                })
                              }
                              disabled={updateCommentMutation.isPending}
                              className="h-7"
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingCommentId(null)}
                              className="h-7"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                          {comment.content}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === "files" && (
          <div className="p-6 space-y-4">
            {/* File upload area */}
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? "border-blue-400 bg-blue-50"
                  : "border-gray-300 hover:border-gray-400"
              }`}
            >
              <input {...getInputProps()} />
              <Paperclip className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm text-gray-600">
                {isDragActive
                  ? "Drop files here..."
                  : "Drag & drop files here, or click to select"}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Support for images, PDFs, documents (max 20MB each)
              </p>
            </div>

            {/* Files list */}
            <div className="space-y-2">
              {attachments.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">
                  No files attached yet
                </p>
              ) : (
                attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Paperclip className="h-4 w-4 text-gray-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {attachment.originalName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(attachment.fileSize)} • Uploaded by{" "}
                          {getUserName(attachment.user)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 ml-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedFile(attachment)}
                        className="h-8 px-2"
                      >
                        View
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="h-8 px-2"
                      >
                        <a
                          href={`/uploads/${attachment.filename}`}
                          download={attachment.originalName}
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteAttachmentMutation.mutate(attachment.id)}
                        className="h-8 px-2 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </ScrollArea>

      {/* File viewer modal */}
      {selectedFile && (
        <FileViewer
          attachment={selectedFile}
          open={true}
          onOpenChange={(open) => !open && setSelectedFile(null)}
        />
      )}
    </div>
  );
}