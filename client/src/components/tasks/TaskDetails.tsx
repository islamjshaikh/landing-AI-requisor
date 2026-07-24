import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { 
  FileText, 
  Download, 
  Trash2, 
  Edit3, 
  Send, 
  Paperclip,
  MessageSquare,
  Calendar,
  User,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useDropzone } from 'react-dropzone';
import { formatDistanceToNow } from 'date-fns';
import FileViewer from './FileViewer';

interface TaskDetailsProps {
  taskId: number;
  task: any;
  onTaskUpdate?: () => void;
}

export default function TaskDetails({ taskId, task, onTaskUpdate }: TaskDetailsProps) {
  const [isDescriptionEditing, setIsDescriptionEditing] = useState(false);
  const [description, setDescription] = useState(task?.description || '');
  const [newComment, setNewComment] = useState('');
  const [expandedDescription, setExpandedDescription] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState<any>(null);
  const [fileViewerOpen, setFileViewerOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch task comments
  const { data: comments = [], isLoading: commentsLoading } = useQuery({
    queryKey: ['/api/tasks', taskId, 'comments'],
    enabled: !!taskId
  });

  // Fetch task attachments
  const { data: attachments = [], isLoading: attachmentsLoading } = useQuery({
    queryKey: ['/api/tasks', taskId, 'attachments'],
    enabled: !!taskId
  });

  // Update task description
  const updateDescriptionMutation = useMutation({
    mutationFn: async (newDescription: string) => {
      return apiRequest(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ description: newDescription })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks', taskId] });
      setIsDescriptionEditing(false);
      onTaskUpdate?.();
      toast({
        title: "Description updated",
        description: "Task description has been updated successfully."
      });
    }
  });

  // Create comment mutation
  const createCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest(`/api/tasks/${taskId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks', taskId, 'comments'] });
      setNewComment('');
      toast({
        title: "Comment added",
        description: "Your comment has been added successfully."
      });
    }
  });

  // Upload attachment mutation
  const uploadAttachmentMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      return fetch(`/api/tasks/${taskId}/attachments`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      }).then(res => res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks', taskId, 'attachments'] });
      toast({
        title: "File uploaded",
        description: "File has been attached to the task successfully."
      });
    }
  });

  // Delete attachment mutation
  const deleteAttachmentMutation = useMutation({
    mutationFn: async (attachmentId: number) => {
      return apiRequest(`/api/tasks/attachments/${attachmentId}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks', taskId, 'attachments'] });
      toast({
        title: "File deleted",
        description: "Attachment has been removed successfully."
      });
    }
  });

  // File drop zone
  const onDrop = (acceptedFiles: File[]) => {
    acceptedFiles.forEach(file => {
      uploadAttachmentMutation.mutate(file);
    });
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    maxSize: 100 * 1024 * 1024, // 100MB
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/plain': ['.txt'],
      'text/csv': ['.csv']
    }
  });

  const handleSaveDescription = () => {
    updateDescriptionMutation.mutate(description);
  };

  const handleAddComment = () => {
    if (newComment.trim()) {
      createCommentMutation.mutate(newComment.trim());
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case 'image': return '🖼️';
      case 'pdf': return '📄';
      case 'document': return '📝';
      default: return '📎';
    }
  };

  return (
    <div className="space-y-6">
      {/* Task Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{task?.name}</h2>
          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
            <Badge variant={task?.priority === 'high' ? 'destructive' : task?.priority === 'medium' ? 'default' : 'secondary'}>
              {task?.priority || 'medium'}
            </Badge>
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {task?.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date'}
            </div>
            {task?.assigneeId && (
              <div className="flex items-center gap-1">
                <User className="h-4 w-4" />
                Assigned
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="description" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="description">Description</TabsTrigger>
          <TabsTrigger value="comments" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Comments ({comments.length})
          </TabsTrigger>
          <TabsTrigger value="attachments" className="flex items-center gap-2">
            <Paperclip className="h-4 w-4" />
            Files ({attachments.length})
          </TabsTrigger>
        </TabsList>

        {/* Description Tab */}
        <TabsContent value="description" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base">Description</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsDescriptionEditing(!isDescriptionEditing)}
              >
                <Edit3 className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {isDescriptionEditing ? (
                <div className="space-y-3">
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe this task in detail... You can use Markdown formatting."
                    className="min-h-[200px]"
                  />
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleSaveDescription}
                      disabled={updateDescriptionMutation.isPending}
                    >
                      Save Changes
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setDescription(task?.description || '');
                        setIsDescriptionEditing(false);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  {description ? (
                    <div className={`prose prose-sm max-w-none ${!expandedDescription ? 'line-clamp-6' : ''}`}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {description}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-muted-foreground italic">
                      No description provided. Click the edit button to add one.
                    </p>
                  )}
                  {description && description.length > 300 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedDescription(!expandedDescription)}
                      className="mt-2"
                    >
                      {expandedDescription ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      {expandedDescription ? 'Show less' : 'Show more'}
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Comments Tab */}
        <TabsContent value="comments" className="space-y-4">
          {/* Add Comment */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-3">
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="min-h-[100px]"
                />
                <Button 
                  onClick={handleAddComment}
                  disabled={!newComment.trim() || createCommentMutation.isPending}
                  className="w-full"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Add Comment
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Comments List */}
          <div className="space-y-4">
            {commentsLoading ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">Loading comments...</p>
                </CardContent>
              </Card>
            ) : comments.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">No comments yet. Be the first to comment!</p>
                </CardContent>
              </Card>
            ) : (
              comments.map((comment: any) => (
                <Card key={comment.id}>
                  <CardContent className="pt-6">
                    <div className="flex gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {comment.user?.username?.charAt(0)?.toUpperCase() || 
                           comment.user?.email?.charAt(0)?.toUpperCase() || 
                           'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-medium text-sm">
                            {comment.user?.username || comment.user?.email || 'Unknown User'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {comment.createdAt ? formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true }) : 'recently'}
                          </span>
                          {comment.isEdited && (
                            <Badge variant="secondary" className="text-xs">edited</Badge>
                          )}
                        </div>
                        <div className="prose prose-sm max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {comment.content}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Attachments Tab */}
        <TabsContent value="attachments" className="space-y-4">
          {/* Upload Zone */}
          <Card>
            <CardContent className="pt-6">
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
                }`}
              >
                <input {...getInputProps()} />
                <Paperclip className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                {isDragActive ? (
                  <p>Drop files here...</p>
                ) : (
                  <div>
                    <p>Drag & drop files here, or click to select</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Support for images, PDFs, documents (max 100MB each)
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Attachments List */}
          <div className="grid gap-4">
            {attachmentsLoading ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">Loading attachments...</p>
                </CardContent>
              </Card>
            ) : attachments.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">No files attached yet.</p>
                </CardContent>
              </Card>
            ) : (
              attachments.map((attachment: any) => (
                <Card key={attachment.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{getFileIcon(attachment.fileType)}</span>
                        <div>
                          <p className="font-medium">{attachment.originalName}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatFileSize(attachment.fileSize)} • {attachment.fileType}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            setSelectedAttachment(attachment);
                            setFileViewerOpen(true);
                          }}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteAttachmentMutation.mutate(attachment.id)}
                          disabled={deleteAttachmentMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* File Viewer Modal */}
      {selectedAttachment && (
        <FileViewer
          attachment={selectedAttachment}
          open={fileViewerOpen}
          onOpenChange={setFileViewerOpen}
        />
      )}
    </div>
  );
}