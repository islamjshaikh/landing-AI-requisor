import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Plus, Edit, Trash2, Target, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Milestone {
  id: number;
  projectId: number;
  name: string;
  description?: string;
  dueDate?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'not-started' | 'in-progress' | 'completed';
  createdAt: string;
  updatedAt: string;
}

interface MilestonesTabProps {
  projectId: number;
}

export function MilestonesTab({ projectId }: MilestonesTabProps) {
  // Temporarily simplify to isolate the issue
  const { data: milestones = [], isLoading, error } = useQuery({
    queryKey: ['/api/projects', projectId, 'milestones'],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/milestones`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch milestones');
      return response.json();
    },
    retry: 2,
    retryDelay: 1000
  });
  
  // Simplified error/loading states
  if (error) {
    return <div>Error loading milestones: {error.message}</div>;
  }
  
  if (isLoading) {
    return <div>Loading milestones...</div>;
  }
  
  // Simple milestone display to test
  return (
    <div>
      <h2>Milestones ({milestones.length})</h2>
      {milestones.length === 0 ? (
        <p>No milestones found</p>
      ) : (
        <ul>
          {milestones.map((milestone: any) => (
            <li key={milestone.id}>
              {milestone.name || 'Unnamed milestone'} - {milestone.status || 'unknown status'}
            </li>
          ))}
        </ul>
      )}

    </div>
  );
}