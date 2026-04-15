# 🧠 AI OPERATING SYSTEM - PROQUELEC GOD MODE

## Architecture Blueprint v1.0

Date: 15 Apr 2026  
Status: Design Phase → Implementation  
Target: ChatGPT-like + Notion AI + Copilot + Terrain Assistant

---

## 📐 ARCHITECTURE GLOBALE

```
┌─────────────────────────────────────────────────────────────┐
│                   FRONTEND (React/Electron)                  │
│              POST /api/ai/query (backward compatible)         │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│           API GATEWAY + REQUEST ENRICHMENT                   │
│  authenticate → extract context → add user metadata          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              AI ROUTER V2 (DECISION ENGINE)                  │
│  ├─ Classify Intent + Emotion (faster)                       │
│  ├─ Check Vector Memory Cache (semantic search)              │
│  ├─ Cost optimization (local vs API)                         │
│  └─ Route to: Local → Cheap LLM → Smart LLM → Hybrid         │
└────────────────┬──────────────────────────────────┬──────────┘
                 │                                  │
        ┌────────▼─────┐               ┌────────────▼────┐
        │ LOCAL ENGINE  │               │  MEMORY LAYERS  │
        │ (MissionSage) │               │                 │
        └───────────────┘       ┌───────┼─────────────────┐
                                │       │                 │
                        ┌───────▼──┐ ┌──▼──────┐ ┌────────▼───┐
                        │ Short-   │ │ Mid-    │ │ Long-term  │
                        │ term     │ │ term    │ │ Semantic   │
                        │(session) │ │(DB)     │ │(pgVector)  │
                        └──────────┘ └─────────┘ └────────────┘
                                │
                        ┌───────▼──────────────┐
                        │  PROMPT ENGINE       │
                        │  - Versionné         │
                        │  - Dynamique         │
                        │  - Context-aware     │
                        │  - User-adapted      │
                        └─────────┬────────────┘
                                  │
                        ┌─────────▼────────────┐
                        │ MULTI-AGENT SYSTEM  │
                        │ ├─ Technical Agent  │
                        │ ├─ Support Agent    │
                        │ ├─ Data Agent       │
                        │ └─ Planning Agent   │
                        └─────────┬───────────┘
                                  │
                        ┌─────────▼──────────────┐
                        │  LLM SELECTION         │
                        │  ├─ GPT-4o-mini (+0$)  │
                        │  ├─ GPT-4 (+cost)      │
                        │  └─ Claude (+cost)     │
                        └─────────┬──────────────┘
                                  │
                        ┌─────────▼──────────────┐
                        │  RESPONSE QUALITY     │
                        │  VALIDATION LAYER     │
                        │  ├─ Coherence check   │
                        │  ├─ Tone correction   │
                        │  ├─ Auto-simplify     │
                        │  └─ Humanization      │
                        └─────────┬──────────────┘
                                  │
                        ┌─────────▼──────────────┐
                        │  OBSERVABILITY &      │
                        │  ANALYTICS            │
                        │  ├─ Cost tracking     │
                        │  ├─ Latency metrics   │
                        │  ├─ Quality scores    │
                        │  └─ Router traces     │
                        └─────────┬──────────────┘
                                  │
                                  ▼
                        ┌──────────────────────┐
                        │  HUMANIZED RESPONSE  │
                        │  TO FRONTEND         │
                        └──────────────────────┘
```

---

## 🎯 PHASES D'IMPLÉMENTATION

### Phase 1: Vector Memory Layer (Week 1-2)
- [ ] Setup pgvector PostgreSQL extension
- [ ] Create VectorMemory table
- [ ] Implement OpenAI embeddings pipeline
- [ ] Build semantic search engine
- [ ] Tests unitaires

**Cost**: Zero (pgvector is free)  
**Impact**: 70% des requêtes résolues sans API call

---

### Phase 2: Hybrid Memory System (Week 2-3)
- [ ] Refactor UserMemory → MemoryLayer (abstraction)
- [ ] Implement short-term cache (session)
- [ ] Implement mid-term storage (PostgreSQL)
- [ ] Implement long-term semantic (pgvector)
- [ ] Memory compression strategy

**Cost**: Minimal (only embeddings)  
**Impact**: Contexte utilisateur ultra-riche + persistent

---

### Phase 3: AI Router V2 (Week 3-4)
- [ ] Upgrade intent detection
- [ ] Add cost-aware routing logic
- [ ] Implement cache-first strategy
- [ ] Add request deduplication
- [ ] Router decision trace logging

**Cost Optimization**: 60-70% less API calls  
**Impact**: Smarter routing, cost reduction

---

### Phase 4: Dynamic Prompt Engine (Week 4-5)
- [ ] Create prompt registry (versioning)
- [ ] Build PromptBuilder class
- [ ] User role-based prompt adaptation
- [ ] Emotion-aware prompt injection
- [ ] Context compression

