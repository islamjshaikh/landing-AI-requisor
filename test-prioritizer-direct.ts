// Direct test of the prioritizer function

async function testPrioritizer() {
  console.log('Testing Prioritizer Agent V2 directly...\n');
  console.log('OpenAI API Key present:', !!process.env.OPENAI_API_KEY);
  
  // Import the function
  const { prioritizeTasksV2 } = await import('./server/prioritisor-agent-v2');
  
  // Test data
  const testTasks = [
    {
      id: 1,
      name: "Deploy MVP to App Store",
      description: "Final deployment of the MVP version to production app stores",
      status: "todo",
      priority: "high",
      dueDate: "2025-02-01",
      projectId: 4,
      createdAt: "2025-01-01",
      progress: 0
    },
    {
      id: 2,
      name: "User Feedback Analysis",
      description: "Analyze user feedback from beta testing phase",
      status: "in_progress",
      priority: "medium",
      dueDate: "2025-01-20",
      projectId: 4,
      createdAt: "2025-01-01",
      progress: 30
    },
    {
      id: 3,
      name: "Fix Minor UI Bugs",
      description: "Address small UI issues reported during testing",
      status: "todo",
      priority: "low",
      dueDate: "2025-01-25",
      projectId: 4,
      createdAt: "2025-01-01",
      progress: 0
    }
  ];
  
  const weightingProfile = {
    roiWeight: 25,
    effortWeight: 20,
    urgencyWeight: 25,
    strategicWeight: 20,
    dependencyWeight: 10
  };
  
  try {
    console.log('Calling prioritizeTasksV2 with', testTasks.length, 'tasks...\n');
    const result = await prioritizeTasksV2(testTasks, weightingProfile);
    
    console.log('\n✅ Prioritization Results:');
    console.log('Number of prioritized tasks:', result.length);
    
    result.forEach(task => {
      console.log(`\n📋 ${task.name}:`);
      console.log(`  Priority Score: ${task.priorityScore}/10`);
      console.log(`  ROI: ${task.roiLevel}`);
      console.log(`  Effort: ${task.effortLevel}`);
      console.log(`  Urgency: ${task.urgencyLevel}`);
      console.log(`  Strategic Fit: ${task.strategicFit}`);
      console.log(`  Recommendation: ${task.recommendation}`);
      console.log(`  Confidence: ${task.confidence}%`);
    });
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testPrioritizer();