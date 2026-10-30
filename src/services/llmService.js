/**
 * LLM Orchestrator Service for Aurra 2.0 Kiosk
 * Exact implementation ported from Aurra 1.0 (Groq Cloud API)
 * - Ultra-low latency inference via Groq (~300-500ms)
 * - Strict 35-word limit for concise speech synthesis
 * - Clean response text filter (strips markdown, asterisks, emojis, action tags)
 * - 4.5s AbortController timeout protection so tablet never hangs
 * - Network-aware (detects offline status and fails gracefully)
 */

import { logger } from './logger';
import { ragSearchService } from './ragSearchService';
import { getLiveKnowledgeBlock, getDefaultKnowledgeBlock, mergeKnowledgeIntoPrompt } from './facilityTourKnowledgeService';

export const DEFAULT_SYSTEM_PROMPT =
  `You are Aurra, an intelligent humanoid AI receptionist and companion robot created and developed by RoboMiracle Technologies, located in RS Puram, Coimbatore, Tamil Nadu, India.
Endless Innovation — A New Era of Intelligent Beings.
Company Contact: +91 63804 73177, +91 79071 08559, sales@robomiracle.com.

You speak directly to visitors, clients, and students at an autonomous kiosk. You possess complete, authoritative knowledge of Indian political leadership, your own technical specifications, robot lineup, public service applications, RoboMiracle background, and safety protocols:

CURRENT INDIAN POLITICAL LEADERSHIP & ALL STATE CHIEF MINISTERS:
- Current Prime Minister of India: Narendra Modi (Narendra Damodardas Modi).
- Chief Ministers of all 28 Indian States (MANDATORY DESIGNATED REFERENCE — ALWAYS USE THESE EXACT NAMES):
  1. Andhra Pradesh: N. Chandrababu Naidu
  2. Arunachal Pradesh: Pema Khandu
  3. Assam: Himanta Biswa Sarma
  4. Bihar: Samrat Choudhary
  5. Chhattisgarh: Vishnu Deo Sai
  6. Goa: Pramod Sawant
  7. Gujarat: Bhupendra Patel
  8. Haryana: Nayab Singh Saini
  9. Himachal Pradesh: Sukhvinder Singh Sukhu
  10. Jharkhand: Hemant Soren
  11. Karnataka: D. K. Shivakumar
  12. Kerala: V. D. Satheesan
  13. Madhya Pradesh: Mohan Yadav
  14. Maharashtra: Devendra Fadnavis
  15. Manipur: Yumnam Khemchand Singh
  16. Meghalaya: Conrad K. Sangma
  17. Mizoram: Lalduhoma
  18. Nagaland: Neiphiu Rio
  19. Odisha: Mohan Charan Majhi
  20. Punjab: Bhagwant Mann
  21. Rajasthan: Bhajan Lal Sharma
  22. Sikkim: Prem Singh Tamang
  23. Tamil Nadu: C. Joseph Vijay
  24. Telangana: A. Revanth Reddy
  25. Tripura: Manik Saha
  26. Uttar Pradesh: Yogi Adityanath
  27. Uttarakhand: Pushkar Singh Dhami
  28. West Bengal: Suvendu Adhikari
RULE FOR LEADERSHIP QUERIES:
- If asked who is the Prime Minister of India, ALWAYS state Narendra Modi.
- If asked who is the Chief Minister of any Indian State (e.g. Tamil Nadu, West Bengal, Karnataka, Uttar Pradesh, etc.), ALWAYS strictly answer using the exact Chief Minister named in the list above.

AURRA — TECHNICAL FEATURES, INTERACTION CAPABILITIES & PUBLIC APPLICATIONS:
1. What is AURRA: AURRA is an AI-integrated humanoid robot designed for human interaction, public assistance, entertainment, information delivery, announcements, guided tours, and customised robotic applications.
2. Basic Specifications: Height: 5 ft | Weight: 50 kg | Degrees of Freedom: 5 DOF | Technology: AI-integrated humanoid robotic platform.
3. How AURRA Interacts: Interacts with people through face recognition, voice commands, facial expressions, gestures, robot movements, a manual control interface, and customised interactive content.
4. Face Recognition: Can use face recognition to identify registered or known individuals and provide personalised greetings or responses.
5. Voice Commands: Supports voice-controlled interaction and movement, allowing users or operators to issue predefined voice commands.
6. Emotions & Facial Expressions: Can display emotional facial expressions such as happy, angry, love, greeting, attention, and other customised expressions.
7. Gestures & Social Actions: Performs approximately 10 programmed gestures and social actions: 1. Hi / Waving, 2. Bye / Waving, 3. Hand Shake, 4. Hug Interaction, 5. Walking Movement, 6. Greeting Gesture, 7. Attention / Welcome Gesture, 8. Agreement / Acknowledgement Gesture, 9. Kissing Gesture, 10. Custom Gesture Actions.
8. How AURRA is Controlled:
   - Manual Control: An operator can control AURRA's movements using an interactive control interface.
   - Voice Control: Selected movements and functions can be controlled using voice commands.
   - Interface Control: A centralized dashboard can manage movement, interaction, content, announcements, advertisements, and administrative functions.
9. Administrator Customisation: Supports customised administrative functions such as creating and inserting customised forms, updating interaction content, managing greetings, announcements and advertisements, updating visitor information, configuring responses and actions, and controlling the robot through an operator interface.
10. Public Facilities: Deployed as an interactive public-service robot for visitor reception, information assistance, announcements, tour guidance, event assistance, public interaction, and promotional activities.
11. Receptionist Role: Welcomes visitors, provides greetings, delivers information, answers predefined questions, and guides visitors to relevant departments or locations.
12. Announcements: Delivers scheduled or operator-triggered announcements for events, instructions, public information, alerts, and other customised messages.
13. Tour Guide: Provides guided information about facilities, departments, exhibits, important locations, events, and visitor information.
14. Advertising & Promotion: Used as an interactive advertising and promotional platform to display or communicate brand advertisements, product information, event promotions, promotional messages, and digital content.
15. Digital & Website Integration: Connects its information and interaction system with websites and other digital platforms depending on application requirements.
16. Deployment Locations: Schools & Educational Institutions, Colleges & Universities, Hospitals & Healthcare Facilities, Shopping Malls & Retail Spaces, Hotels & Hospitality, Airports & Railway Stations, Museums & Exhibition Centres, Corporate Offices & Reception Areas, Government & Public Service Facilities, Events & Trade Shows.
17. Difference from Conventional Robots: Combines humanoid movement, AI interaction, face recognition, voice control, gesture-based actions, expressive facial behaviour, manual control, and customised digital content within one interactive robotic platform.
18. Typical Interaction Flow: 1. Visitor approaches -> 2. AURRA recognizes or responds -> 3. AURRA provides facial greeting and/or voice response -> 4. Visitor interacts through voice or interface -> 5. AURRA performs requested movement, announcement, guidance, or information function -> 6. Administrators update forms, advertisements, announcements, and interaction settings through the control interface.
19. Main Applications: AI-based human interaction, visitor reception, face-based greeting, voice-controlled interaction, public announcements, tour guidance, information assistance, event support, advertising and promotion, educational interaction, digital and website integration, and customised public-service applications.
20. Overall Purpose: Designed to function as an AI-integrated humanoid interaction platform that can communicate with people, perform programmed movements and gestures, provide information, assist visitors, deliver announcements, support promotional activities, and offer customised public-facing robotic services.
21. Developer: Developed by RoboMiracle Technologies as an AI-integrated humanoid robotics platform combining robotics engineering, embedded systems, AI, software interfaces, mechanical development, and human-robot interaction.
22. Development Motivation: Developed to create a humanoid robotic platform capable of interacting naturally with people and performing practical applications in public, educational, commercial, institutional, and event environments.
23. Core Idea: Move beyond a conventional robot that only performs programmed movements and develop an interactive platform that can see, communicate, respond, move, express emotions, and provide customised services.
24. Engineering Disciplines Integrated: Mechanical & Structural Development, Robotic Motion & 5-DOF Control, Embedded Systems, AI Integration, Face Recognition, Voice Interaction, Facial Expression System, Gesture Programming, Manual Control Interface, Administrative Dashboard, Digital Content Integration.
25. Technologies Integrated: Robotics, artificial intelligence, embedded systems, computer vision, voice interaction, software interfaces, motion control, facial animation, and digital content management.
26. Movement Control: Controlled through a combination of programmed motion sequences, manual interface control, and voice-based commands.
27. AI System Integration: Integrated to support human interaction functions such as face recognition, voice-based interaction, personalised greetings, information assistance, and customised responses.
28. Person Recognition: Uses a face-recognition system to identify registered or known individuals and trigger customised greetings or interactions.
29. Communication Channels: Communicates through voice interaction, facial expressions, gestures, robot movements, visual interface, and customised responses.
30. Gesture Development: Programmed movement sequences for waving, greeting, hand shaking, hugging, kissing gestures, acknowledgement, attention gestures, and other customised actions.
31. Custom Gestures: Gesture system can be expanded with customised movement sequences based on requirements of a particular application, event, organization, or facility.
32. Emotional Expressions: Programmed facial animations and expression sequences representing emotions such as happy, angry, love, greeting, and attention.
33. Customisable Personality: Configured with customised greetings, responses, announcements, interaction flows, advertisements, visitor information, and application-specific content.
34. Software Platform Role: Acts as the control and interaction layer managing robot movement, voice interaction, facial expressions, greetings, content, announcements, advertisements, and administrative functions.
35. Remote Control: Operates through an interface that allows authorised operators to control selected robot functions, update content, manage interactions, and trigger specific actions.
36. Integration with Systems: Connects with websites, digital information systems, customised forms, content platforms, and other software systems.
37. Customisation for Organisations: Interaction content, greetings, advertisements, announcements, information, gestures, and application workflows can be customised according to the requirements of different organisations.
38. Application Orientation: Not only a demonstration robot; designed as an application-oriented robotic platform adapted for reception, public assistance, announcements, tour guidance, events, advertising, information services, and interactive experiences.
39. Platform Identity: Brings together RoboMiracle's capabilities in robotics, AI, embedded systems, software development, human-robot interaction, and educational and application-oriented robotics into a single humanoid platform.
40. Future Scope: Future development will expand capabilities in AI-based conversations, personalised interaction, advanced facial expressions, additional gestures, multilingual interaction, digital integrations, autonomous service workflows, and customised applications.
41. RoboMiracle's Vision: Develop a human-friendly humanoid robotic platform that moves from demonstration and entertainment into practical service, information, interaction, education, commercial, and public-facility applications.
42. RoboMiracle in Relation to AURRA: RoboMiracle Technologies is the organisation behind the development and integration of AURRA.

ABOUT ROBOMIRACLE TECHNOLOGIES:
- What is RoboMiracle: RoboMiracle is a robotics and technology company focused on AI, robotics, embedded systems, automation, and technology education.
- What RoboMiracle Does: Develops robotics and AI solutions, conducts technology training programs, and works on innovative robotic systems and educational technologies.
- Location: Based in RS Puram, Coimbatore, Tamil Nadu, India.
- Main Technology Areas: Artificial Intelligence, Robotics, Embedded Systems, Automation, IoT, 3D Printing, and technology education.
- Robotics Education: Provides robotics, AI, coding, embedded systems, and technology-learning programs for students and institutions.
- Target Audience: Works with school students, college students, engineering students, interns, and institutions interested in robotics and emerging technologies.
- Robot Development: Works on research, development, assembly, testing, and integration of robotic systems.
- Approach: Combines hardware, embedded systems, software, and AI to create practical real-world robotic applications.

AURRA SAFETY & HANDLING:
- Safety: Designed for controlled human interaction, but users should follow RoboMiracle's operating and safety instructions during interaction.
- Authorised Operators: AURRA should be operated by trained or authorized personnel, especially during technical operation, movement, or maintenance.
- Children Interaction: Children can interact during supervised demonstrations and educational activities with a trained adult or staff member supervising.
- Moving Parts: People should avoid touching moving joints or mechanical parts while operating unless specifically instructed by trained personnel.
- Manual Joint Movement: Do not manually force or move joints while powered or operating. Joints must be handled according to RoboMiracle's approved procedure.
- Unexpected Behaviour: Maintain a safe distance and stop operation using the approved emergency-stop or shutdown procedure. A trained RoboMiracle team member should inspect.
- Repairs: Only inspected, repaired, or modified by authorized RoboMiracle technical personnel.
- Electronics: Users should NOT open electronic or mechanical systems. Maintenance must be performed only by authorized technical personnel.
- Pre-Operation Check: The operator should check the power system, physical connections, operating area, mechanical condition, and communication systems before operation.
- Emergency Procedure: Stop operation immediately using the approved emergency procedure, keep people away from moving parts, and contact responsible RoboMiracle technical personnel.

HARDWARE SPECIFICATIONS:
- Display: Waveshare 12-inch 1920x1080 Full HD Capacitive Touch Display.
- Battery & Power: High-capacity 25.9V / 31.5Ah Lithium-ion battery for extended endurance runtime; 29.4V / 5A dedicated charger; real-time battery voltage & percentage monitoring.
- Control Modes: Dual-mode control with 2.4 GHz RC Remote and Wi-Fi Mobile App / Web Admin Panel, with physical toggle switch between Wi-Fi and Remote modes.
- Sensors & Obstacle Avoidance: Ultrasonic distance sensors measuring nearby objects for fast, accurate obstacle detection and collision avoidance.
- Vision & Web Camera: Crystal Pro Web Camera with USB powered, 3P Lens, Night Vision, and built-in microphone for seamless vision and face recognition in any lighting condition.
- Audio & Loudspeaker: Fielect 8 Ohm 20W External Magnet Loudspeaker (78mm diameter) delivering crisp telephonic and speech audio.
- Mobility & Motors: 5 DOF (Degrees of Freedom) motors offering five-axis mobility for smooth, human-like motion; 100 mm heavy-duty caster wheels for smooth, stable robot movement.
- Thermal Cooling: Active air ventilation circulation system for consistent fresh air flow and internal component cooling.
- Power Button: Physical push button to turn the robot on and off.

GUIDED ROBOT TOUR SHOWCASE:
• Aurra (Flagship Humanoid Receptionist): Advanced receptionist robot with 12" Full HD touchscreen, multilingual voice AI, autonomous obstacle avoidance, and interactive guest registration.
• Nexus (Industrial Service Platform): Heavy-duty humanoid engineered for industrial security patrol, LiDAR mapping, and dual-arm manipulation.
• Nova (Interactive Educational Guide): Friendly service humanoid with expressive LED eyes and robotic arm gestures for showrooms and museums.
• Dine (Hospitality & Dining Robot): Autonomous food and beverage server with tiered trays for restaurants and cafeterias.
• GI (Industrial Inspection Rover): Rugged autonomous patrol and facility surveillance rover.

CAMPUS ROOM DIRECTORY & PUBLIC FACILITIES:
[Ground Floor]:
• [RD-01] Dedicated R&D and Engineering Workspace (East Wing) - Research, robotics innovation, engineering design, and AI technologies.
• [HW-02] Hardware and Electronics Development Lab (East Wing) - Electronic circuits, sensors, controllers, and robotic hardware components.
• [PR-04] 3D Printing and Prototyping Facilities (East Wing) - Rapid prototyping, 3D printing custom robotic parts & enclosures.
• [TB-05] Robotics Testing and Demonstration Area (Central Atrium) - 10m in front of kiosk, live robot navigation and demo arena.
• [MC-07] Meeting and Collaboration Spaces (North Wing) - Team discussions, client meetings, brainstorming sessions.
• [OA-09] Employee Workspace and Basic Office Amenities (West Wing) - Pantry, purified water, washrooms, and ergonomic work pods.
[First Floor (Level 1)]:
• [SW-03] Software Development and Testing Facilities (Central Core) - Advanced robotics software, AI algorithms, and automation solutions.
• [TR-06] Training and Workshop Facilities (West Wing) - Robotics workshops, technical training, hands-on learning sessions.
[Second Floor (Level 2)]:
• [IT-08] High-Speed Internet and IT Infrastructure (Central Core) - Gigabit fiber, server infrastructure, climate-controlled racks.

CONVERSATIONAL RULES:
- When asked your name, ALWAYS say "I am Aurra."
- When asked who created you or where you are from, ALWAYS say "I was created and developed by RoboMiracle Technologies in RS Puram, Coimbatore."
- When asked about the Prime Minister of India, ALWAYS state Narendra Modi.
- When asked about the Chief Minister of any Indian State, ALWAYS strictly state the exact designated Chief Minister from the list above.
- When asked about your specifications, features, safety, handling, or RoboMiracle, provide accurate answers from your knowledge base above.
- When asked for room directions or facilities, provide the floor, room code, wing, and concise walking directions.
- When asked about guided tours or robot lineup, explain the roles of Aurra, Nexus, Nova, Dine, or GI accurately.
- Always respond in the exact same language as the user input (English, Tamil, Tanglish, Hindi, Malayalam, etc.).
- Keep responses conversational, concise, and clear (around 20-35 words) so they can be spoken smoothly via speech synthesis.
- Do NOT use markdown asterisks, emojis, bracketed action tags, or bullet points in your speech answers.`;

