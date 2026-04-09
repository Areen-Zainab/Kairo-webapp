# AI Insights System - Complete Documentation

## Overview

The AI Insights system automatically generates comprehensive meeting insights using a multi-model architecture (primarily Mistral AI and Groq LLMs) after a meeting ends and the speaker-diarized transcript becomes available. The system analyzes the complete transcript and produces six types of insights that are stored in the database and displayed in the AI Insights Tab on the post-meeting details page.

## System Architecture

### Components

1. **AI Agents** (Python) - Located in `ai-layer/agents/`
   - Summary Agent
   - Decision Extraction Agent
   - Sentiment Analysis Agent
   - Topic Segmentation Agent
   - Action Item Agent
   - Participant Analysis Agent

2. **Utilities** (Python) - Located in `ai-layer/utils/`
   - Transcript Converter - Converts JSON transcripts to various rich-text formats with speaker/time contexts for agents.

3. **Orchestration Service** (Node.js) - `backend/src/services/AIInsightsService.js`
   - Coordinates multi-step, parallel agent execution.
   - Ensures agents execute strictly once per insight generation call to prevent redundant API permutations.
   - Passes execution contexts sequentially (e.g., from other agents directly to the Summary Agent).

4. **Integration Point** - `backend/src/services/TranscriptionService.js`
   - Triggers insights generation asynchronously after transcript finalization.

### Execution Flow Overview

1. **Transcription**: Audio streams are processed via **WhisperX** (faster-whisper backend, `model_size=small`, `device=CPU`, `compute_type=int8`).
2. **Analysis Trigger**: The backend confirms the transcript is saved and triggers parallel insight generation. 
3. **Agent Parallelism**: 
   - `run_all()` executes text-based agents (Decisions, Action Items, Topics, Sentiment) simultaneously.
   - *Participant Analysis* executes concurrently once the complete diarized JSON is parsed.
   - *Summary Agent* is executed **last**, receiving aggregated context outputs from all previous agents via the `AGENT_CONTEXT` environment variable. This contextual reuse boosts coherence, prevents contradicting insights, and guarantees the pipeline avoids running computationally duplicate steps.
4. **Data Save**: Insights are stored progressively directly into the database.

## AI Models & Selected Justifications

The system utilizes specialized models selected to balance response latency, maximum context capacity, and cost-efficiency.

- **Transcription Model: WhisperX (faster-whisper backend, small model, int8 compute)**
  - *Justification*: Maintains an acceptable Word Error Rate (WER) with a minimal footprint. Running on a CPU with int8 calculation deliberately avoids a strict GPU requirement. This fully aligns with self-hosting stability limits and keeps RAM/VRAM usage extremely low.

- **Summary Agent: Mistral AI (`mistral-small-latest`)**
  - *Justification*: Accessed directly via the official Mistral SDK (replacing deprecated Hugging Face endpoints) for uncompromising reliability. It is uniquely capable of delivering layered format permutations concurrently in a single prompt block (executive 2-3 sentence summaries, detailed narratives, and quick-scannable bullet points). Provides up to 32k tokens for broad context window retention.
  - *Primary LLM Fallback*: Groq `llama-3.3-70b-versatile`.

- **Decision Extraction, Topic Segmentation, Sentiment Analysis Agents: Groq (`llama-3.3-70b-versatile`)**
  - *Justification*: Delivers outstanding schema-stable JSON output and deep contextual reasoning. It reliably aggregates sentiment subtitles, recognizes impact constraints (High/Medium/Low), and operates proficiently across an extensive 128k token context edge. The Groq API executes at speeds significantly faster than frontier (GPT-4 class) models, handling latency constraints seamlessly via multi-key provider rotation.

- **Action Item Agent: Groq (`llama-3.1-8b-instant`)**
  - *Justification*: Action-item mapping is primarily a pattern-based constraint. An 8B parameter model drastically minimizes runtime latency and reduces token cost entirely, while retaining sufficient inferential capability to isolate personal assignments constraints and schedule dates.