**Impact**: Better quality responses + easier A/B testing

---

### Phase 5: Response Quality Layer (Week 5)
- [ ] Implement response validator
- [ ] Add tone correction
- [ ] Auto-simplification logic
- [ ] Humanization control

**Impact**: Eliminate hallucinations + better UX

---

### Phase 6: Observability System (Week 6)
- [ ] Create AIMetrics table
- [ ] Implement cost tracker
- [ ] Build latency profiler
- [ ] Create quality scorer
- [ ] Dashboard endpoint

**Impact**: Full visibility into AI system performance

---

### Phase 7: Multi-Agent Framework (Week 7-8)
- [ ] Define agent base class
- [ ] Create TechnicalAgent
- [ ] Create SupportAgent
- [ ] Create DataAgent
- [ ] Create PlanningAgent
- [ ] Implement agent dispatcher

**Impact**: Specialized responses by domain

---

## 💾 DATABASE SCHEMA ADDITIONS

```prisma
// Vector Memory
model VectorMemory {
  id            String   @id @default(cuid())
  userId        String
  organizationId String
  
  content       String   // Original text
  embedding     Vector   // pgvector column
  intent        String?
  metadata      Json     // tags, source, etc
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  user          User     @relation(fields: [userId], references: [id])
  
  @@index([userId])
  @@index([embedding]) // pgvector index
}

// Analytics
model AIMetrics {
  id                String   @id @default(cuid())
  userId            String
  organizationId    String
  
  intent            String
  emotion           String
  routePath         String   // "local" | "vector_cache" | "gpt4o-mini" | "gpt4" | "claude"
  responseTime      Int      // ms
  tokenCount        Int
  cost              Decimal  // USD
  qualityScore      Float    // 0-100
  
  userSatisfied     Boolean? // optional feedback
  
  createdAt         DateTime @default(now())
  
  @@index([userId, createdAt])
  @@index([organizationId, createdAt])
}

// Prompt Registry
model PromptVersion {
  id              String   @id @default(cuid())
  
  name            String   // "proquelec_default"
  version         Int      // v1, v2, v3...
  systemPrompt    String
  userRoleAdapt   Json     // role-specific variations
  emotionAdapt    Json     // emotion-specific injects
  metadata        Json
  
  isActive        Boolean  @default(false)
  createdAt       DateTime @default(now())
  
  @@unique([name, version])
  @@index([isActive])
}
```

---

## 🚀 MIGRATION STRATEGY (NO BREAKING CHANGES)

1. **Initial**: Keep existing `/api/ai/query` working as-is
2. **Phase 1-2**: Add vector memory in background + routing still uses old system
3. **Phase 3**: Introduce AI Router V2 behind feature flag `AI_ROUTER_V2=true`
4. **Phase 4-5**: Plug in dynamic prompt engine + quality layer
5. **Phase 6**: Enable analytics for monitoring
6. **Phase 7**: Multi-agent system becomes optional upgrade

**Result**: Customers never see breaking changes.

---

## 💰 COST PROJECTION

**Before**: Every query hits OpenAI
- 5000 queries/month × $0.01 (gpt-4o-mini) = $50/month

**After Phase 1-3**:
- 70% local/vector (free)
- 20% gpt-4o-mini ($0.01) 
- 10% gpt-4 ($0.05)
- = (1000 × $0.01) + (500 × $0.05) = $35/month
- **Savings: 30%**

**After Phase 3 optimization + caching**:
- 75% local/cache
- 20% gpt-4o-mini
- 5% gpt-4
- = (1000 × $0.01) + (250 × $0.05) = $22.50/month
- **Savings: 55%**

---

## 🎯 SUCCESS METRICS

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Latency (ms) | < 500 | ~800 | TBD |
| Cache hit rate | > 60% | 0% | TBD |
| API cost/month | < $25 | $50 | TBD |
| Quality score | > 85% | TBD | TBD |
| User satisfaction | > 90% | TBD | TBD |

---

## ⚠️ RISKS & MITIGATIONS

| Risk | Mitigation |
|------|-----------|
| pgvector not compatible | Test immediately; fallback to Pinecone |
| Embedding quality poor | A/B test OpenAI embeddings vs Cohere |
| Memory explosion | Implement TTL + compression strategy |
| Router complexity | Clear decision tree + extensive logging |
| Quality layer misfire | Validation tests + human review staging |

---

## 📦 DELIVERABLES

✅ Final: Production-ready AI Operating System  
✅ Backward compatible with existing API  
✅ 55-70% cost reduction  
✅ ChatGPT-level user experience  
✅ Full observability  
✅ Multi-agent ready

---

## 🚀 START NEXT PHASE

→ Phase 1: Vector Memory Setup (pgvector integration)  
→ Create VectorMemory schema  
→ Implement embedding pipeline  
→ Build semantic search  
→ Wire into Router V2

