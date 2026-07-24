import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, GripVertical, Save, X } from "lucide-react";
import type { Form } from "@shared/schema";

// Form field types
type FieldType = "text" | "email" | "textarea" | "select" | "radio" | "checkbox";

interface FormField {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
}

interface FormBuilderProps {
  form?: Form | null;
  onSave: () => void;
  onCancel: () => void;
}

const formSchema = z.object({
  title: z.string().min(1, "Form title is required"),
  description: z.string().optional(),
  isPublic: z.boolean().default(true),
  isActive: z.boolean().default(true),
});

export function FormBuilder({ form, onSave, onCancel }: FormBuilderProps) {
  const [fields, setFields] = useState<FormField[]>([
    {
      id: "name",
      type: "text",
      label: "Name",
      placeholder: "Enter your full name",
      required: true,
    },
    {
      id: "email", 
      type: "email",
      label: "Email",
      placeholder: "Enter your email address",
      required: true,
    },
    {
      id: "company",
      type: "text", 
      label: "Company/Organization",
      placeholder: "Enter your company or organization",
      required: false,
    },
    {
      id: "interested_in",
      type: "select",
      label: "Interested In",
      required: true,
      options: ["Presentation", "Product Demo", "Updates", "General Inquiry"],
    },
  ]);

  const formMethods = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: form?.title || "",
      description: form?.description || "",
      isPublic: form?.isPublic ?? true,
      isActive: form?.isActive ?? true,
    },
  });

  // Load existing form data
  useEffect(() => {
    if (form) {
      formMethods.reset({
        title: form.title,
        description: form.description || "",
        isPublic: form.isPublic,
        isActive: form.isActive,
      });

      if (form.fields && Array.isArray(form.fields)) {
        setFields(form.fields as FormField[]);
      }
    }
  }, [form, formMethods]);

  const addField = () => {
    const newField: FormField = {
      id: `field_${Date.now()}`,
      type: "text",
      label: "New Field",
      placeholder: "",
      required: false,
    };
    setFields([...fields, newField]);
  };

  const updateField = (index: number, updates: Partial<FormField>) => {
    const newFields = [...fields];
    newFields[index] = { ...newFields[index], ...updates };
    setFields(newFields);
  };

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const addOption = (fieldIndex: number) => {
    const newFields = [...fields];
    if (!newFields[fieldIndex].options) {
      newFields[fieldIndex].options = [];
    }
    newFields[fieldIndex].options!.push("New Option");
    setFields(newFields);
  };

  const updateOption = (fieldIndex: number, optionIndex: number, value: string) => {
    const newFields = [...fields];
    if (newFields[fieldIndex].options) {
      newFields[fieldIndex].options![optionIndex] = value;
      setFields(newFields);
    }
  };

  const removeOption = (fieldIndex: number, optionIndex: number) => {
    const newFields = [...fields];
    if (newFields[fieldIndex].options) {
      newFields[fieldIndex].options!.splice(optionIndex, 1);
      setFields(newFields);
    }
  };

  const handleSave = async (data: z.infer<typeof formSchema>) => {
    try {
      const formData = {
        ...data,
        fields: fields,
      };

      const url = form ? `/api/forms/${form.id}` : "/api/forms";
      const method = form ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        onSave();
      } else {
        const error = await response.text();
        alert(`Failed to save form: ${error}`);
      }
    } catch (error) {
      console.error("Error saving form:", error);
      alert("Failed to save form");
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">
            {form ? "Edit Form" : "Create New Form"}
          </h1>
          <p className="text-muted-foreground mt-1">
            Design your event inquiry form with custom fields
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={formMethods.handleSubmit(handleSave)}>
            <Save className="h-4 w-4 mr-2" />
            Save Form
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form Settings */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Form Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Form Title</Label>
                <Input
                  id="title"
                  {...formMethods.register("title")}
                  placeholder="Event Inquiry Form"
                />
                {formMethods.formState.errors.title && (
                  <p className="text-sm text-red-600 mt-1">
                    {formMethods.formState.errors.title.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  {...formMethods.register("description")}
                  placeholder="Collect inquiries for your upcoming event..."
                  rows={3}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="isPublic">Public Form</Label>
                <Switch
                  id="isPublic"
                  checked={formMethods.watch("isPublic")}
                  onCheckedChange={(checked) => formMethods.setValue("isPublic", checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="isActive">Active</Label>
                <Switch
                  id="isActive"
                  checked={formMethods.watch("isActive")}
                  onCheckedChange={(checked) => formMethods.setValue("isActive", checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Form Fields */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Form Fields
                <Button size="sm" onClick={addField}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Field
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {fields.map((field, index) => (
                <div key={field.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-gray-400" />
                      <Badge variant={field.required ? "default" : "secondary"}>
                        {field.required ? "Required" : "Optional"}
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeField(index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Field Label</Label>
                      <Input
                        value={field.label}
                        onChange={(e) => updateField(index, { label: e.target.value })}
                        placeholder="Field label"
                      />
                    </div>
                    <div>
                      <Label>Field Type</Label>
                      <Select
                        value={field.type}
                        onValueChange={(value: FieldType) => updateField(index, { type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Text</SelectItem>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="textarea">Textarea</SelectItem>
                          <SelectItem value="select">Dropdown</SelectItem>
                          <SelectItem value="radio">Radio Buttons</SelectItem>
                          <SelectItem value="checkbox">Checkboxes</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label>Placeholder</Label>
                    <Input
                      value={field.placeholder || ""}
                      onChange={(e) => updateField(index, { placeholder: e.target.value })}
                      placeholder="Enter placeholder text"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={field.required}
                      onCheckedChange={(checked) => updateField(index, { required: checked })}
                    />
                    <Label>Required field</Label>
                  </div>

                  {/* Options for select/radio/checkbox fields */}
                  {(field.type === "select" || field.type === "radio" || field.type === "checkbox") && (
                    <div>
                      <div className="flex items-center justify-between">
                        <Label>Options</Label>
                        <Button size="sm" variant="outline" onClick={() => addOption(index)}>
                          <Plus className="h-4 w-4 mr-1" />
                          Add Option
                        </Button>
                      </div>
                      <div className="space-y-2 mt-2">
                        {field.options?.map((option, optionIndex) => (
                          <div key={optionIndex} className="flex items-center gap-2">
                            <Input
                              value={option}
                              onChange={(e) => updateOption(index, optionIndex, e.target.value)}
                              placeholder="Option text"
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeOption(index, optionIndex)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Form Preview */}
        <div className="lg:sticky lg:top-6">
          <Card>
            <CardHeader>
              <CardTitle>Form Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold">
                    {formMethods.watch("title") || "Form Title"}
                  </h3>
                  {formMethods.watch("description") && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {formMethods.watch("description")}
                    </p>
                  )}
                </div>

                {fields.map((field) => (
                  <div key={field.id}>
                    <Label className="flex items-center gap-1">
                      {field.label}
                      {field.required && <span className="text-red-500">*</span>}
                    </Label>
                    
                    {field.type === "text" || field.type === "email" ? (
                      <Input 
                        type={field.type}
                        placeholder={field.placeholder}
                        disabled
                        className="mt-1"
                      />
                    ) : field.type === "textarea" ? (
                      <Textarea 
                        placeholder={field.placeholder}
                        disabled
                        className="mt-1"
                      />
                    ) : field.type === "select" ? (
                      <Select disabled>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder={field.placeholder || "Select an option"} />
                        </SelectTrigger>
                        <SelectContent>
                          {field.options?.map((option, i) => (
                            <SelectItem key={i} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : field.type === "radio" ? (
                      <div className="space-y-2 mt-1">
                        {field.options?.map((option, i) => (
                          <div key={i} className="flex items-center space-x-2">
                            <input type="radio" disabled className="text-blue-600" />
                            <span className="text-sm">{option}</span>
                          </div>
                        ))}
                      </div>
                    ) : field.type === "checkbox" ? (
                      <div className="space-y-2 mt-1">
                        {field.options?.map((option, i) => (
                          <div key={i} className="flex items-center space-x-2">
                            <input type="checkbox" disabled className="text-blue-600" />
                            <span className="text-sm">{option}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}

                <Button disabled className="w-full">
                  Submit Form
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}