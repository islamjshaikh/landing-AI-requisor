// Test script to send an invitation email - ES Module version
// This will help us test the email invitation functionality without requiring authentication
import fetch from 'node-fetch';

async function sendInvitation() {
  try {
    // Project ID 1 as a test ID
    const projectId = 1; 
    
    // Let's test using our new generic endpoint
    console.log('Testing sending invitation to naveen@staythanks.com...');
    
    // The UI will use the /api/invitations endpoint now
    const response = await fetch(`http://localhost:5000/api/invitations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Adding a mock auth header to simulate being authenticated in development
        'X-Test-Auth': 'true' 
      },
      body: JSON.stringify({
        projectId: projectId,
        email: 'naveen@staythanks.com',
        role: 'viewer'
      })
    });
    
    const text = await response.text();
    console.log('Response status:', response.status);
    console.log('Response text:', text);
    
    try {
      const data = JSON.parse(text);
      if (!response.ok) {
        console.error('Error sending invitation:', data);
      } else {
        console.log('Invitation sent successfully!');
      }
    } catch (e) {
      console.log('Response was not JSON');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

sendInvitation();