// Test script to verify the prioritizer agent endpoints

async function testPrioritizer() {
  console.log('Testing Prioritizer Agent...\n');
  
  // First, let's get some sample tasks from the database
  const tasks = [
    {
      id: 15,
      name: "Final MVP Release",
      description: "Deploy the final MVP version of the app to the app stores for public release.",
      status: "todo",
      priority: "high",
      projectId: 4,
      createdAt: new Date().toISOString()
    },
    {
      id: 17,
      name: "User Feedback Analysis Completion",
      description: "Completion of comprehensive user feedback analysis to inform feature development.",
      status: "todo",
      priority: "high",
      projectId: 4,
      createdAt: new Date().toISOString()
    },
    {
      id: 18,
      name: "MVP Feature Set Finalization",
      description: "Finalized list of features to be included in the MVP.",
      status: "todo",
      priority: "high",
      projectId: 4,
      createdAt: new Date().toISOString()
    }
  ];
  
  // Test the V2 prioritization function directly
  try {
    const { prioritizeTasksV2 } = await import('./server/prioritisor-agent-v2.js');
    
    const weightingProfile = {
      roiWeight: 25,
      effortWeight: 25,
      urgencyWeight: 25,
      strategicWeight: 15,
      dependencyWeight: 10
    };
    
    console.log('Calling prioritizeTasksV2 with', tasks.length, 'tasks...');
    const result = await prioritizeTasksV2(tasks, weightingProfile);
    
    console.log('\nPrioritization Results:');
    result.forEach(task => {
      console.log(`\n${task.name}:`);
      console.log(`  Priority Score: ${task.priorityScore}/10`);
      console.log(`  ROI Level: ${task.roiLevel}`);
      console.log(`  Effort Level: ${task.effortLevel}`);
      console.log(`  Urgency Level: ${task.urgencyLevel}`);
      console.log(`  Strategic Fit: ${task.strategicFit}`);
      console.log(`  Recommendation: ${task.recommendation}`);
      console.log(`  Confidence: ${task.confidence}%`);
    });
    
    console.log('\n✅ Test completed successfully!');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testPrioritizer();