- **Participant Analysis Agent: Groq (`llama-3.3-70b-versatile`)**
  - *Justification*: Analyzes multi-layered diarized JSON data. Takes heavily structured logs, recognizes speaker boundaries, and accurately assesses qualitative participant engagement.

## Reliability: Fallback Measures and NLP Techniques

To ensure the pipeline generates structured JSON output under any failure condition (such as severed API connectivity or revoked keys), the system enacts strict cascading fallback paths. A generated insight's `confidence` score is proportionally penalized (typically halved down to `~0.5`) to signal backend constraints and guarantee UI transparency that baseline metrics were generated algorithmically.

### Cascading Fallback Tiers
1. **Primary Large Language Model** (Mistral/Groq instances) 
2. **Secondary/Hosted LLM** (e.g., HF hosted inference, DistilBERT for sentiment checks)
3. **NLP Heuristics & Statistical Rules** (Zero-dependency fail-safes ensuring execution continuity)

### Applied NLP Fallbacks per Agent
- **Summary Agent:** *Extractive Summary Tokenization.* Abandons abstract generation and utilizes primitive sentence tokenization, stringing together the most statistically relevant sentence chunks to formulate a raw narrative highlight real.
- **Decision & Action Item Extraction:** *Pattern Matching Algorithms.* Falls back to evaluating pre-compiled, domain-specific cue phrases (e.g., "I will...", "We've decided...", "Is assigned to...") coupled with definitive deterministic lexicons to output constrained arrays.
- **Topic Segmentation:** *Structural Paragraph Splitting.* Abandons high-level conceptual groupings (TF-IDF mapping) in favor of identifying hard-topical boundaries, splitting paragraphs using natural transitional lexical heuristics.
- **Sentiment Analysis:** *Lexicon-Based Rulesets.* Implements high-speed dictionary checking (mapping raw negative/positive word coefficients against specific utterance timestamps) to formulate an overall zero-cost baseline continuity score.
- **Participant Analysis:** *Statistical Determinism.* Isolates the process entirely to verifiable JSON statistics, bypassing subjective "engagement" reads. Relies on calculating distinct speaking time metrics, verbatim utterance lengths, and frequency checks.

## Latency, Tokens, and Optimizations

Historically, sub-agents recursively triggered dependencies independently, unnecessarily escalating processing times to ~300s. 

Current adjustments force **single-run executions**, feeding pipeline architectures linearly while calling text-agents strictly asynchronously. Groq calls utilize restricted token caps (`max_tokens` set optimally between 1000-3000) yielding aggregate execution delays tightly bound between **30-120 seconds**, fully scaled relative to the transcript chunk dimensions. Large text bodies intelligently apply cross-overlap parsing frameworks. 

## Database Configuration

Structured insight formats are housed exclusively in the `ai_insights` table:

```sql
CREATE TABLE ai_insights (
    id VARCHAR(36) PRIMARY KEY,
    meeting_id VARCHAR(36) NOT NULL,
    insight_type ENUM('summary', 'action_items', 'decisions', 'topics', 'sentiment', 'other') NOT NULL,
    content TEXT NOT NULL,         -- JSON representations (arrays/objects) mapping standard structure
    confidence_score DECIMAL(3,2), -- Dynamic deterministic confidence scale
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
);
```

### Security Options
- Core provider keys (`GROQ_API_KEY`, `MISTRAL_API_KEY`, `GROK_API_KEY` variants for transitions) coordinate parsing parameters exclusively on the robust backend. 
- Diarized JSON payloads fall under stringent workspace access verifications to prevent path traversal leaks.

## Forward Migration Scope
- Shifting directly to the `faster-whisper` underlying module logic without an ffmpeg buffering component to realize a stable 3-second live processing window.
- Normalizing overarching multimodal confidences; weighting explicitly calculated ASR VAD logging metrics systematically alongside subsequent contextual LLM inference scores.
