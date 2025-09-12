# Slack Message Scheduler

## Overview

This is a full-stack web application that enables users to connect their Slack workspace and schedule messages to be sent at specific times. The application provides a clean interface for composing messages, selecting channels, and managing scheduled messages with proper timezone support.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The client is built using React with TypeScript and follows a modern component-based architecture:

- **React Router**: Uses `wouter` for lightweight routing
- **State Management**: Leverages React Query for server state management and React hooks for local state
- **UI Framework**: Built with shadcn/ui components based on Radix UI primitives and styled with Tailwind CSS
- **Form Handling**: Uses React Hook Form with Zod validation for type-safe form management
- **Build Tool**: Vite for fast development and optimized production builds

The frontend follows a clean separation of concerns with:
- Pages for route-level components
- Reusable UI components in the components directory
- Custom hooks for shared logic
- Utility functions for common operations

### Backend Architecture
The server is an Express.js application with TypeScript that provides RESTful APIs:

- **Framework**: Express.js with middleware for JSON parsing, CORS, and error handling
- **Development**: Uses tsx for TypeScript execution in development
- **Session Management**: Implements in-memory storage with plans for database persistence
- **API Design**: RESTful endpoints organized by feature (Slack OAuth, message scheduling, channel management)

Key architectural decisions:
- Modular service layer for business logic separation
- Storage abstraction layer allowing easy transition from memory to database storage
- Centralized error handling and logging
- Background scheduler service for processing scheduled messages

### Data Storage Strategy
Currently implements an in-memory storage system with a clear interface for future database migration:

- **Storage Interface**: Abstract storage layer supporting multiple implementations
- **Database Schema**: Designed for PostgreSQL using Drizzle ORM with proper relationships
- **Data Models**: Slack tokens, scheduled messages, channels, and user management
- **Migration Ready**: Drizzle configuration prepared for seamless database integration

The storage layer handles:
- Slack OAuth token management with refresh capabilities
- Scheduled message lifecycle (pending, sent, cancelled, failed)
- Channel information caching for better user experience
- User session and authentication state

### Authentication and Authorization
OAuth 2.0 integration with Slack provides secure workspace access:

- **OAuth Flow**: Standard authorization code flow with token exchange
- **Token Management**: Secure storage of access and refresh tokens with expiration handling
- **Session Persistence**: Client-side storage for authentication state
- **Security**: Proper token refresh mechanism and secure API communication

### Message Scheduling System
Background service architecture for reliable message delivery:

- **Scheduler Service**: Interval-based checking for pending messages
- **Timezone Support**: Proper handling of user timezones for accurate scheduling
- **Error Handling**: Comprehensive error tracking and retry logic
- **Status Management**: Clear message states (pending, sending, sent, failed, cancelled)

The scheduler runs independently and processes messages based on their scheduled time, ensuring reliable delivery even if users are offline.

## External Dependencies

### Core Framework Dependencies
- **React Ecosystem**: React 18 with TypeScript, React Query for server state, React Hook Form for form management
- **Express.js**: Backend API framework with TypeScript support
- **Vite**: Build tool and development server with HMR support

### UI and Styling
- **shadcn/ui**: Component library built on Radix UI primitives
- **Tailwind CSS**: Utility-first CSS framework for styling
- **Radix UI**: Accessible component primitives for complex UI elements
- **Lucide React**: Icon library for consistent iconography

### Database and ORM
- **Drizzle ORM**: Type-safe ORM for PostgreSQL with migration support
- **@neondatabase/serverless**: Serverless PostgreSQL driver for database connectivity
- **Zod**: Runtime type validation for API requests and database schemas

### Slack Integration
- **@slack/web-api**: Official Slack Web API client for workspace integration
- **OAuth 2.0**: Secure authentication flow for Slack workspace access

### Development and Build Tools
- **TypeScript**: Type safety across the entire application
- **ESBuild**: Fast bundling for production server builds
- **PostCSS**: CSS processing with Autoprefixer for browser compatibility
- **Replit Integration**: Development environment integration with specialized plugins

### Utility Libraries
- **date-fns**: Date manipulation and formatting for timezone handling
- **clsx**: Conditional CSS class management
- **nanoid**: Unique ID generation for entities
- **wouter**: Lightweight client-side routing solution