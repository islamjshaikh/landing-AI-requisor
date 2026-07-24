import { SimpleChatAgent } from '@/components/project-planner/SimpleChatAgent';

export function TestChat() {
  return (
    <div className="container mx-auto max-w-4xl py-8">
      <h1 className="text-2xl font-bold mb-6">Test Chat Agent</h1>
      <div className="h-[600px]">
        <SimpleChatAgent />
      </div>
    </div>
  );
}