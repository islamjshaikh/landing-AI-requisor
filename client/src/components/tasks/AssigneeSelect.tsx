import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users, Bot, User } from "lucide-react";

interface AssigneeOption {
  id: string;
  name: string;
  type: "user" | "ai_agent" | "self";
  avatar?: string;
  email?: string;
  color?: string;
  agentType?: string;
  capabilities?: string[];
}

interface AssigneeSelectProps {
  value?: string;
  onValueChange: (value: string | undefined) => void;
  projectId?: number;
  placeholder?: string;
}

export function AssigneeSelect({ 
  value, 
  onValueChange, 
  projectId,
  placeholder = "Assign to..."
}: AssigneeSelectProps) {
  
  // Fetch current user info
  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/user"],
    enabled: true,
  });

  // Fetch project team members
  const { data: teamMembers = [] } = useQuery({
    queryKey: [`/api/projects/${projectId}/members`],
    enabled: !!projectId,
  });

  // Fetch user's AI agents  
  const { data: aiAgents = [] } = useQuery({
    queryKey: ["/api/ai-agents"],
    enabled: true,
  });

  // Build assignee options
  const assigneeOptions: AssigneeOption[] = React.useMemo(() => {
    const options: AssigneeOption[] = [];

    // Add "Assign to myself" option
    if (currentUser) {
      options.push({
        id: currentUser.id,
        name: "Assign to myself",
        type: "self",
        avatar: "👤",
        email: currentUser.email
      });
    }

    // Add team members from the project
    if (teamMembers && teamMembers.length > 0) {
      teamMembers.forEach((member: any) => {
        if (member.userId !== currentUser?.id) { // Don't duplicate current user
          options.push({
            id: member.userId,
            name: member.name || member.email || "Team Member",
            type: "user",
            avatar: member.avatar || "👤",
            email: member.email,
          });
        }
      });
    }

    // Add AI agents
    if (aiAgents && aiAgents.length > 0) {
      aiAgents.forEach((agent: any) => {
        options.push({
          id: `ai_${agent.id}`,
          name: agent.name,
          type: "ai_agent",
          avatar: agent.avatar || "🤖",
          color: agent.color || "#3b82f6",
          agentType: agent.agentType,
          capabilities: agent.capabilities || []
        });
      });
    }

    return options;
  }, [currentUser, teamMembers, aiAgents]);

  const selectedOption = assigneeOptions.find(option => option.id === value);

  const handleValueChange = (newValue: string) => {
    if (newValue === "unassign") {
      onValueChange(undefined);
    } else {
      onValueChange(newValue);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "self":
        return <User className="h-3 w-3" />;
      case "user":
        return <Users className="h-3 w-3" />;
      case "ai_agent":
        return <Bot className="h-3 w-3" />;
      default:
        return <User className="h-3 w-3" />;
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case "self":
        return "bg-green-100 text-green-800";
      case "user":
        return "bg-blue-100 text-blue-800";
      case "ai_agent":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <Select value={value || ""} onValueChange={handleValueChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder}>
          {selectedOption && (
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-xs">
                  {selectedOption.avatar}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">{selectedOption.name}</span>
              <Badge className={`${getTypeBadgeColor(selectedOption.type)} text-xs px-1 py-0`}>
                {getTypeIcon(selectedOption.type)}
              </Badge>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-64">
        {/* Unassign Option */}
        <SelectItem value="unassign" className="text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-gray-100 flex items-center justify-center">
              <span className="text-xs">−</span>
            </div>
            <span>Unassigned</span>
          </div>
        </SelectItem>

        {/* Self Assignment */}
        {currentUser && (
          <SelectItem value={currentUser.id}>
            <div className="flex items-center gap-3 py-1">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-sm">👤</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Assign to myself</span>
                  <Badge className={`${getTypeBadgeColor("self")} text-xs px-1.5 py-0.5`}>
                    {getTypeIcon("self")}
                    <span className="ml-1">Me</span>
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">{currentUser.email}</span>
              </div>
            </div>
          </SelectItem>
        )}

        {/* Team Members Section */}
        {teamMembers && teamMembers.length > 0 && (
          <>
            {teamMembers
              .filter((member: any) => member.userId !== currentUser?.id)
              .map((member: any) => (
                <SelectItem key={member.userId} value={member.userId}>
                  <div className="flex items-center gap-3 py-1">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-sm">
                        {member.avatar || "👤"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {member.name || member.email || "Team Member"}
                        </span>
                        <Badge className={`${getTypeBadgeColor("user")} text-xs px-1.5 py-0.5`}>
                          {getTypeIcon("user")}
                          <span className="ml-1">Team</span>
                        </Badge>
                      </div>
                      {member.email && (
                        <span className="text-xs text-muted-foreground">{member.email}</span>
                      )}
                    </div>
                  </div>
                </SelectItem>
              ))}
          </>
        )}

        {/* AI Agents Section */}
        {aiAgents && aiAgents.length > 0 && (
          <>
            {aiAgents.map((agent: any) => (
              <SelectItem key={agent.id} value={`ai_${agent.id}`}>
                <div className="flex items-center gap-3 py-1">
                  <Avatar className="h-8 w-8" style={{ backgroundColor: agent.color + "20" }}>
                    <AvatarFallback 
                      className="text-sm" 
                      style={{ color: agent.color }}
                    >
                      {agent.avatar || "🤖"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{agent.name}</span>
                      <Badge className={`${getTypeBadgeColor("ai_agent")} text-xs px-1.5 py-0.5`}>
                        {getTypeIcon("ai_agent")}
                        <span className="ml-1">AI</span>
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground capitalize">
                        {agent.agentType || "assistant"}
                      </span>
                      {agent.capabilities && agent.capabilities.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          • {agent.capabilities.slice(0, 2).join(", ")}
                          {agent.capabilities.length > 2 && "..."}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </SelectItem>
            ))}
          </>
        )}

        {/* Empty State */}
        {assigneeOptions.length === 0 && (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            No team members or AI agents available
          </div>
        )}
      </SelectContent>
    </Select>
  );
}