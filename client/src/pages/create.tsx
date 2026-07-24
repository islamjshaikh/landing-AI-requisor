
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";

export default function CreateAgent() {


  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 pt-32 pb-16 max-w-2xl">
        <Button 
          variant="ghost" 
          className="mb-8"
          onClick={() => setLocation("/")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-3xl font-bold">Build Your Agent</CardTitle>
            <CardDescription>
              Custom train an agent on your specific workflows and docs.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Agent Name</Label>
              <Input id="name" placeholder="e.g. Finance Assistant" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Input id="role" placeholder="e.g. Budget Analyst" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea 
                id="description" 
                placeholder="Describe what this agent does..." 
                className="min-h-[100px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="instructions">System Instructions</Label>
              <Textarea 
                id="instructions" 
                placeholder="Give your agent specific rules and behaviors..." 
                className="min-h-[150px]"
              />
            </div>

            <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-white">
              Create Agent
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
