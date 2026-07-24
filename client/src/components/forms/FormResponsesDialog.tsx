import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Download, Calendar, Mail, User, Building } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Form, FormSubmission } from "@shared/schema";

interface FormResponsesDialogProps {
  form: Form;
  onClose: () => void;
}

export function FormResponsesDialog({ form, onClose }: FormResponsesDialogProps) {
  const { data: submissions = [], isLoading } = useQuery({
    queryKey: [`/api/forms/${form.id}/submissions`],
  });

  const exportToCsv = () => {
    if (!submissions.length) return;

    // Get all unique field keys from all submissions
    const allKeys = new Set<string>();
    submissions.forEach((submission: FormSubmission) => {
      if (submission.responseData && typeof submission.responseData === 'object') {
        Object.keys(submission.responseData).forEach(key => allKeys.add(key));
      }
    });

    const fieldKeys = Array.from(allKeys);
    const headers = ['Submitted At', 'Email', 'Name', ...fieldKeys].filter(Boolean);
    
    const csvContent = [
      headers.join(','),
      ...submissions.map((submission: FormSubmission) => {
        const responseData = submission.responseData as Record<string, any> || {};
        const row = [
          new Date(submission.createdAt).toLocaleString(),
          submission.submitterEmail || '',
          submission.submitterName || '',
          ...fieldKeys.map(key => {
            const value = responseData[key];
            if (Array.isArray(value)) {
              return `"${value.join(', ')}"`;
            }
            return `"${String(value || '').replace(/"/g, '""')}"`;
          })
        ];
        return row.join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${form.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_responses.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderFieldValue = (key: string, value: any) => {
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value);
    }
    return String(value || '');
  };

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Form Responses: {form.title}</span>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {submissions.length} response{submissions.length !== 1 ? 's' : ''}
              </Badge>
              {submissions.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportToCsv}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="h-3 bg-gray-200 rounded w-full"></div>
                      <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : submissions.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <Mail className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No responses yet</h3>
                <p className="text-muted-foreground">
                  Share your form to start collecting responses
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {submissions.map((submission: FormSubmission, index: number) => {
                const responseData = submission.responseData as Record<string, any> || {};
                
                return (
                  <Card key={submission.id}>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between text-base">
                        <span className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Response #{submissions.length - index}
                        </span>
                        <span className="text-sm font-normal text-muted-foreground">
                          {formatDistanceToNow(new Date(submission.createdAt), { addSuffix: true })}
                        </span>
                      </CardTitle>
                      
                      {(submission.submitterEmail || submission.submitterName) && (
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          {submission.submitterName && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {submission.submitterName}
                            </span>
                          )}
                          {submission.submitterEmail && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {submission.submitterEmail}
                            </span>
                          )}
                        </div>
                      )}
                    </CardHeader>
                    
                    <CardContent className="pt-0">
                      <div className="space-y-3">
                        {Object.entries(responseData).map(([key, value]) => (
                          <div key={key}>
                            <div className="flex items-start justify-between">
                              <span className="text-sm font-medium text-muted-foreground capitalize">
                                {key.replace(/[_-]/g, ' ')}:
                              </span>
                              <span className="text-sm flex-1 ml-3 text-right">
                                {renderFieldValue(key, value)}
                              </span>
                            </div>
                            <Separator className="mt-2" />
                          </div>
                        ))}
                        
                        {/* Additional metadata */}
                        <div className="pt-2 border-t">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-muted-foreground">
                            {submission.ipAddress && (
                              <span>IP: {submission.ipAddress}</span>
                            )}
                            {submission.userAgent && (
                              <span className="truncate" title={submission.userAgent}>
                                Browser: {submission.userAgent.split(' ')[0]}
                              </span>
                            )}
                            {submission.referrer && (
                              <span className="truncate" title={submission.referrer}>
                                Referrer: {new URL(submission.referrer).hostname}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}