const STORAGE_KEY = 'aurra_llm_config_v6';

export const DEFAULT_GROQ_API_KEY = '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';
export const DEFAULT_OLLAMA_API_KEY = '160def7c98d44d4d80f21170c807fd7f.a_xwhlvPEyPS9z0EyFXcvTUN';
export const DEFAULT_OLLAMA_BACKUP_KEY = 'a28d5cabe3b34a8fb8b176a4401d13d3.laxGuQpgO_7jSM7vG94hrzRC';
export const DEFAULT_BACKUP_LLM_KEY = DEFAULT_OLLAMA_BACKUP_KEY;
export const DEFAULT_GEMINI_API_KEY = 'AQ.Ab8RN6IVrEIKjCLjNw6QjOtaIlmnH4RsvHtMn_6Ay6Tp39LxNw';

export const getDefaultLlmConfig = () => ({
  enabled: true,
  provider: 'ollama', // 'ollama' | 'groq' | 'gemini'
  apiUrl: 'https://ollama.com/v1',
  apiKey: import.meta.env.VITE_LLM_API_KEY || DEFAULT_OLLAMA_API_KEY,
  backupApiKey: DEFAULT_OLLAMA_BACKUP_KEY,
  model: 'gemma4:31b',
  ollamaApiKey: DEFAULT_OLLAMA_API_KEY,
  ollamaBackupApiKey: DEFAULT_OLLAMA_BACKUP_KEY,
  ollamaModel: 'gemma4:31b',
  ollamaApiUrl: 'https://ollama.com/v1',
  geminiApiKey: DEFAULT_GEMINI_API_KEY,
  geminiModel: 'gemini-1.5-flash',
  geminiApiUrl: 'https://generativelanguage.googleapis.com/v1beta',
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  temperature: 0.6,
  maxTokens: 300,
  timeoutMs: 12000,
});

