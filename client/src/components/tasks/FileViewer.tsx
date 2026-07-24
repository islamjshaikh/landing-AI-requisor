import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, X } from 'lucide-react';

interface FileViewerProps {
  attachment: {
    id: number;
    filename: string;
    originalName: string;
    fileType: string;
    mimeType: string;
    fileSize: number;
    uploadPath: string;
  };
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
}

export default function FileViewer({ attachment, open, onOpenChange, onClose }: FileViewerProps) {
  const [imageError, setImageError] = useState(false);

  const handleDownload = () => {
    // Create a download link for the file
    const link = document.createElement('a');
    link.href = `/uploads/${attachment.filename}`;
    link.download = attachment.originalName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderFilePreview = () => {
    if (attachment.fileType === 'image' && !imageError) {
      return (
        <div className="flex justify-center">
          <img
            src={`/uploads/${attachment.filename}`}
            alt={attachment.originalName}
            className="max-w-full max-h-[70vh] object-contain"
            onError={() => setImageError(true)}
          />
        </div>
      );
    }

    if (attachment.fileType === 'pdf') {
      return (
        <div className="flex justify-center">
          <iframe
            src={`/uploads/${attachment.filename}`}
            title={attachment.originalName}
            className="w-full h-[70vh] border rounded"
          />
        </div>
      );
    }

    // For other file types, show a generic preview
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="text-6xl mb-4">
          {attachment.fileType === 'document' ? '📝' : '📎'}
        </div>
        <p className="text-lg font-medium">{attachment.originalName}</p>
        <p className="text-sm text-muted-foreground">
          {attachment.mimeType} • {Math.round(attachment.fileSize / 1024)} KB
        </p>
        <Button onClick={handleDownload} className="mt-4">
          <Download className="h-4 w-4 mr-2" />
          Download File
        </Button>
      </div>
    );
  };

  const isOpen = open !== undefined ? open : true;
  const handleOpenChange = onOpenChange || onClose || (() => {});

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 py-4 border-b flex flex-row items-center justify-between">
          <DialogTitle>{attachment.originalName}</DialogTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => handleOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <div className="px-6 py-4 overflow-auto">
          {renderFilePreview()}
        </div>
      </DialogContent>
    </Dialog>
  );
}