
import { config } from 'dotenv';
config();

import '@/ai/flows/generate-tech-spec.ts';
import '@/ai/flows/generate-product-vision.ts';
import '@/ai/flows/analyze-document-flow.ts';
import '@/ai/flows/extract-document-events-flow.ts';
import '@/ai/flows/generate-architectural-sketches-flow.ts';
import '@/ai/flows/process-contract-flow.ts';
import '@/ai/flows/generate-credit-disposition-flow.ts';
import '@/ai/flows/generate-real-estate-advice-flow.ts';
import '@/ai/flows/generate-corporate-real-estate-advice-flow.ts';
import '@/ai/flows/generate-leasing-proposal-flow.ts';
import '@/ai/flows/generate-innovation-action-plan-flow.ts';
import '@/ai/flows/verify-ddu-flow.ts';
import '@/ai/flows/chat-with-document-flow.ts';
import '@/ai/flows/generate-backlog-from-brainstorm-flow.ts';
import '@/ai/flows/analyze-backlog-completeness-flow.ts';
import '@/ai/flows/generateTechSpecFromBacklogFlow';
import '@/ai/flows/analyze-news-feed-flow.ts'; // Added new flow
