import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Eye, Edit, Trash2, Share, QrCode } from "lucide-react";
import { FormBuilder } from "@/components/forms/FormBuilder";
import { FormResponsesDialog } from "@/components/forms/FormResponsesDialog";
import { FormQRCodeDialog } from "@/components/forms/FormQRCodeDialog";
import { formatDistanceToNow } from "date-fns";
import type { Form } from "@shared/schema";

export default function FormsPage() {
  const [showFormBuilder, setShowFormBuilder] = useState(false);
  const [editingForm, setEditingForm] = useState<Form | null>(null);
  const [viewingResponses, setViewingResponses] = useState<Form | null>(null);
  const [showingQRCode, setShowingQRCode] = useState<Form | null>(null);

  // Fetch user's forms
  const { data: forms = [], isLoading, refetch } = useQuery({
    queryKey: ["/api/forms"],
  });

  const handleNewForm = () => {
    setEditingForm(null);
    setShowFormBuilder(true);
  };

  const handleEditForm = (form: Form) => {
    setEditingForm(form);
    setShowFormBuilder(true);
  };

  const handleFormSaved = () => {
    setShowFormBuilder(false);
    setEditingForm(null);
    refetch();
  };

  const handleDeleteForm = async (form: Form) => {
    if (!confirm(`Are you sure you want to delete "${form.title}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/forms/${form.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        refetch();
      } else {
        alert('Failed to delete form');
      }
    } catch (error) {
      console.error('Error deleting form:', error);
      alert('Failed to delete form');
    }
  };

  const copyFormLink = (form: Form) => {
    const baseUrl = window.location.origin;
    const formUrl = `${baseUrl}/form/${form.shareToken}`;
    navigator.clipboard.writeText(formUrl);
    // You could add a toast notification here
    alert('Form link copied to clipboard!');
  };

  if (showFormBuilder) {
    return (
      <FormBuilder
        form={editingForm}
        onSave={handleFormSaved}
        onCancel={() => {
          setShowFormBuilder(false);
          setEditingForm(null);
        }}
      />
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Forms</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage your event inquiry forms
          </p>
        </div>
        <Button onClick={handleNewForm} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Create Form
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : forms.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Plus className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No forms yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first event inquiry form to start collecting responses
            </p>
            <Button onClick={handleNewForm}>Create Your First Form</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {forms.map((form: Form) => (
            <Card key={form.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="truncate">{form.title}</span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewingResponses(form)}
                      title="View Responses"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditForm(form)}
                      title="Edit Form"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyFormLink(form)}
                      title="Copy Link"
                    >
                      <Share className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowingQRCode(form)}
                      title="QR Code"
                    >
                      <QrCode className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteForm(form)}
                      title="Delete Form"
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {form.description || "No description"}
                </p>
                <div className="flex justify-between items-center text-xs text-muted-foreground">
                  <span>{form.responseCount || 0} responses</span>
                  <span>
                    Created {formatDistanceToNow(new Date(form.createdAt), { addSuffix: true })}
                  </span>
                </div>
                <div className="mt-2">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    form.isActive 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {form.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialogs */}
      {viewingResponses && (
        <FormResponsesDialog 
          form={viewingResponses}
          onClose={() => setViewingResponses(null)}
        />
      )}

      {showingQRCode && (
        <FormQRCodeDialog 
          form={showingQRCode}
          onClose={() => setShowingQRCode(null)}
        />
      )}
    </div>
  );
}