# Requisor - AI-Powered Project Management Platform

An intelligent project management platform that empowers users to create, plan, and collaborate on projects using cutting-edge AI technologies.

## Features

- **AI Project Generation**: Create comprehensive project plans with a simple prompt
- **Task Management**: Organize tasks in a customizable Kanban board
- **AI Tool Recommendations**: Get personalized AI tool suggestions for your tasks
- **Team Collaboration**: Invite team members to your projects with role-based permissions
- **Project Analytics**: Gain insights into project progress and bottlenecks
- **Integration Support**: Connect with third-party tools (Smartsheet, etc.)

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, shadcn/ui components
- **Backend**: Express.js, Node.js
- **Database**: PostgreSQL with Drizzle ORM
- **AI**: OpenAI integration (GPT-4o)
- **Authentication**: OpenID Connect (via Replit platform)

## Prerequisites

- Node.js (v18 or higher)
- PostgreSQL database
- OpenAI API key

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```
DATABASE_URL=postgresql://user:password@localhost:5432/database
OPENAI_API_KEY=your_openai_api_key
SENDGRID_API_KEY=your_sendgrid_api_key (optional for email)
```

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/requisor.git
   cd requisor
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Set up the database:
   ```
   npm run db:push
   ```

4. Start the development server:
   ```
   npm run dev
   ```

5. Open http://localhost:5000 in your browser

## Project Structure

- `/client` - React frontend
- `/server` - Express backend
- `/shared` - Shared types and schemas
- `/attached_assets` - Project assets

## Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add some amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Built with ❤️ by Requisor
- Powered by OpenAI's GPT-4o API