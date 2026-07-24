# Requisor AI - Developer Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Getting Started](#getting-started)
5. [Architecture Deep Dive](#architecture-deep-dive)
6. [Database Schema](#database-schema)
7. [API Documentation](#api-documentation)
8. [Frontend Components](#frontend-components)
9. [AI Integration](#ai-integration)
10. [Authentication & Authorization](#authentication--authorization)
11. [Development Guidelines](#development-guidelines)
12. [Testing](#testing)
13. [Deployment](#deployment)
14. [Environment Variables](#environment-variables)
15. [Common Tasks](#common-tasks)
16. [Troubleshooting](#troubleshooting)

## Project Overview

Requisor is an intelligent AI-powered project management platform that transforms workflow optimization through adaptive, enterprise-grade productivity tools. The platform features:

- **AI-First Approach**: Multiple specialized AI agents for different workflows
- **Project Management**: Traditional project management enhanced with AI insights
- **Team Collaboration**: Real-time collaboration features with role-based access
- **Multiple Integrations**: Jira, Smartsheet, Asana, Monday.com, and more
- **Advanced Analytics**: AI-powered insights and bottleneck detection
- **Subscription Management**: Flexible subscription tiers with feature gating

## Technology Stack

### Frontend
- **React 18.3.1** with TypeScript 5.6.3
- **Vite 5.4.19** for build system and development server
- **Wouter 3.3.5** for lightweight routing
- **TanStack Query 5.60.5** for server state management
- **React Hook Form 7.53.1** with Zod validation
- **Tailwind CSS 3.4.14** for styling
- **Radix UI** component primitives
- **Framer Motion 11.18.2** for animations

### Backend
- **Node.js** with Express 4.21.2
- **TypeScript 5.6.3** for type safety
- **Drizzle ORM 0.39.1** for database operations
- **PostgreSQL** database (Neon serverless)
- **Express Session** with PostgreSQL store
- **WebSocket** support with ws 8.18.0

### AI & External Services
- **OpenAI GPT-4o** via openai 4.104.0
- **Anthropic Claude** via @anthropic-ai/sdk 0.37.0
- **SendGrid** for email services
- **Stripe** for subscription management

### Development Tools
- **ESBuild** for production builds
- **TSX** for TypeScript execution
- **Drizzle Kit** for database migrations
- **Various file processing libraries** (pdf-parse, mammoth, xlsx)

## Project Structure

```
requisor/
├── client/                     # Frontend React application
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   │   ├── ui/            # Base UI components (shadcn/ui)
│   │   │   ├── layout/        # Layout components
│   │   │   └── ...            # Feature-specific components
│   │   ├── pages/             # Page components
│   │   ├── hooks/             # Custom React hooks
│   │   ├── lib/               # Utility functions and clients
│   │   ├── App.tsx            # Main application component
│   │   └── main.tsx           # Application entry point
│   ├── index.html             # HTML template
│   └── public/                # Static assets
├── server/                     # Backend Express application
│   ├── routes.ts              # API route definitions
│   ├── index.ts               # Server entry point
│   ├── db.ts                  # Database connection
│   ├── storage.ts             # Data access layer interface
│   ├── database-storage.ts    # PostgreSQL storage implementation
│   ├── vite.ts                # Vite development server setup
│   ├── seed-data.ts           # Database seeding
│   └── ai-tools-seed.ts       # AI tools seeding
├── shared/                     # Shared code between client and server
│   └── schema.ts              # Database schema and types
├── package.json               # Dependencies and scripts
├── vite.config.ts             # Vite configuration
├── drizzle.config.ts          # Drizzle ORM configuration
├── tailwind.config.js         # Tailwind CSS configuration
├── tsconfig.json              # TypeScript configuration
└── README.md                  # Project documentation
```

## Getting Started

### Prerequisites
- Node.js 18+ 
- PostgreSQL database
- OpenAI API key
- Anthropic API key (optional)

### Installation
1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables (see [Environment Variables](#environment-variables))

4. Initialize the database:
   ```bash
   npm run db:push
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:5000`.

### Build Process
- **Development**: `npm run dev` - Runs both frontend and backend with hot reload
- **Production Build**: `npm run build` - Creates optimized production build
- **Production Start**: `npm run start` - Serves the production build

## Architecture Deep Dive

### Frontend Architecture

The frontend follows a modern React architecture with these key patterns:

#### Component Organization
- **UI Components**: Base components in `client/src/components/ui/` using Radix UI primitives
- **Layout Components**: Application layouts in `client/src/components/layout/`
- **Page Components**: Full page components in `client/src/pages/`
- **Feature Components**: Domain-specific components organized by feature

#### State Management
- **Server State**: TanStack Query for API data fetching and caching
- **Client State**: React hooks (useState, useReducer) for local component state
- **Form State**: React Hook Form with Zod validation schemas

#### Routing Strategy
- **Wouter**: Lightweight client-side routing
- **Agent-First Design**: Primary interface is the AI agent chat
- **Traditional Views**: Secondary access to project management features

### Backend Architecture

The backend implements a layered architecture:

#### API Layer (`server/routes.ts`)
- Express routes handling HTTP requests
- Input validation using Zod schemas
- Authentication middleware
- Error handling and logging

#### Storage Layer (`server/storage.ts`)
- Abstract `IStorage` interface for data operations
- `DatabaseStorage` implementation using Drizzle ORM
- Fallback to in-memory storage for development

#### Database Layer (`server/db.ts`)
- PostgreSQL connection using pg driver
- Drizzle ORM configuration
- SSL-enabled connections for production

### AI Integration Architecture

#### Service Pattern
- Centralized AI service functions in route handlers
- Context-aware conversations with memory
- Tool-specific AI agents with specialized prompts

#### External APIs
- OpenAI GPT-4o for primary AI capabilities
- Anthropic Claude for specialized tasks
- Structured response parsing with Zod

## Database Schema

The application uses PostgreSQL with Drizzle ORM. Key entities include:

### Core Entities

#### Users
```typescript
users {
  id: varchar (primary key)
  username: varchar (unique)
  email: varchar (unique)
  firstName, lastName: varchar
  bio: text
  profileImageUrl: varchar
  planId: integer (references subscription_plans)
  stripeCustomerId, stripeSubscriptionId: text
  subscriptionStatus: text
  subscriptionEndDate: timestamp
  createdAt, updatedAt: timestamp
}
```

#### Projects
```typescript
projects {
  id: serial (primary key)
  name: text
  description: text
  dueDate: timestamp
  status: text
  progress: integer
  totalTasks, completedTasks: integer
  icon, iconBg: text
  ownerId: varchar (references users)
  externalId: text
  source: text
  sourceData: jsonb
  aiGenerated: boolean
  createdAt: timestamp
}
```

#### Tasks
```typescript
tasks {
  id: serial (primary key)
  name: text
  description: text
  status: text
  priority: text
  dueDate: timestamp
  projectId: integer (references projects)
  assigneeId: varchar (references users)
  parentTaskId: integer (self-reference)
  estimatedHours: integer
  actualHours: integer
  tags: text[]
  externalId: text
  source: text
  createdAt, updatedAt: timestamp
}
```

### Access Control

#### Project Members
```typescript
projectMembers {
  id: serial (primary key)
  projectId: integer (references projects)
  userId: varchar (references users)
  role: text ("owner", "editor", "viewer")
  addedAt: timestamp
}
```

#### Project Invitations
```typescript
projectInvitations {
  id: serial (primary key)
  projectId: integer (references projects)
  email: text
  role: text
  token: text (unique)
  status: text ("pending", "accepted", "declined")
  invitedBy: varchar (references users)
  createdAt, expiresAt, acceptedAt: timestamp
}
```

### Subscription System

#### Subscription Plans
```typescript
subscriptionPlans {
  id: serial (primary key)
  name, slug: text
  description: text
  price: integer (cents)
  currency: text
  billingInterval: text
  features: text[]
  maxUsers, maxProjects: integer
  stripeProductId, stripePriceId: text
  isActive: boolean
  sortOrder: integer
  createdAt, updatedAt: timestamp
}
```

### AI & Integration Entities

#### AI Agents
```typescript
aiAgents {
  id: serial (primary key)
  name: text
  description: text
  systemPrompt: text
  capabilities: text[]
  isActive: boolean
  category: text
  icon: text
  createdAt, updatedAt: timestamp
}
```

#### Integrations
```typescript
integrations {
  id: serial (primary key)
  userId: varchar (references users)
  provider: text
  accessToken: text
  refreshToken: text
  expiresAt: timestamp
  settings: jsonb
  isActive: boolean
  createdAt, updatedAt: timestamp
}
```

#### Chat Sessions & Messages
```typescript
chatSessions {
  id: serial (primary key)
  userId: varchar (references users)
  projectId: integer (references projects)
  title: text
  isActive: boolean
  createdAt, updatedAt: timestamp
}

chatMessages {
  id: serial (primary key)
  sessionId: integer (references chatSessions)
  role: text ("user", "assistant")
  content: text
  metadata: jsonb
  createdAt: timestamp
}
```

## API Documentation

### Authentication Endpoints

#### `GET /auth/me`
Returns current user information
- **Response**: User object or 401 if not authenticated

#### `GET /auth/login`
Initiates Replit OAuth flow
- **Response**: Redirects to OAuth provider

#### `POST /auth/logout`
Logs out current user
- **Response**: 200 OK

### Project Management Endpoints

#### `GET /api/projects`
Get projects for current user
- **Query Parameters**: 
  - `limit` (optional): Number of projects to return
- **Response**: Array of Project objects

#### `POST /api/projects`
Create new project
- **Body**: InsertProject object
- **Response**: Created Project object

#### `GET /api/projects/:id`
Get specific project
- **Parameters**: 
  - `id`: Project ID
- **Response**: Project object with tasks and members

#### `PUT /api/projects/:id`
Update project
- **Parameters**: 
  - `id`: Project ID
- **Body**: Partial Project object
- **Response**: Updated Project object

#### `DELETE /api/projects/:id`
Delete project
- **Parameters**: 
  - `id`: Project ID
- **Response**: 200 OK

### Task Management Endpoints

#### `GET /api/projects/:projectId/tasks`
Get tasks for project
- **Parameters**: 
  - `projectId`: Project ID
- **Response**: Array of Task objects

#### `POST /api/projects/:projectId/tasks`
Create new task
- **Parameters**: 
  - `projectId`: Project ID
- **Body**: InsertTask object
- **Response**: Created Task object

#### `PUT /api/tasks/:id`
Update task
- **Parameters**: 
  - `id`: Task ID
- **Body**: Partial Task object
- **Response**: Updated Task object

#### `DELETE /api/tasks/:id`
Delete task
- **Parameters**: 
  - `id`: Task ID
- **Response**: 200 OK

### AI Agent Endpoints

#### `POST /api/ai/chat`
Send message to AI agent
- **Body**: 
  ```typescript
  {
    message: string;
    sessionId?: number;
    projectId?: number;
    agentType?: string;
  }
  ```
- **Response**: AI response with session information

#### `POST /api/ai/generate-project`
Generate project from natural language
- **Body**: 
  ```typescript
  {
    description: string;
    requirements?: string;
  }
  ```
- **Response**: Generated project plan

#### `POST /api/ai/analyze-project`
Get AI analysis of project
- **Parameters**: 
  - `projectId`: Project ID
- **Response**: AI insights and recommendations

### Team Management Endpoints

#### `GET /api/projects/:projectId/members`
Get project members
- **Parameters**: 
  - `projectId`: Project ID
- **Response**: Array of ProjectMember objects

#### `POST /api/projects/:projectId/invite`
Invite user to project
- **Parameters**: 
  - `projectId`: Project ID
- **Body**: 
  ```typescript
  {
    email: string;
    role: "owner" | "editor" | "viewer";
  }
  ```
- **Response**: Created ProjectInvitation object

#### `POST /api/invitations/:token/accept`
Accept project invitation
- **Parameters**: 
  - `token`: Invitation token
- **Response**: Created ProjectMember object

### Integration Endpoints

#### `GET /api/integrations`
Get user integrations
- **Response**: Array of Integration objects

#### `POST /api/integrations/:provider/connect`
Connect to external service
- **Parameters**: 
  - `provider`: Service provider name
- **Body**: Provider-specific connection data
- **Response**: Created Integration object

#### `POST /api/integrations/:provider/sync`
Sync data from external service
- **Parameters**: 
  - `provider`: Service provider name
- **Response**: Sync results

## Frontend Components

### Core UI Components (`client/src/components/ui/`)

Built on Radix UI primitives with custom styling:

- `Button`, `Input`, `Textarea` - Form controls
- `Dialog`, `Sheet`, `Popover` - Overlays
- `Table`, `Card`, `Badge` - Data display
- `Select`, `Checkbox`, `Switch` - Input controls
- `Toast`, `Alert` - Notifications
- `Spinner`, `Progress` - Loading states

### Layout Components (`client/src/components/layout/`)

#### `AppLayout`
Main application shell with:
- Responsive sidebar navigation
- Header with user menu
- Content area with proper spacing
- Mobile-responsive design

#### `Sidebar`
Navigation component featuring:
- Collapsible design
- AI agent quick access
- Project shortcuts
- Settings and profile links

### Page Components (`client/src/pages/`)

#### Agent-Focused Pages
- `AgentPage` - Main AI chat interface
- `AIAgentsPage` - Agent directory and management
- `JiraAgent`, `SocialMediaAgent`, etc. - Specialized AI tools

#### Traditional Project Management
- `DashboardPage` - Project overview and metrics
- `Projects` - Project list and management
- `ProjectDetails` - Individual project view
- `Timeline` - Project timeline and Gantt charts
- `Analytics` - AI-powered insights

#### Administrative Pages
- `Settings` - User preferences and configuration
- `Team` - Team management and collaboration
- `IntegrationsPage` - External service connections
- `PricingPage` - Subscription management

### Custom Hooks (`client/src/hooks/`)

#### `useAuth`
Authentication state management:
```typescript
const { user, isAuthenticated, isLoading, login, logout } = useAuth();
```

#### `useToast`
Toast notification system:
```typescript
const { toast } = useToast();
toast({
  title: "Success",
  description: "Project created successfully",
});
```

#### Data Fetching Hooks
Using TanStack Query conventions:
```typescript
const { data: projects, isLoading } = useQuery({
  queryKey: ['/api/projects'],
});

const createProject = useMutation({
  mutationFn: (project: InsertProject) => 
    apiRequest('/api/projects', { method: 'POST', body: project }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
  },
});
```

## AI Integration

### AI Service Architecture

The AI integration is built around specialized agents for different workflows:

#### Core AI Functions

1. **Project Generation**: Convert natural language descriptions into structured project plans
2. **Task Analysis**: Break down complex tasks into manageable subtasks
3. **Bottleneck Detection**: Identify workflow inefficiencies
4. **Resource Planning**: Optimize team allocation and scheduling
5. **Content Generation**: Create various content types (social media, documentation)

#### Agent Types

1. **General Project Agent**: Core project management assistance
2. **Jira Integration Agent**: Agile story writing and estimation
3. **Social Media Agent**: Content creation and campaign planning
4. **Budget Agent**: Cost estimation and financial planning
5. **Onboarding Agent**: User guidance and system setup

#### Implementation Pattern

```typescript
// AI service call pattern
const aiResponse = await fetch('/api/ai/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: userInput,
    sessionId: currentSession,
    projectId: activeProject,
    agentType: 'project-planner'
  })
});
```

### Context Management

- **Session Persistence**: Chat sessions maintain conversation context
- **Project Context**: AI agents have access to project data and history
- **User Preferences**: AI adapts to user communication style and preferences
- **Memory**: Long-term context retention for improved assistance

## Authentication & Authorization

### Authentication Flow

1. **Replit Auth Integration**: Uses OpenID Connect protocol
2. **Session Management**: Express sessions with PostgreSQL storage
3. **Token Handling**: Secure token storage and refresh

### Authorization Levels

#### Project Access Control
- **Owner**: Full project control, can invite/remove members
- **Editor**: Can modify project data and tasks
- **Viewer**: Read-only access to project information

#### Subscription Features
- **Free Tier**: Basic project management
- **Pro Tier**: Advanced AI features, unlimited projects
- **Business Tier**: Team collaboration, integrations
- **Enterprise Tier**: Custom features, priority support

### Security Measures

- **CSRF Protection**: Express session security
- **Input Validation**: Zod schemas for all API inputs
- **SQL Injection Prevention**: Parameterized queries via Drizzle ORM
- **Rate Limiting**: API endpoint protection
- **Secure Headers**: Helmet.js security headers

## Development Guidelines

### Code Style

#### TypeScript Best Practices
- Strict TypeScript configuration
- Explicit return types for functions
- Proper error handling with typed exceptions
- Use of branded types for entity IDs

#### React Patterns
- Functional components with hooks
- Custom hooks for shared logic
- Proper dependency arrays for useEffect
- Memoization for expensive computations

#### Backend Patterns
- Thin controllers, fat services
- Abstract storage interface for testability
- Proper error handling and logging
- Validation at API boundaries

### Component Development

#### UI Component Guidelines
- Use Radix UI primitives as base
- Implement proper TypeScript props
- Support ref forwarding
- Include proper ARIA attributes

#### Form Handling
```typescript
const form = useForm<InsertProject>({
  resolver: zodResolver(insertProjectSchema),
  defaultValues: {
    name: '',
    description: '',
    status: 'active'
  }
});
```

#### API Integration
```typescript
const { mutate: createProject, isPending } = useMutation({
  mutationFn: (data: InsertProject) => 
    apiRequest('/api/projects', { 
      method: 'POST', 
      body: data 
    }),
  onSuccess: (newProject) => {
    queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
    toast({ title: "Project created successfully" });
  }
});
```

### Database Development

#### Schema Changes
1. Update `shared/schema.ts` with new tables/columns
2. Run `npm run db:push` to apply changes
3. Update `IStorage` interface in `server/storage.ts`
4. Implement new methods in `DatabaseStorage`

#### Migration Best Practices
- Always backup data before schema changes
- Use `db:push` for development
- Consider data migration scripts for production
- Test schema changes thoroughly

### API Development

#### Route Implementation
```typescript
app.post('/api/projects', async (req, res) => {
  try {
    // Validate input
    const projectData = insertProjectSchema.parse(req.body);
    
    // Check authorization
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Business logic
    const project = await storage.createProject({
      ...projectData,
      ownerId: req.user.id
    });
    
    res.json(project);
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

## Testing

### Testing Strategy

Currently, the application relies on manual testing through the UI. For robust development, consider implementing:

#### Unit Testing
- Jest for utility functions
- React Testing Library for components
- Supertest for API endpoints

#### Integration Testing
- Database integration tests
- API workflow tests
- AI service integration tests

#### End-to-End Testing
- Playwright or Cypress for user workflows
- Critical path testing
- Cross-browser compatibility

### Manual Testing Checklist

#### Authentication Flow
- [ ] Login/logout functionality
- [ ] Session persistence
- [ ] Authorization checks

#### Project Management
- [ ] Create, read, update, delete projects
- [ ] Task management
- [ ] Team collaboration features

#### AI Features
- [ ] Chat functionality
- [ ] Project generation
- [ ] Task analysis

#### Integrations
- [ ] External service connections
- [ ] Data synchronization
- [ ] Error handling

## Deployment

### Replit Deployment

The application is designed for Replit platform deployment:

1. **Automatic Scaling**: Replit handles scaling based on demand
2. **Environment Management**: Secrets managed through Replit interface
3. **Database Integration**: Automatic PostgreSQL provisioning
4. **Domain Management**: Custom domain support

### Production Configuration

#### Environment Variables
Set the following in production:
- `NODE_ENV=production`
- `DATABASE_URL` - PostgreSQL connection string
- `OPENAI_API_KEY` - OpenAI API access
- `SENDGRID_API_KEY` - Email service
- `STRIPE_SECRET_KEY` - Payment processing

#### Build Process
```bash
npm run build  # Creates production build
npm run start  # Serves production application
```

#### Health Checks
- `GET /health` - Server and database status
- `GET /ready` - Application readiness

### Performance Optimizations

#### Frontend
- Vite production build with code splitting
- React Query caching for API responses
- Lazy loading for page components
- Image optimization for assets

#### Backend
- Express compression middleware
- PostgreSQL connection pooling
- Efficient database queries with proper indexing
- API response caching where appropriate

## Environment Variables

### Required Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@host:port/database

# AI Services
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Email Service
SENDGRID_API_KEY=SG....

# Payment Processing
STRIPE_SECRET_KEY=sk_...
STRIPE_PUBLISHABLE_KEY=pk_...

# Application
NODE_ENV=production
SESSION_SECRET=your-session-secret
```

### Optional Variables

```bash
# Feature Flags
ENABLE_SOCIAL_MEDIA_AGENT=true
ENABLE_JIRA_INTEGRATION=true

# External Integrations
SMARTSHEET_ACCESS_TOKEN=...
ASANA_ACCESS_TOKEN=...
MONDAY_API_KEY=...

# Monitoring
LOG_LEVEL=info
SENTRY_DSN=...
```

### Development Setup

Create a `.env` file in the project root:
```bash
DATABASE_URL=postgresql://localhost:5432/requisor_dev
OPENAI_API_KEY=your-openai-key
NODE_ENV=development
SESSION_SECRET=dev-session-secret
```

## Common Tasks

### Adding a New AI Agent

1. **Create Agent Component**:
   ```typescript
   // client/src/pages/NewAgent.tsx
   export default function NewAgent() {
     // Agent UI implementation
   }
   ```

2. **Add Route**:
   ```typescript
   // client/src/App.tsx
   <Route path="/new-agent" component={() => <AppLayout><NewAgent /></AppLayout>} />
   ```

3. **Implement Backend Logic**:
   ```typescript
   // Add to server/routes.ts
   app.post('/api/ai/new-agent', async (req, res) => {
     // Agent-specific AI logic
   });
   ```

4. **Update Navigation**:
   ```typescript
   // Add to sidebar navigation
   ```

### Adding a New Database Table

1. **Define Schema**:
   ```typescript
   // shared/schema.ts
   export const newTable = pgTable("new_table", {
     id: serial("id").primaryKey(),
     // other columns
   });
   ```

2. **Update Storage Interface**:
   ```typescript
   // server/storage.ts
   interface IStorage {
     // Add new methods
   }
   ```

3. **Implement Storage Methods**:
   ```typescript
   // server/database-storage.ts
   // Implement new methods in DatabaseStorage class
   ```

4. **Apply Schema Changes**:
   ```bash
   npm run db:push
   ```

### Adding New Integration

1. **Create Integration Schema**:
   ```typescript
   // Add provider-specific fields to integrations table
   ```

2. **Implement OAuth Flow**:
   ```typescript
   // server/routes.ts
   app.get('/api/integrations/:provider/auth', ...);
   app.post('/api/integrations/:provider/callback', ...);
   ```

3. **Create Sync Logic**:
   ```typescript
   // Implement data synchronization
   ```

4. **Add Frontend Interface**:
   ```typescript
   // Integration management UI
   ```

## Troubleshooting

### Common Issues

#### Database Connection Issues
```bash
# Check database URL format
# Ensure PostgreSQL is running
# Verify SSL configuration
```

#### AI API Errors
```bash
# Verify API keys are set
# Check rate limits
# Validate request format
```

#### Build Errors
```bash
# Clear node_modules and reinstall
npm run check  # TypeScript type checking
# Verify import paths
```

#### Authentication Problems
```bash
# Check session configuration
# Verify Replit Auth setup
# Clear browser cookies
```

### Development Tools

#### Database Inspection
```bash
# Direct PostgreSQL access
psql $DATABASE_URL

# Drizzle introspection
npx drizzle-kit introspect
```

#### API Testing
```bash
# Test API endpoints
curl -X GET http://localhost:5000/api/projects \
  -H "Cookie: session=..."
```

#### Log Analysis
```bash
# Server logs
npm run dev  # Watch server logs

# Database query logs
# Enable in PostgreSQL configuration
```

### Performance Debugging

#### Frontend Performance
- Use React DevTools Profiler
- Monitor bundle size with Vite build analysis
- Check React Query cache behavior

#### Backend Performance
- Monitor PostgreSQL query performance
- Profile Node.js with built-in profiler
- Check memory usage and garbage collection

#### Database Performance
- Use EXPLAIN ANALYZE for slow queries
- Monitor connection pool usage
- Check index effectiveness

---

This documentation provides a comprehensive guide for developers working with the Requisor AI platform. For additional questions or contributions, please refer to the project repository or contact the development team.