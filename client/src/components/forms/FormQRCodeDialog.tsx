import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Download, Share2, QrCode } from "lucide-react";
import type { Form } from "@shared/schema";

interface FormQRCodeDialogProps {
  form: Form;
  onClose: () => void;
}

export function FormQRCodeDialog({ form, onClose }: FormQRCodeDialogProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");

  // Get QR code data from backend
  const { data: qrData } = useQuery({
    queryKey: [`/api/forms/${form.id}/qr`],
  });

  useEffect(() => {
    if (qrData?.formUrl) {
      // Generate QR code using a free QR code API
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData.formUrl)}`;
      setQrCodeUrl(qrApiUrl);
    }
  }, [qrData]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // You could add a toast notification here
    alert('Copied to clipboard!');
  };

  const downloadQRCode = async () => {
    if (!qrCodeUrl) return;

    try {
      const response = await fetch(qrCodeUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${form.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_qr_code.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading QR code:', error);
      alert('Failed to download QR code');
    }
  };

  const shareForm = async () => {
    if (!qrData?.formUrl) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: form.title,
          text: form.description || 'Fill out this form',
          url: qrData.formUrl,
        });
      } catch (error) {
        // User cancelled sharing or error occurred
        copyToClipboard(qrData.formUrl);
      }
    } else {
      copyToClipboard(qrData.formUrl);
    }
  };

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Share Form: {form.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* QR Code */}
          <Card>
            <CardContent className="flex flex-col items-center p-6">
              {qrCodeUrl ? (
                <div className="space-y-4 text-center">
                  <img
                    src={qrCodeUrl}
                    alt="QR Code"
                    className="w-48 h-48 border border-gray-200 rounded-lg"
                  />
                  <p className="text-sm text-muted-foreground">
                    Scan this QR code with a mobile device to access the form
                  </p>
                </div>
              ) : (
                <div className="w-48 h-48 bg-gray-100 rounded-lg flex items-center justify-center">
                  <QrCode className="h-16 w-16 text-gray-400" />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Form Link */}
          <div className="space-y-2">
            <Label htmlFor="formUrl">Form Link</Label>
            <div className="flex gap-2">
              <Input
                id="formUrl"
                value={qrData?.formUrl || ''}
                readOnly
                className="flex-1"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => qrData?.formUrl && copyToClipboard(qrData.formUrl)}
                title="Copy link"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={shareForm}
              disabled={!qrData?.formUrl}
            >
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={downloadQRCode}
              disabled={!qrCodeUrl}
            >
              <Download className="h-4 w-4 mr-2" />
              Download QR
            </Button>
          </div>

          {/* Instructions */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p><strong>How to use:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Print the QR code and display it at your event</li>
              <li>Share the link via email, social media, or messaging</li>
              <li>Attendees can scan or click to access the form</li>
              <li>View responses in the forms dashboard</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}