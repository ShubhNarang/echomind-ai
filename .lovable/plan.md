

# RECALLION — AI Memory Brain

## Overview
A futuristic AI-powered second brain app with a ChatGPT-inspired interface where users save memories, ask natural language questions, and get intelligent answers from their personal knowledge base. Built with real AI (Lovable AI), real vector search (pgvector), and user authentication.

---

## Phase 1: Foundation & Auth

### Dark-Mode Futuristic UI Shell
- Three-panel layout: Left sidebar (memory manager), Center (AI chat), Right (insights panel)
- Dark theme with glassmorphism cards, soft gradients, and smooth animations
- Responsive — right panel collapses on smaller screens, left sidebar toggleable

### Authentication
- Sign up / Login page with email auth
- User profiles table for display name and avatar
- Protected routes — redirect unauthenticated users to login

---

## Phase 2: Memory System (Left Panel)

### Memory Storage
- Database table for memories with fields: content, summary, keywords, importance score (1-10), AI insight, tags, timestamps, user_id
- Vector embeddings column using pgvector for semantic search

### Memory Manager UI
- "Add Memory" input with text area
- Memory cards list with search bar and tag filters
- Each card shows: summary preview, importance badge, tags, date
- Edit and delete functionality
- Smooth fade/scale animations on card interactions

### AI Memory Processing
When a memory is saved, an edge function calls Lovable AI to:
- Generate a concise summary
- Extract keywords and tags
- Rate importance (1-10)
- Generate a short insight
- Create vector embedding for semantic search

---

## Phase 3: AI Chat Interface (Center Panel)

### ChatGPT-Style Chat
- Message input with send button
- Streaming AI responses rendered with markdown
- Conversation history per user stored in database

### Semantic Retrieval Pipeline
- When user asks a question, generate embedding for the query
- Perform vector similarity search against stored memories
- Pass relevant memories as context to the AI
- AI generates answer grounded in the user's own knowledge

### Response Enrichment
- Each AI response displays: the answer, referenced memories (clickable), confidence indicator, and brief reasoning summary

---

## Phase 4: Memory Intelligence (Right Panel)

### Insights Dashboard
- Memory Health Score (based on average importance, recency, duplicates)
- Top Important Memories list
- Recently Used/Referenced Memories
- Duplicate Alerts (memories with high similarity scores)
- Suggested Improvements (AI-generated tips to clarify or update old memories)

---

## Phase 5: AI Memory Review Engine

### Background Review
- A "Review Memories" button that triggers AI analysis of stored memories
- AI scores usefulness, detects outdated content, suggests merges for similar memories
- Results shown in the right panel with actionable suggestions (update, merge, delete)

---

## Phase 6: Polish & Demo Readiness

### Visual Polish
- Glassmorphism card effects with backdrop blur
- Gradient accents and glow effects on active elements
- Smooth Tailwind animations (fade-in, scale-in) on all interactions
- Loading skeletons and typing indicators during AI processing

### Demo Experience
- Pre-populated sample memories for instant demo
- Clean onboarding flow
- Fast, responsive interactions throughout

