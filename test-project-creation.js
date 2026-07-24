// Test script for project creation
import fetch from 'node-fetch';

async function testCreateProject() {
  try {
    const projectData = {
      name: 'Test Project',
      description: 'A test project created via our test script',
      status: 'active',
      progress: 0,
      totalTasks: 0,
      completedTasks: 0,
      icon: 'folder-open',
      iconBg: 'blue',
      source: 'manual',
      aiGenerated: false
    };
    
    console.log('Sending project data:', JSON.stringify(projectData, null, 2));
    
    const response = await fetch('http://localhost:5000/api/test/projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(projectData),
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('Project created successfully!');
      console.log('Response:', JSON.stringify(result, null, 2));
    } else {
      console.error('Failed to create project:', result);
    }
  } catch (error) {
    console.error('Error during project creation test:', error);
  }
}

// Run the test
testCreateProject();