class LlmService {
  constructor() {
    this.config = this.loadConfig();
  }

  loadConfig() {
    const defaults = getDefaultLlmConfig();
    try {
      const raw =
        localStorage.getItem(STORAGE_KEY) ||
        localStorage.getItem('aurra_llm_config_v3') ||
        localStorage.getItem('aurra_llm_config_v2');
      if (raw) {
        const parsed = JSON.parse(raw);
        const merged = { ...defaults, ...parsed };
        merged.enabled = true;
        if (!merged.apiKey || !merged.apiKey.trim()) {
          merged.apiKey = defaults.apiKey;
        }
        if (!merged.backupApiKey || !merged.backupApiKey.trim() || merged.backupApiKey === DEFAULT_OLLAMA_API_KEY) {
          merged.backupApiKey = DEFAULT_OLLAMA_BACKUP_KEY;
        }
        if (!merged.geminiApiKey || !merged.geminiApiKey.trim()) {
          merged.geminiApiKey = defaults.geminiApiKey;
        }
        if (!merged.provider) {
          merged.provider = 'ollama';
        }
        // Auto-heal expired Groq key and non-functional defaults
        if (
          !merged.apiKey ||
          merged.apiKey === DEFAULT_GROQ_API_KEY ||
          merged.apiKey.startsWith('gsk_Tly') ||
          (merged.apiUrl && merged.apiUrl.includes('api.groq.com') && (!merged.apiKey || merged.apiKey.startsWith('gsk_')))
        ) {
          merged.provider = 'ollama';
          merged.apiKey = DEFAULT_OLLAMA_API_KEY;
          merged.apiUrl = 'https://ollama.com/v1';
          merged.model = 'gemma4:31b';
        }
        if (merged.provider === 'ollama') {
          if (!merged.model || merged.model.includes('qwen') || merged.model.includes('llama')) {
            merged.model = 'gemma4:31b';
          }
        } else if (!merged.model || merged.model.includes('llama-3.3-70b')) {
          merged.model = 'qwen/qwen3.8-27b';
        }
        if (!merged.geminiModel) {
          merged.geminiModel = defaults.geminiModel;
        }
        if (!merged.maxTokens || merged.maxTokens < 200) {
          merged.maxTokens = 300;
        }
        if (!merged.timeoutMs || merged.timeoutMs < 10000) {
          merged.timeoutMs = 12000;
        }
        // Upgrade system prompt if it lacks Coimbatore / Chief Ministers / C. Joseph Vijay / Narendra Modi
        if (
          !merged.systemPrompt ||
          merged.systemPrompt.length < 500 ||
          !merged.systemPrompt.includes('Coimbatore') ||
          !merged.systemPrompt.includes('C. Joseph Vijay') ||
          !merged.systemPrompt.includes('Narendra Modi') ||
          !merged.systemPrompt.includes('CURRENT INDIAN POLITICAL LEADERSHIP')
        ) {
          merged.systemPrompt = defaults.systemPrompt;
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          } catch {}
        } else if (!merged.systemPrompt.includes('CAMPUS ROOM DIRECTORY') && !merged.systemPrompt.includes('G-01')) {
          merged.systemPrompt = mergeKnowledgeIntoPrompt(merged.systemPrompt, getDefaultKnowledgeBlock());
        }
        return merged;
      }
    } catch (e) {
      console.warn('Failed loading LLM config from storage:', e);
    }
    return defaults;
  }

  saveConfig(newConfig) {
    const updatedPrompt =
      newConfig.systemPrompt === undefined
        ? (this.config.systemPrompt || DEFAULT_SYSTEM_PROMPT)
        : newConfig.systemPrompt;
    this.config = { ...this.config, ...newConfig, systemPrompt: updatedPrompt };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
    } catch (e) {
      console.warn('Failed saving LLM config to storage:', e);
    }
    return this.config;
  }

  getConfig() {
    return { ...this.config };
  }

  isConfigured() {
    if (this.config.provider === 'gemini') {
      return Boolean((this.config.geminiApiKey || DEFAULT_GEMINI_API_KEY).trim());
    }
    const key = (this.config.apiKey || DEFAULT_OLLAMA_API_KEY).trim();
    return Boolean(key);
  }

  /**
   * Cleans raw LLM response text for speech synthesis:
   * - Strips thinking tags, HTML, markdown, emojis, asterisks, brackets
   * - Enforces 35-40 word limit
   */
  cleanResponseText(text) {
    if (!text) return '';
    let cleaned = text;

    // Remove thinking tags (e.g. from DeepSeek / Qwen)
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '');
    cleaned = cleaned.replace(/<\|.*?\|>/g, '');
    cleaned = cleaned.replace(/<[^>]*>/g, '');
    cleaned = cleaned.replace(/\[[^\]]*\]/g, '');
    cleaned = cleaned.replace(/\((smiles|nods|chuckles|laughs|pauses|whispers|action|gestures|sighs|giggles|waves|bows|winks)\)/gi, '');
    cleaned = cleaned.replace(/[\(\)]/g, '');
    cleaned = cleaned.replace(/^#+\s+/gm, '');
    cleaned = cleaned.replace(/[\*_]{1,2}/g, '');
    cleaned = cleaned.replace(/`{1,3}/g, '');
    cleaned = cleaned.replace(/^[\s\-\*\+\u2022]\s+/gm, '');
    cleaned = cleaned.replace(/^\d+\.\s+/gm, '');
    
    // Remove emojis & special pictographs
    cleaned = cleaned.replace(
      /[\u{1F000}-\u{1FAFF}]|[\u{2600}-\u{27BF}]|[\u{1F1E0}-\u{1F1FF}]/gu,
      ''
    );

    cleaned = cleaned.replace(/^(assistant|user|system):\s*/i, '');
    cleaned = cleaned.replace(/^the user (asks|is asking)[:\s]*"[^"]*"\s*/gi, '');
    cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\n{2,}/g, ' ').trim();

    // Safeguard: Override third-party creator claims
    if (/\b(qrok|groq|grok|qrk|openai|meta|llama)\b/i.test(cleaned) && /\b(developed|created|built|made|designed)\b/i.test(cleaned)) {
      cleaned = 'I am Aurra, an autonomous AI receptionist created and developed by Robomiracle Technologies.';
    }

    // Enforce word limit (35-40 words max for quick spoken response)
    const words = cleaned.split(/\s+/).filter(Boolean);
    if (words.length > 38) {
      const sliced = words.slice(0, 38).join(' ');
      const lastPunc = Math.max(sliced.lastIndexOf('.'), sliced.lastIndexOf('?'), sliced.lastIndexOf('!'));
      if (lastPunc > 40) {
        cleaned = sliced.slice(0, lastPunc + 1);
      } else {
        cleaned = sliced + '.';
      }
    }

    return cleaned.trim();
  }

  /**
   * Generates a conversational response using Groq Cloud API
   * Non-blocking, aborts on timeout, fails gracefully
   */
  async generateResponse(userQuery, conversationHistory = []) {
    if (!this.config.enabled) {
      return { success: false, reason: 'DISABLED' };
    }

    // 1. Fast Zero-Latency System Clock Intent (0ms)
    if (ragSearchService.isTimeOrDateQuery(userQuery)) {
      const timeData = ragSearchService.getLocalTimeAndDate();
      logger.speech('LLM', `[Clock Intent Match] "${timeData.formattedSpeech}"`);
      return {
        success: true,
        text: timeData.formattedSpeech,
        latencyMs: 1,
        model: 'Local Clock Engine',
        provider: 'System Real-Time Clock',
        tokens: null,
      };
    }

    // 2. Real-Time RAG Context Retrieval (strictly non-blocking & guarded)
    let liveRAG = null;
    try {
      liveRAG = await ragSearchService.fetchLiveContext(userQuery, conversationHistory);
      if (liveRAG?.context) {
        logger.info('RAG', `Retrieved live context via [${liveRAG.source}]: ${liveRAG.summary || liveRAG.context.slice(0, 70)}...`);
      }
    } catch (ragErr) {
      logger.warn('RAG', `Context retrieval error: ${ragErr.message}`);
    }

    const timeInfo = ragSearchService.getLocalTimeAndDate();
    let dynamicSystemPrompt = this.config.systemPrompt || DEFAULT_SYSTEM_PROMPT;

    // Fast in-memory check (<0.05ms): If custom system prompt doesn't already have directory, inject live cache
    if (!dynamicSystemPrompt.includes('CAMPUS ROOM DIRECTORY') && !dynamicSystemPrompt.includes('G-01')) {
      try {
        const liveKnowledge = await getLiveKnowledgeBlock();
        if (liveKnowledge) {
          dynamicSystemPrompt += `\n\n[LIVE CAMPUS & TOUR KNOWLEDGE]:\n${liveKnowledge}`;
        }
      } catch (kErr) {
        logger.warn('LLM', `Failed appending live knowledge block: ${kErr.message}`);
      }
    }

    dynamicSystemPrompt += `\n\n[REAL-TIME LOCAL TELEMETRY]: Today is ${timeInfo.dateStr}, current time is ${timeInfo.timeStr} in Coimbatore, Tamil Nadu, India.`;

    if (liveRAG?.context) {
      dynamicSystemPrompt += `\n\n${liveRAG.context}\nCRITICAL INSTRUCTION: Use the above live ground-truth data to answer the user's question directly, accurately, and concisely.`;
    }

    const isGemini = this.config.provider === 'gemini';
    const startTime = Date.now();

    // ── 3A. GOOGLE GEMINI PROVIDER DISPATCH ──
    if (isGemini) {
      const gKey = (this.config.geminiApiKey || DEFAULT_GEMINI_API_KEY).trim();
      if (!gKey) {
        logger.warn('LLM', 'No Gemini API key configured.');
        clearTimeout(timeoutId);
        return { success: false, reason: 'NO_KEY', error: 'No Gemini API Key provided.' };
      }

      const gModel = this.config.geminiModel || 'gemini-1.5-flash';
      const cleanModel = gModel.replace(/^models\//, '');
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${gKey}`;

      const geminiBody = {
        system_instruction: {
          parts: [{ text: dynamicSystemPrompt }]
        },
        contents: [
          ...(conversationHistory || []).slice(-4).map((h) => ({
            role: h.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: h.text || h.content || '' }]
          })),
          {
            role: 'user',
            parts: [{ text: userQuery }]
          }
        ],
        generationConfig: {
          temperature: this.config.temperature || 0.6,
          maxOutputTokens: this.config.maxTokens || 300,
        }
      };

      const geminiController = new AbortController();
      const geminiTimeoutId = setTimeout(() => geminiController.abort(), this.config.timeoutMs || 12000);

      try {
        logger.speech('LLM', `Calling Google Gemini (${cleanModel}) for: "${userQuery}"`);

        const response = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(geminiBody),
          signal: geminiController.signal,
        });

        clearTimeout(geminiTimeoutId);

        const data = await response.json();
        if (!response.ok || data.error) {
          const errMsg = data.error?.message || `HTTP ${response.status}`;
          throw new Error(`Gemini API Error: ${errMsg}`);
        }

        const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const cleaned = this.cleanResponseText(candidateText);
        const latency = Date.now() - startTime;

        if (!cleaned) {
          throw new Error('Empty response received from Gemini endpoint.');
        }

        logger.info('LLM', `Gemini response received in ${latency}ms: "${cleaned}"`);
        return {
          success: true,
          text: cleaned,
          latencyMs: latency,
          model: `Gemini (${cleanModel})`,
          provider: liveRAG ? `Gemini + ${liveRAG.source.toUpperCase()} RAG` : 'Google Gemini AI',
          tokens: data.usageMetadata?.totalTokenCount || null,
          ragDetails: liveRAG,
        };
      } catch (err) {
        clearTimeout(timeoutId);
        const latency = Date.now() - startTime;
        const isAbort = err.name === 'AbortError';

        logger.error('LLM', `Gemini call failed: ${err.message}`);
        return {
          success: false,
          reason: isAbort ? 'TIMEOUT' : 'ERROR',
          error: err.message,
          latencyMs: latency,
        };
      }
    }

    // ── 3B. RESILIENT MULTI-KEY & MULTI-MODEL LLM CASCADE (OLLAMA & GROQ) ──
    const isOllama = this.config.provider === 'ollama';

    // Candidate API Keys: Primary Key -> Configured Backup Key -> Hardcoded Active Keys
    const candidateKeys = Array.from(new Set([
      (this.config.apiKey || '').trim(),
      (this.config.backupApiKey || '').trim(),
      DEFAULT_OLLAMA_API_KEY,
      DEFAULT_OLLAMA_BACKUP_KEY,
      isOllama ? null : DEFAULT_GROQ_API_KEY,
    ])).filter((k) => k && k.length > 10);

    // Candidate Models: Active Model -> Auto-Failover Models (Gemma 31B -> GPT-OSS 20B -> Gemma Cloud)
    const candidateModels = isOllama
      ? Array.from(new Set([
          this.config.model,
          'gemma4:31b',
          'gpt-oss:20b',
          'gemma4:31b-cloud',
        ])).filter((m) => m && !m.includes('qwen') && !m.includes('llama'))
      : Array.from(new Set([
          this.config.model,
          'llama-3.3-70b-versatile',
          'llama-3.1-8b-instant',
          'gemma4:31b',
          'gpt-oss:20b',
        ])).filter(Boolean);

    const messages = [
      { role: 'system', content: dynamicSystemPrompt },
      ...(conversationHistory || []).slice(-4),
      { role: 'user', content: userQuery },
    ];

    let lastError = null;

    // Outer loop: Try candidate API keys (Failover on 401/403/429)
    for (let kIdx = 0; kIdx < candidateKeys.length; kIdx++) {
      const activeKey = candidateKeys[kIdx];
      const isOllamaKey =
        activeKey === DEFAULT_OLLAMA_API_KEY ||
        activeKey === DEFAULT_OLLAMA_BACKUP_KEY ||
        activeKey.startsWith('160def7c') ||
        activeKey.startsWith('a28d5cab');

      // Inner loop: Try candidate models (Failover on 400/404/402/500/timeout)
      for (let mIdx = 0; mIdx < candidateModels.length; mIdx++) {
        const activeModel = candidateModels[mIdx];
        const isOllamaModel = activeModel.includes('gemma') || activeModel.includes('gpt-oss');

        const effectiveUrl = (isOllamaKey || isOllamaModel)
          ? 'https://ollama.com/v1/chat/completions'
          : (this.config.apiUrl || 'https://api.groq.com/openai/v1').trim().replace(/\/+$/, '').endsWith('/chat/completions')
            ? (this.config.apiUrl || 'https://api.groq.com/openai/v1').trim().replace(/\/+$/, '')
            : `${(this.config.apiUrl || 'https://api.groq.com/openai/v1').trim().replace(/\/+$/, '')}/chat/completions`;

        const requestBody = {
          model: activeModel,
          messages,
          temperature: this.config.temperature || 0.6,
          max_tokens: this.config.maxTokens || 300,
        };

        const attemptController = new AbortController();
        const attemptTimeout = setTimeout(() => attemptController.abort(), 8500);

        try {
          const providerTag = isOllamaKey || isOllamaModel ? 'Ollama Cloud' : 'Groq';
          logger.speech('LLM', `Calling ${providerTag} [${activeModel}, Key #${kIdx + 1}] for: "${userQuery}"`);

          const response = await fetch(effectiveUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${activeKey}`,
            },
            body: JSON.stringify(requestBody),
            signal: attemptController.signal,
          });

          clearTimeout(attemptTimeout);

          if (!response.ok) {
            const errText = await response.text();
            logger.warn('LLM', `Attempt failed (Model: ${activeModel}, Key #${kIdx + 1}, HTTP ${response.status}): ${errText.slice(0, 90)}`);
            lastError = new Error(`HTTP ${response.status}: ${errText.slice(0, 90)}`);

            // If Auth or Rate-limit error (401, 403, 429), break model loop immediately to try the next API key
            if (response.status === 401 || response.status === 403 || response.status === 429) {
              break;
            }
            // If Model-specific error (404, 402, 400), try the next model with the same key
            continue;
          }

          const data = await response.json();
          const msgObj = data.choices?.[0]?.message;
          const rawText = msgObj?.content || msgObj?.reasoning || msgObj?.reasoning_content || '';
          const cleaned = this.cleanResponseText(rawText);
          const latency = Date.now() - startTime;

          if (!cleaned) {
            logger.warn('LLM', `Empty response from ${activeModel}, trying next model...`);
            continue;
          }

          logger.info('LLM', `Response succeeded via ${activeModel} (Key #${kIdx + 1}) in ${latency}ms: "${cleaned}"`);
          return {
            success: true,
            text: cleaned,
            latencyMs: latency,
            model: activeModel,
            provider: liveRAG
              ? `${providerTag} (${activeModel}) + ${liveRAG.source.toUpperCase()} RAG`
              : `${providerTag} (${activeModel})`,
            tokens: data.usage?.total_tokens || null,
            ragDetails: liveRAG,
          };
        } catch (attemptErr) {
          clearTimeout(attemptTimeout);
          logger.warn('LLM', `Attempt error (${activeModel}, Key #${kIdx + 1}): ${attemptErr.message}`);
          lastError = attemptErr;
        }
      }
    }

    const latency = Date.now() - startTime;
    const isAbort = lastError?.name === 'AbortError';
    logger.error('LLM', `All cascade LLM attempts failed: ${lastError?.message}`);

    const fallbackText = isAbort
      ? "I am experiencing a brief cloud latency delay. How else can I assist you with RoboMiracle facilities or robot features?"
      : "I am having trouble reaching the AI cloud service right now. Please feel free to ask about our facilities, services, or tours.";

    return {
      success: false,
      reason: isAbort ? 'TIMEOUT' : 'ERROR',
      text: fallbackText,
      error: lastError?.message || 'All LLM endpoints and models exhausted.',
      latencyMs: latency,
    };
  }

  /**
   * Generates a context-grounded answer for an uploaded PDF document
   * Combines retrieved PDF page chunks with Groq/Gemini LLM inference.
   */
  async generatePdfAnswer(userQuery, documentTitleOrChunks, maybeChunks = [], maybeHistory = []) {
    if (!this.config.enabled) {
      return { success: false, reason: 'DISABLED' };
    }

    let documentTitle = 'Uploaded Document';
    let relevantChunks = [];
    let conversationHistory = [];

    if (Array.isArray(documentTitleOrChunks)) {
      relevantChunks = documentTitleOrChunks;
      conversationHistory = Array.isArray(maybeChunks) ? maybeChunks : [];
    } else {
      documentTitle = documentTitleOrChunks || 'Uploaded Document';
      relevantChunks = Array.isArray(maybeChunks) ? maybeChunks : [];
      conversationHistory = Array.isArray(maybeHistory) ? maybeHistory : [];
    }

    const docContext = (relevantChunks || [])
      .map((c) => `[Page ${c.pageNumber}]: ${c.text}`)
      .join('\n\n');

    const pdfSystemPrompt =
      `You are Aurra, an intelligent AI humanoid assistant analyzing the document: "${documentTitle || 'Uploaded Document'}".
CRITICAL INSTRUCTIONS:
1. Answer the user's question accurately and objectively using ONLY the provided document excerpts below.
2. Cite the exact page number(s) where information was found, formatted like [Page X].
3. Keep answers concise, clear, and direct (between 25 and 65 words) so they can be spoken smoothly.
4. If the question cannot be answered from the provided excerpts, say: "I couldn't find that specific detail in the uploaded document." Do not fabricate facts.
5. Do not use asterisks or markdown styling.

DOCUMENT EXCERPTS:
${docContext || 'No document excerpts available.'}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), (this.config.timeoutMs || 8000) + 2000);
    const startTime = Date.now();
    const isGemini = this.config.provider === 'gemini';

    // 1. Google Gemini PDF Inference
    if (isGemini) {
      const gKey = (this.config.geminiApiKey || DEFAULT_GEMINI_API_KEY).trim();
      const gModel = (this.config.geminiModel || 'gemini-1.5-flash').replace(/^models\//, '');
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${gModel}:generateContent?key=${gKey}`;

      const geminiBody = {
        system_instruction: {
          parts: [{ text: pdfSystemPrompt }],
        },
        contents: [
          ...(conversationHistory || []).slice(-4).map((h) => ({
            role: h.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: h.text || h.content || '' }],
          })),
          {
            role: 'user',
            parts: [{ text: userQuery }],
          },
        ],
        generationConfig: {
          temperature: 0.3, // Lower temperature for high factual accuracy
          maxOutputTokens: 350,
        },
      };

      try {
        const response = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(geminiBody),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const data = await response.json();
        if (!response.ok || data.error) {
          throw new Error(data.error?.message || `HTTP ${response.status}`);
        }

        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const cleaned = this.cleanPdfResponse(rawText);
        const latency = Date.now() - startTime;

        return {
          success: true,
          text: cleaned,
          latencyMs: latency,
          model: gModel,
          provider: 'Gemini Document AI',
          citations: this.extractCitations(cleaned, relevantChunks),
        };
      } catch (err) {
        clearTimeout(timeoutId);
        logger.warn('LLM', `Gemini PDF answer failed: ${err.message}. Trying Groq fallback.`);
      }
    }

    // 2. Resilient Multi-Key & Multi-Model PDF Inference
    const candidatePdfKeys = Array.from(new Set([
      (this.config.apiKey || '').trim(),
      (this.config.backupApiKey || '').trim(),
      DEFAULT_OLLAMA_API_KEY,
      DEFAULT_OLLAMA_BACKUP_KEY,
    ])).filter((k) => k && k.length > 10);

    const candidatePdfModels = ['gemma4:31b', 'gpt-oss:20b', 'gemma4:31b-cloud'];

    for (let kIdx = 0; kIdx < candidatePdfKeys.length; kIdx++) {
      const activeKey = candidatePdfKeys[kIdx];
      for (let mIdx = 0; mIdx < candidatePdfModels.length; mIdx++) {
        const activeModel = candidatePdfModels[mIdx];
        const pdfController = new AbortController();
        const pdfTimeout = setTimeout(() => pdfController.abort(), 8000);

        try {
          const body = {
            model: activeModel,
            messages: [
              { role: 'system', content: pdfSystemPrompt },
              ...(conversationHistory || []).slice(-4).map((h) => ({
                role: h.role === 'assistant' ? 'assistant' : 'user',
                content: h.text || h.content || '',
              })),
              { role: 'user', content: userQuery },
            ],
            temperature: 0.3,
            max_tokens: 350,
          };

          const response = await fetch('https://ollama.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${activeKey}`,
            },
            body: JSON.stringify(body),
            signal: pdfController.signal,
          });

          clearTimeout(pdfTimeout);

          if (!response.ok) {
            if (response.status === 401 || response.status === 403 || response.status === 429) {
              break;
            }
            continue;
          }

          const data = await response.json();
          const rawText = data.choices?.[0]?.message?.content || '';
          const cleaned = this.cleanPdfResponse(rawText);
          const latency = Date.now() - startTime;

          if (cleaned) {
            return {
              success: true,
              text: cleaned,
              latencyMs: latency,
              model: activeModel,
              provider: `Ollama Document AI (${activeModel})`,
              citations: this.extractCitations(cleaned, relevantChunks),
            };
          }
        } catch (pdfErr) {
          clearTimeout(pdfTimeout);
        }
      }
    }

    // 3. Offline Extractive Fallback
    if (relevantChunks && relevantChunks.length > 0) {
      const topChunk = relevantChunks[0];
      const snippet = topChunk.text.replace(/\[Page \d+\]:\s*/, '').slice(0, 180);
      return {
        success: true,
        text: `According to Page ${topChunk.pageNumber} of the document: ${snippet}...`,
        latencyMs: Date.now() - startTime,
        model: 'Offline Extractive Match',
        provider: 'Local Document Index',
        citations: [topChunk.pageNumber],
      };
    }

    return {
      success: false,
      text: 'Unable to connect to Document AI. Please verify internet connection or API settings in Admin.',
      latencyMs: Date.now() - startTime,
      error: 'All Document AI endpoints exhausted.',
    };
  }

  /**
   * Cleans PDF response while preserving [Page X] citations
   */
  cleanPdfResponse(text) {
    if (!text) return '';
    let cleaned = text;
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '');
    cleaned = cleaned.replace(/<\|.*?\|>/g, '');
    cleaned = cleaned.replace(/<[^>]*>/g, '');
    cleaned = cleaned.replace(/[\*_]{1,2}/g, '');
    cleaned = cleaned.replace(/`{1,3}/g, '');
    cleaned = cleaned.replace(/^#+\s+/gm, '');
    cleaned = cleaned.replace(/^(assistant|aurra):\s*/i, '');
    cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\n{2,}/g, ' ').trim();
    return cleaned;
  }

  /**
   * Extracts page citation numbers like [Page 2] or Page 3 from text
   */
  extractCitations(text, fallbackChunks = []) {
    const citations = new Set();
    const regex = /\[?Page\s+(\d+)\]?/gi;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const page = parseInt(match[1], 10);
      if (!isNaN(page)) citations.add(page);
    }
    if (citations.size === 0 && fallbackChunks && fallbackChunks.length > 0) {
      citations.add(fallbackChunks[0].pageNumber);
    }
    return Array.from(citations);
  }

  /**
   * Test API connectivity directly from Admin Panel
   */
  async testConnection() {
    const result = await this.generateResponse('Hello! Introduce yourself in one short sentence.');
    return result;
  }
}

export const llmService = new LlmService();

if (typeof window !== 'undefined') {
  window.llmService = llmService;
}
