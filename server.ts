import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import express from 'express';
import {GoogleGenAI, Type} from '@google/genai';
import {
  ArtworkVariant,
  CATEGORIES,
  CoinAssetClass,
  CoinTrade,
  DEFAULT_SETTINGS,
  INITIAL_COINS,
  INITIAL_PROJECTS,
  INITIAL_TRADES,
  KlyroProject,
  ProjectCategory,
  ProjectCoin,
  ProjectFileRecord,
  STOCK_PRESETS,
  StudioSettings,
} from './src/data/projects';
import {
  ProfileRimId,
  SUPPORTED_CHAINS,
  VALID_PROFILE_RIM_IDS,
  WalletChain,
  generateContractAddress,
} from './src/lib/wallets';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, 'data');
const UPLOADS_DIR = path.resolve(DATA_DIR, 'uploads');
const DB_PATH = path.resolve(DATA_DIR, 'klyro-db.json');

interface PersistedDb {
  projects: KlyroProject[];
  coins: ProjectCoin[];
  trades: Record<string, CoinTrade[]>;
  savedIds: Record<string, boolean>;
  likedIds: Record<string, boolean>;
  followingHandles: Record<string, boolean>;
  joinedCommunities: Record<string, boolean>;
  completedGuides: Record<string, boolean>;
  settings: StudioSettings;
}

const VALID_ARTWORKS: ArtworkVariant[] = [
  'klyro',
  'nova',
  'zenith',
  'orbit',
  'pixelcraft',
  'stackforge',
  'edusphere',
];

const VALID_CATEGORIES = CATEGORIES.filter((c): c is Exclude<ProjectCategory, 'All'> => c !== 'All');
const VALID_CHAINS: WalletChain[] = SUPPORTED_CHAINS;

const ALLOWED_FILE_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'application/json',
  'application/zip',
  'application/x-zip-compressed',
  'text/plain',
  'text/markdown',
  'text/html',
  'text/css',
  'text/javascript',
  'application/javascript',
  'application/typescript',
  'text/typescript',
  'application/octet-stream',
]);

function createDefaultDb(): PersistedDb {
  return {
    projects: structuredClone(INITIAL_PROJECTS),
    coins: structuredClone(INITIAL_COINS),
    trades: structuredClone(INITIAL_TRADES),
    savedIds: {},
    likedIds: {},
    followingHandles: {},
    joinedCommunities: {},
    completedGuides: {},
    settings: {...DEFAULT_SETTINGS},
  };
}

function loadDb(): PersistedDb {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, {recursive: true});
    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, {recursive: true});
    if (!DB_PATH.startsWith(DATA_DIR + path.sep)) {
      throw new Error('Invalid DB path');
    }
    if (!fs.existsSync(DB_PATH)) {
      const initial = createDefaultDb();
      fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2), 'utf8');
      return initial;
    }
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<PersistedDb>;
    const defaults = createDefaultDb();

    const parsedProjects =
      Array.isArray(parsed.projects) && parsed.projects.length > 0
        ? parsed.projects
        : defaults.projects;
    const mergedProjects = parsedProjects.map((proj) => {
      const defProj = defaults.projects.find((d) => d.id === proj.id);
      if (!defProj) return proj;
      const existingFiles = Array.isArray(proj.files) ? proj.files : [];
      const existingIds = new Set(existingFiles.map((f) => f.id));
      const existingNames = new Set(existingFiles.map((f) => f.name));
      const missingDefaults = (defProj.files || []).filter(
        (df) => !existingIds.has(df.id) && !existingNames.has(df.name)
      );
      return missingDefaults.length > 0
        ? {...proj, files: [...missingDefaults, ...existingFiles]}
        : proj;
    });
    const projectIds = new Set(mergedProjects.map((p) => p.id));
    for (const defProj of defaults.projects) {
      if (!projectIds.has(defProj.id)) mergedProjects.push(defProj);
    }

    const parsedCoins =
      Array.isArray(parsed.coins) && parsed.coins.length > 0 ? parsed.coins : defaults.coins;
    const coinIds = new Set(parsedCoins.map((c) => c.id));
    const mergedCoins = [...parsedCoins];
    for (const defCoin of defaults.coins) {
      if (!coinIds.has(defCoin.id)) {
        mergedCoins.push(defCoin);
      }
    }

    const parsedTrades =
      parsed.trades && typeof parsed.trades === 'object' ? parsed.trades : {};
    const mergedTrades: Record<string, CoinTrade[]> = {...defaults.trades, ...parsedTrades};
    for (const [coinId, defList] of Object.entries(defaults.trades)) {
      if (!Array.isArray(mergedTrades[coinId]) || mergedTrades[coinId].length === 0) {
        mergedTrades[coinId] = defList;
      }
    }

    return {
      projects: mergedProjects,
      coins: mergedCoins,
      trades: mergedTrades,
      savedIds: parsed.savedIds && typeof parsed.savedIds === 'object' ? parsed.savedIds : {},
      likedIds: parsed.likedIds && typeof parsed.likedIds === 'object' ? parsed.likedIds : {},
      followingHandles:
        parsed.followingHandles && typeof parsed.followingHandles === 'object'
          ? parsed.followingHandles
          : {},
      joinedCommunities:
        parsed.joinedCommunities && typeof parsed.joinedCommunities === 'object'
          ? parsed.joinedCommunities
          : {},
      completedGuides:
        parsed.completedGuides && typeof parsed.completedGuides === 'object'
          ? parsed.completedGuides
          : {},
      settings: {
        ...defaults.settings,
        ...(parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : {}),
      },
    };
  } catch (err) {
    console.error('Failed to load DB, using defaults:', err);
    return createDefaultDb();
  }
}

let db: PersistedDb = loadDb();

function saveDb(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, {recursive: true});
    if (!DB_PATH.startsWith(DATA_DIR + path.sep)) return;
    const tmpPath = path.resolve(DATA_DIR, 'klyro-db.tmp.json');
    fs.writeFileSync(tmpPath, JSON.stringify(db, null, 2), 'utf8');
    fs.renameSync(tmpPath, DB_PATH);
  } catch (err) {
    console.error('Failed to persist DB:', err);
  }
}

function sanitizeText(input: unknown, maxLen: number): string {
  if (typeof input !== 'string') return '';
  return input.trim().slice(0, maxLen);
}

function isValidImageDataUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (value.length > 2_200_000) return false;
  return /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value);
}

async function startServer() {
  const app = express();
  app.use(express.json({limit: '8mb'}));

  app.get('/api/health', (_req, res) => {
    res.json({ok: true});
  });

  app.get('/api/state', (_req, res) => {
    res.json(db);
  });

  // Upload a real project file safely to data/uploads/
  app.post('/api/files/upload', (req, res) => {
    const rawName = sanitizeText(req.body?.name, 120);
    const mimeType = sanitizeText(req.body?.mimeType, 100) || 'application/octet-stream';
    const dataBase64 = typeof req.body?.dataBase64 === 'string' ? req.body.dataBase64 : '';

    if (!rawName || !dataBase64) {
      return res.status(400).json({error: 'File name and content are required.'});
    }
    if (!ALLOWED_FILE_MIMES.has(mimeType) && !mimeType.startsWith('text/')) {
      return res.status(400).json({error: `Unsupported file type: ${mimeType}`});
    }

    const base64Body = dataBase64.includes(',') ? dataBase64.split(',')[1] : dataBase64;
    const buffer = Buffer.from(base64Body, 'base64');
    if (buffer.length === 0 || buffer.length > 5_242_880) {
      return res.status(400).json({error: 'File must be between 1 byte and 5MB.'});
    }

    const safeBase = rawName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'file';
    const storedName = `${crypto.randomUUID()}-${safeBase}`;
    const targetPath = path.resolve(UPLOADS_DIR, storedName);
    if (!targetPath.startsWith(UPLOADS_DIR + path.sep)) {
      return res.status(400).json({error: 'Invalid upload path.'});
    }

    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, {recursive: true});
    fs.writeFileSync(targetPath, buffer);

    let previewText: string | undefined;
    if (
      (mimeType.startsWith('text/') ||
        mimeType === 'application/json' ||
        /\.(md|txt|ts|tsx|js|jsx|json|css|html|svg)$/i.test(rawName)) &&
      buffer.length <= 20000
    ) {
      previewText = buffer.toString('utf8').slice(0, 20000);
    }

    return res.status(201).json({
      file: {
        id: `file-${crypto.randomUUID().slice(0, 10)}`,
        name: rawName,
        mimeType,
        sizeBytes: buffer.length,
        url: `/api/files/${encodeURIComponent(storedName)}`,
        previewText,
        createdAt: new Date().toISOString(),
      },
    });
  });

  // Serve uploaded files safely with nosniff
  app.get('/api/files/:storedName', (req, res) => {
    const rawStored = sanitizeText(req.params.storedName, 180);
    const safeStored = path.basename(rawStored);
    const targetPath = path.resolve(UPLOADS_DIR, safeStored);
    if (!targetPath.startsWith(UPLOADS_DIR + path.sep) || !fs.existsSync(targetPath)) {
      return res.status(404).json({error: 'File not found.'});
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.sendFile(targetPath);
  });

  // Build or iterate on project files with Gemini AI (server-side only)
  app.post('/api/ai/build-project', async (req, res) => {
    const prompt = sanitizeText(req.body?.prompt, 2000);
    const projectName = sanitizeText(req.body?.projectName, 60);
    const category = sanitizeText(req.body?.category, 40) || 'AI';
    const ownerUid = sanitizeText(req.body?.ownerUid, 128) || 'local-creator';
    const currentFiles = Array.isArray(req.body?.currentFiles) ? req.body.currentFiles : [];

    if (!prompt || prompt.length < 3) {
      return res.status(400).json({error: 'Describe what you want Klyro AI to build.'});
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      return res.status(503).json({
        error: 'GEMINI_API_KEY is not configured on the server. Set it in Secrets to use Klyro AI Builder.',
      });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {headers: {'User-Agent': 'aistudio-build'}},
      });

      const fileContext = currentFiles
        .slice(0, 6)
        .map((f: {name?: string; previewText?: string}) => {
          const fname = sanitizeText(f?.name, 80);
          const snippet = typeof f?.previewText === 'string' ? f.previewText.slice(0, 4000) : '';
          return `--- FILE: ${fname} ---\n${snippet}`;
        })
        .join('\n\n');

      const userMessage = [
        projectName ? `Project Name: ${projectName}` : '',
        `Category: ${category}`,
        fileContext ? `Existing Project Files:\n${fileContext}` : 'No existing files yet.',
        `User Request: ${prompt}`,
      ]
        .filter(Boolean)
        .join('\n\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: userMessage,
        config: {
          systemInstruction:
            'You are Klyro AI Project Builder. Generate real, fully working, interactive web application files that execute inside an isolated <iframe sandbox="allow-scripts">. ' +
            'CRITICAL RULES: (1) Always include a complete self-contained index.html as the entry point (you may also include style.css, app.js, or data.json, or inline styles/scripts in index.html). ' +
            '(2) Keep index.html concise and under 16,000 characters. ' +
            '(3) NEVER use alert(), confirm(), prompt(), window.open(), localStorage, or sessionStorage because the sandbox iframe blocks them; keep all state in memory. ' +
            '(4) Use a crisp black, white, and silver luxury tech visual style with clean interactive controls, real calculations, canvas/SVG visuals, or live state updates that genuinely work when clicked.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: {type: Type.STRING},
              suggestedName: {type: Type.STRING},
              suggestedTagline: {type: Type.STRING},
              suggestedDescription: {type: Type.STRING},
              files: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: {type: Type.STRING},
                    mimeType: {type: Type.STRING},
                    content: {type: Type.STRING},
                  },
                  required: ['name', 'mimeType', 'content'],
                },
              },
            },
            required: ['reply', 'suggestedName', 'suggestedTagline', 'suggestedDescription', 'files'],
          },
        },
      });

      const rawText = response.text;
      if (!rawText) {
        return res.status(502).json({error: 'AI returned an empty response.'});
      }

      const parsed = JSON.parse(rawText) as {
        reply?: string;
        suggestedName?: string;
        suggestedTagline?: string;
        suggestedDescription?: string;
        files?: Array<{name?: string; mimeType?: string; content?: string}>;
      };

      const generated = Array.isArray(parsed.files) ? parsed.files : [];
      if (generated.length === 0) {
        return res.status(502).json({error: 'AI did not return any project files.'});
      }

      if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, {recursive: true});
      const nowIso = new Date().toISOString();

      const savedFiles: ProjectFileRecord[] = generated.slice(0, 8).map((gf, index) => {
        const cleanName =
          sanitizeText(gf.name, 120).replace(/[^a-zA-Z0-9._-]/g, '_') ||
          (index === 0 ? 'index.html' : `file-${index}.txt`);
        const content = typeof gf.content === 'string' ? gf.content : '';
        const buffer = Buffer.from(content, 'utf8');
        const storedName = `${crypto.randomUUID()}-${cleanName}`;
        const targetPath = path.resolve(UPLOADS_DIR, storedName);
        if (!targetPath.startsWith(UPLOADS_DIR + path.sep)) {
          throw new Error('Invalid generated file path.');
        }
        fs.writeFileSync(targetPath, buffer);
        const inferredMime =
          sanitizeText(gf.mimeType, 100) ||
          (cleanName.endsWith('.html')
            ? 'text/html'
            : cleanName.endsWith('.css')
            ? 'text/css'
            : cleanName.endsWith('.js')
            ? 'text/javascript'
            : cleanName.endsWith('.json')
            ? 'application/json'
            : 'text/plain');
        return {
          id: `file-${crypto.randomUUID().slice(0, 10)}`,
          projectId: 'pending',
          ownerUid,
          name: cleanName,
          mimeType: inferredMime,
          sizeBytes: buffer.length,
          url: `/api/files/${encodeURIComponent(storedName)}`,
          previewText: content.slice(0, 20000),
          createdAt: nowIso,
        };
      });

      return res.json({
        reply: sanitizeText(parsed.reply, 600) || 'Generated runnable application files.',
        suggestedName: sanitizeText(parsed.suggestedName, 60),
        suggestedTagline: sanitizeText(parsed.suggestedTagline, 120),
        suggestedDescription: sanitizeText(parsed.suggestedDescription, 800),
        files: savedFiles,
      });
    } catch (err) {
      console.error('AI project build failed:', err);
      const message = err instanceof Error ? err.message : 'Failed to generate project files with AI.';
      return res.status(500).json({error: message});
    }
  });

  // Create & publish a new project (requires at least 1 uploaded or AI-built file)
  app.post('/api/projects', (req, res) => {
    const name = sanitizeText(req.body?.name, 60);
    const tagline = sanitizeText(req.body?.tagline, 120) || 'Create. Innovate. Share.';
    const description =
      sanitizeText(req.body?.description, 800) ||
      'A modern project launched and showcased on Klyro.';
    const category = req.body?.category as Exclude<ProjectCategory, 'All'>;
    const artwork = req.body?.artwork as ArtworkVariant;
    const rawHandle = sanitizeText(req.body?.creatorHandle, 40) || db.settings.creatorHandle;
    const creatorHandle = rawHandle.startsWith('@') ? rawHandle : `@${rawHandle}`;
    const creatorName = sanitizeText(req.body?.creatorName, 60) || db.settings.displayName || name;
    const ownerUid = sanitizeText(req.body?.ownerUid, 128) || 'local-creator';
    const customCoverUrl = req.body?.customCoverUrl;

    if (name.length < 2) {
      return res.status(400).json({error: 'Project name must be at least 2 characters.'});
    }
    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({error: 'Invalid project category.'});
    }
    if (!VALID_ARTWORKS.includes(artwork)) {
      return res.status(400).json({error: 'Invalid artwork finish.'});
    }
    if (
      customCoverUrl !== undefined &&
      customCoverUrl !== '' &&
      !isValidImageDataUrl(customCoverUrl) &&
      !(typeof customCoverUrl === 'string' && customCoverUrl.startsWith('/api/files/'))
    ) {
      return res
        .status(400)
        .json({error: 'Cover image must be a valid PNG, JPEG, or WebP under 1.5MB.'});
    }

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const id = `${slug || 'project'}-${Date.now()}`;
    const nowIso = new Date().toISOString();

    const incomingFiles = Array.isArray(req.body?.files) ? req.body.files : [];
    const attachedFiles: ProjectFileRecord[] = incomingFiles
      .slice(0, 12)
      .map((f: Partial<ProjectFileRecord>) => ({
        id: sanitizeText(f.id, 128) || `file-${crypto.randomUUID().slice(0, 8)}`,
        projectId: id,
        ownerUid,
        name: sanitizeText(f.name, 140) || 'attachment',
        mimeType: sanitizeText(f.mimeType, 100) || 'application/octet-stream',
        sizeBytes: typeof f.sizeBytes === 'number' ? Math.max(0, f.sizeBytes) : 0,
        url: sanitizeText(f.url, 500),
        previewText: typeof f.previewText === 'string' ? f.previewText.slice(0, 20000) : undefined,
        createdAt: f.createdAt || nowIso,
      }));

    if (attachedFiles.length === 0) {
      return res.status(400).json({
        error: 'Upload at least one project file or build your project with Klyro AI before publishing.',
      });
    }

    let launchedCoin: ProjectCoin | undefined;
    const coinReq = req.body?.coin;
    if (coinReq && coinReq.enabled) {
      const ticker = sanitizeText(coinReq.ticker, 10).toUpperCase().replace(/[^A-Z0-9]/g, '');
      const network = VALID_CHAINS.includes(coinReq.network) ? coinReq.network : 'Solana';
      if (ticker.length < 2) {
        return res.status(400).json({error: 'Coin ticker must be 2–10 alphanumeric characters.'});
      }
      const assetClass: CoinAssetClass =
        coinReq.assetClass === 'stock'
          ? 'stock'
          : coinReq.assetClass === 'perp' || network === 'Hyperliquid'
          ? 'perp'
          : 'coin';
      const stockSymbol = sanitizeText(coinReq.stockSymbol, 12).toUpperCase().replace(/[^A-Z0-9.]/g, '');
      const stockCompany = sanitizeText(coinReq.stockCompany, 80);
      const stockExchange = sanitizeText(coinReq.stockExchange, 24);
      const totalSupply =
        typeof coinReq.totalSupply === 'number' && coinReq.totalSupply > 0
          ? coinReq.totalSupply
          : 1_000_000_000;
      const targetCapUsd =
        typeof coinReq.targetCapUsd === 'number' && coinReq.targetCapUsd > 0
          ? coinReq.targetCapUsd
          : 69000;
      const creatorFeePct =
        typeof coinReq.creatorFeePct === 'number' && coinReq.creatorFeePct >= 0 && coinReq.creatorFeePct <= 5
          ? coinReq.creatorFeePct
          : 0.5;
      const creatorWallet = sanitizeText(coinReq.creatorWallet, 80);
      const refPrice =
        typeof coinReq.refPriceUsd === 'number' && coinReq.refPriceUsd > 0
          ? coinReq.refPriceUsd
          : undefined;
      const initialPrice = refPrice || Number((5000 / totalSupply).toFixed(8)) || 0.000005;
      const contractAddress = generateContractAddress(network);
      const coinId = `coin-${id}`;
      const maxLeverage =
        typeof coinReq.maxLeverage === 'number' && coinReq.maxLeverage >= 1 && coinReq.maxLeverage <= 100
          ? coinReq.maxLeverage
          : network === 'Hyperliquid'
          ? 25
          : assetClass === 'stock'
          ? 10
          : undefined;

      launchedCoin = {
        id: coinId,
        projectId: id,
        ownerUid,
        name: sanitizeText(coinReq.name, 50) || name,
        ticker,
        network,
        contractAddress,
        creatorWallet: creatorWallet || undefined,
        assetClass,
        ...(stockSymbol ? {stockSymbol} : {}),
        ...(stockCompany ? {stockCompany} : {}),
        ...(stockExchange ? {stockExchange} : {}),
        ...(network === 'Hyperliquid' || assetClass === 'perp'
          ? {fundingRatePct: 0.012, openInterestUsd: 125000}
          : {}),
        ...(maxLeverage ? {maxLeverage} : {}),
        totalSupply,
        creatorFeePct,
        targetCapUsd,
        priceUsd: initialPrice,
        marketCapUsd: assetClass === 'stock' ? Math.round(initialPrice * 1_000_000) : 5000,
        volume24hUsd: 0,
        bondingProgress: assetClass === 'stock' ? 100 : Number(((5000 / targetCapUsd) * 100).toFixed(1)),
        holdersCount: 1,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      db.coins = [launchedCoin, ...db.coins];
      db.trades[coinId] = [];
    }

    const newProject: KlyroProject = {
      id,
      ownerUid,
      name,
      tagline,
      description,
      category,
      tags: [category, 'Creative', 'Web'],
      creatorName,
      creatorHandle,
      views: 1,
      likes: 1,
      artwork,
      customCoverUrl: typeof customCoverUrl === 'string' && customCoverUrl ? customCoverUrl : undefined,
      coinId: launchedCoin?.id,
      coinTicker: launchedCoin?.ticker,
      contractAddress: launchedCoin?.contractAddress,
      verified: true,
      officialPublished: true,
      trendingRank: db.projects.length + 1,
      isUserCreated: true,
      createdAt: nowIso,
      updatedAt: nowIso,
      updates: [
        {
          version: 'Launch v1.0',
          date: 'Today',
          note: launchedCoin
            ? `Initial release with $${launchedCoin.ticker} launched on ${launchedCoin.network}.`
            : 'Initial public release on Klyro.',
        },
      ],
      comments: [],
      files: attachedFiles,
    };

    db.projects = [newProject, ...db.projects];
    db.likedIds[newProject.id] = true;
    saveDb();

    return res.status(201).json({project: newProject, coin: launchedCoin, state: db});
  });

  // Attach file metadata to an existing project
  app.post('/api/projects/:id/files', (req, res) => {
    const {id} = req.params;
    const project = db.projects.find((p) => p.id === id);
    if (!project) return res.status(404).json({error: 'Project not found.'});

    const file = req.body?.file as Partial<ProjectFileRecord>;
    if (!file || !file.name) {
      return res.status(400).json({error: 'File record is required.'});
    }
    const record: ProjectFileRecord = {
      id: sanitizeText(file.id, 128) || `file-${crypto.randomUUID().slice(0, 8)}`,
      projectId: id,
      ownerUid: sanitizeText(file.ownerUid, 128) || project.ownerUid || 'local-creator',
      name: sanitizeText(file.name, 140),
      mimeType: sanitizeText(file.mimeType, 100) || 'application/octet-stream',
      sizeBytes: typeof file.sizeBytes === 'number' ? file.sizeBytes : 0,
      url: sanitizeText(file.url, 500),
      previewText: typeof file.previewText === 'string' ? file.previewText.slice(0, 20000) : undefined,
      createdAt: file.createdAt || new Date().toISOString(),
    };
    project.files = [record, ...(project.files || [])];
    project.updatedAt = new Date().toISOString();
    saveDb();
    return res.status(201).json({file: record, state: db});
  });

  app.delete('/api/projects/:id/files/:fileId', (req, res) => {
    const {id, fileId} = req.params;
    const project = db.projects.find((p) => p.id === id);
    if (!project) return res.status(404).json({error: 'Project not found.'});
    project.files = (project.files || []).filter((f) => f.id !== fileId);
    project.updatedAt = new Date().toISOString();
    saveDb();
    return res.json({ok: true, state: db});
  });

  // Launch a coin for an existing project
  app.post('/api/coins', (req, res) => {
    const projectId = sanitizeText(req.body?.projectId, 128);
    const project = db.projects.find((p) => p.id === projectId);
    if (!project) return res.status(404).json({error: 'Project not found.'});
    if (project.coinId) return res.status(400).json({error: 'This project already has a coin.'});

    const ticker = sanitizeText(req.body?.ticker, 10).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (ticker.length < 2) {
      return res.status(400).json({error: 'Ticker must be 2–10 alphanumeric characters.'});
    }
    const network = VALID_CHAINS.includes(req.body?.network) ? req.body.network : 'Solana';
    const assetClass: CoinAssetClass =
      req.body?.assetClass === 'stock'
        ? 'stock'
        : req.body?.assetClass === 'perp' || network === 'Hyperliquid'
        ? 'perp'
        : 'coin';
    const stockSymbol = sanitizeText(req.body?.stockSymbol, 12).toUpperCase().replace(/[^A-Z0-9.]/g, '');
    const stockCompany = sanitizeText(req.body?.stockCompany, 80);
    const stockExchange = sanitizeText(req.body?.stockExchange, 24);
    const totalSupply =
      typeof req.body?.totalSupply === 'number' && req.body.totalSupply > 0
        ? req.body.totalSupply
        : 1_000_000_000;
    const targetCapUsd =
      typeof req.body?.targetCapUsd === 'number' && req.body.targetCapUsd > 0
        ? req.body.targetCapUsd
        : 69000;
    const creatorFeePct =
      typeof req.body?.creatorFeePct === 'number' && req.body.creatorFeePct >= 0 && req.body.creatorFeePct <= 5
        ? req.body.creatorFeePct
        : 0.5;
    const creatorWallet = sanitizeText(req.body?.creatorWallet, 80);
    const refPrice =
      typeof req.body?.refPriceUsd === 'number' && req.body.refPriceUsd > 0
        ? req.body.refPriceUsd
        : undefined;
    const nowIso = new Date().toISOString();
    const coinId = `coin-${project.id}`;
    const contractAddress = generateContractAddress(network);
    const initialPrice = refPrice || Number((5000 / totalSupply).toFixed(8)) || 0.000005;
    const maxLeverage =
      typeof req.body?.maxLeverage === 'number' && req.body.maxLeverage >= 1 && req.body.maxLeverage <= 100
        ? req.body.maxLeverage
        : network === 'Hyperliquid'
        ? 25
        : assetClass === 'stock'
        ? 10
        : undefined;

    const coin: ProjectCoin = {
      id: coinId,
      projectId: project.id,
      ownerUid: sanitizeText(req.body?.ownerUid, 128) || project.ownerUid || 'local-creator',
      name: sanitizeText(req.body?.name, 50) || project.name,
      ticker,
      network,
      contractAddress,
      creatorWallet: creatorWallet || undefined,
      assetClass,
      ...(stockSymbol ? {stockSymbol} : {}),
      ...(stockCompany ? {stockCompany} : {}),
      ...(stockExchange ? {stockExchange} : {}),
      ...(network === 'Hyperliquid' || assetClass === 'perp'
        ? {fundingRatePct: 0.012, openInterestUsd: 125000}
        : {}),
      ...(maxLeverage ? {maxLeverage} : {}),
      totalSupply,
      creatorFeePct,
      targetCapUsd,
      priceUsd: initialPrice,
      marketCapUsd: assetClass === 'stock' ? Math.round(initialPrice * 1_000_000) : 5000,
      volume24hUsd: 0,
      bondingProgress: assetClass === 'stock' ? 100 : Number(((5000 / targetCapUsd) * 100).toFixed(1)),
      holdersCount: 1,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    project.coinId = coin.id;
    project.coinTicker = coin.ticker;
    project.contractAddress = coin.contractAddress;
    project.updatedAt = nowIso;
    db.coins = [coin, ...db.coins];
    db.trades[coin.id] = [];
    saveDb();

    return res.status(201).json({coin, state: db});
  });

  // Add a stock to an existing coin OR deploy a new tokenized stock + live tracker project
  app.post('/api/coins/stock', (req, res) => {
    const mode = req.body?.mode === 'attach' ? 'attach' : 'create';
    const rawSymbol = sanitizeText(req.body?.stockSymbol, 12).toUpperCase().replace(/[^A-Z0-9]/g, '');
    const preset = STOCK_PRESETS.find((s) => s.symbol === rawSymbol);
    const stockSymbol = rawSymbol || preset?.symbol || '';
    const stockCompany = sanitizeText(req.body?.stockCompany, 80) || preset?.company || stockSymbol;
    const stockExchange = sanitizeText(req.body?.stockExchange, 24) || preset?.exchange || 'NASDAQ';
    const ownerUid = sanitizeText(req.body?.ownerUid, 128) || 'local-creator';
    const rawHandle = sanitizeText(req.body?.creatorHandle, 40) || db.settings.creatorHandle || '@klyro';
    const creatorHandle = rawHandle.startsWith('@') ? rawHandle : `@${rawHandle}`;
    const creatorName = sanitizeText(req.body?.creatorName, 60) || db.settings.displayName || 'Klyro Trader';

    if (stockSymbol.length < 1) {
      return res.status(400).json({error: 'Stock symbol is required (e.g. NVDA, AAPL, TSLA).'});
    }

    const nowIso = new Date().toISOString();

    if (mode === 'attach') {
      const coinId = sanitizeText(req.body?.coinId, 128);
      const coin = db.coins.find((c) => c.id === coinId);
      if (!coin) return res.status(404).json({error: 'Target token not found.'});

      coin.assetClass = 'stock';
      coin.stockSymbol = stockSymbol;
      coin.stockCompany = stockCompany;
      coin.stockExchange = stockExchange;
      coin.maxLeverage = coin.maxLeverage || 10;
      coin.updatedAt = nowIso;
      saveDb();
      return res.status(200).json({coin, state: db});
    }

    const network = VALID_CHAINS.includes(req.body?.network) ? req.body.network : 'Hyperliquid';
    const rawTicker = sanitizeText(req.body?.ticker, 10).toUpperCase().replace(/[^A-Z0-9]/g, '');
    const ticker = rawTicker.length >= 2 ? rawTicker : `${stockSymbol}X`.slice(0, 10);
    const refPriceUsd =
      typeof req.body?.refPriceUsd === 'number' && req.body.refPriceUsd > 0
        ? req.body.refPriceUsd
        : preset?.refPriceUsd || 100;
    const maxLeverage =
      typeof req.body?.maxLeverage === 'number' && req.body.maxLeverage >= 1 && req.body.maxLeverage <= 40
        ? req.body.maxLeverage
        : 10;
    const creatorWallet = sanitizeText(req.body?.creatorWallet, 80);

    const slug = `${stockSymbol.toLowerCase()}-${Date.now()}`;
    const projectId = `stock-${slug}`;
    const coinId = `coin-${projectId}`;
    const contractAddress = generateContractAddress(network);
    const totalSupply = 10_000_000;
    const marketCapUsd = Number((refPriceUsd * 1_200_000).toFixed(2));

    const trackerHtml = `<!doctype html>
<html>
<head><meta charset="utf-8" /><style>
  *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Inter",sans-serif;}
  body{margin:0;background:#09090b;color:#fafafa;padding:22px;display:grid;gap:14px;}
  .card{background:#18181b;border:1px solid #27272a;border-radius:14px;padding:16px;}
  .row{display:flex;justify-content:space-between;align-items:center;gap:12px;}
  .price{font-size:28px;font-weight:700;font-variant-numeric:tabular-nums;}
  button{background:#fff;color:#09090b;border:0;border-radius:999px;padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer;}
</style></head>
<body>
  <div class="card row">
    <div><div style="font-size:11px;color:#a1a1aa;text-transform:uppercase;letter-spacing:.12em;">${stockExchange}: ${stockSymbol} · ${network}</div>
    <div style="font-size:17px;font-weight:700;margin-top:4px;">${stockCompany} ($${ticker})</div></div>
    <button id="tickBtn">Simulate Oracle Tick</button>
  </div>
  <div class="card row">
    <div><div style="font-size:11px;color:#a1a1aa;">Synthetic Reference Price</div><div id="px" class="price">$${refPriceUsd.toFixed(2)}</div></div>
    <div style="text-align:right;"><div style="font-size:11px;color:#a1a1aa;">Max Margin</div><div style="font-size:18px;font-weight:600;">${maxLeverage}x</div></div>
  </div>
  <script>
    let px = ${refPriceUsd};
    document.getElementById('tickBtn').onclick = () => {
      px = Math.max(1, px * (1 + (Math.random() - 0.48) * 0.025));
      document.getElementById('px').textContent = '$' + px.toFixed(2);
    };
  </script>
</body>
</html>`;

    const newProject: KlyroProject = {
      id: projectId,
      ownerUid,
      name: `${stockCompany} (${ticker})`,
      tagline: `Tokenized ${stockExchange}:${stockSymbol} synthetic equity market on ${network}.`,
      description: `On-chain tokenized equity tracking ${stockCompany} (${stockExchange}: ${stockSymbol}) deployed on ${network} with up to ${maxLeverage}x terminal execution.`,
      category: 'Developer Tools',
      tags: ['Stocks', network, stockSymbol],
      creatorName,
      creatorHandle,
      views: 1,
      likes: 1,
      artwork: 'stackforge',
      coinId,
      coinTicker: ticker,
      contractAddress,
      verified: true,
      officialPublished: true,
      trendingRank: db.projects.length + 1,
      isUserCreated: true,
      createdAt: nowIso,
      updatedAt: nowIso,
      updates: [
        {
          version: 'Stock v1.0',
          date: 'Today',
          note: `Added ${stockExchange}:${stockSymbol} synthetic stock oracle backing for $${ticker} on ${network}.`,
        },
      ],
      comments: [],
      files: [
        {
          id: `file-${projectId}-app`,
          projectId,
          ownerUid,
          name: 'index.html',
          mimeType: 'text/html',
          sizeBytes: trackerHtml.length,
          url: `/api/files/${projectId}-index.html`,
          previewText: trackerHtml,
          createdAt: nowIso,
        },
      ],
    };

    const newCoin: ProjectCoin = {
      id: coinId,
      projectId,
      ownerUid,
      name: `${stockCompany} (${ticker})`,
      ticker,
      network,
      contractAddress,
      creatorWallet: creatorWallet || undefined,
      assetClass: 'stock',
      stockSymbol,
      stockCompany,
      stockExchange,
      maxLeverage,
      fundingRatePct: network === 'Hyperliquid' ? 0.008 : undefined,
      openInterestUsd: network === 'Hyperliquid' ? 350_000 : undefined,
      totalSupply,
      creatorFeePct: 0.25,
      targetCapUsd: Math.max(500_000, marketCapUsd),
      priceUsd: Number(refPriceUsd.toFixed(4)),
      marketCapUsd,
      volume24hUsd: 42_500,
      bondingProgress: 100,
      holdersCount: 1,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    db.projects = [newProject, ...db.projects];
    db.coins = [newCoin, ...db.coins];
    db.trades[coinId] = [];
    saveDb();

    return res.status(201).json({coin: newCoin, project: newProject, state: db});
  });

  // Execute a simulated sandbox buy/sell trade on a coin
  app.post('/api/coins/:coinId/trade', (req, res) => {
    const {coinId} = req.params;
    const coin = db.coins.find((c) => c.id === coinId);
    if (!coin) return res.status(404).json({error: 'Coin not found.'});

    const side = req.body?.side === 'sell' ? 'sell' : req.body?.side === 'buy' ? 'buy' : null;
    const amountUsd = Number(req.body?.amountUsd);
    const maxLev = coin.maxLeverage || 40;
    const rawLeverage = Number(req.body?.leverage);
    const leverage =
      Number.isFinite(rawLeverage) && rawLeverage >= 1
        ? Math.min(maxLev, Math.round(rawLeverage))
        : 1;
    const traderUid = sanitizeText(req.body?.traderUid, 128) || 'sandbox-trader';
    const traderHandle = sanitizeText(req.body?.traderHandle, 40) || db.settings.creatorHandle;

    if (!side || !Number.isFinite(amountUsd) || amountUsd <= 0 || amountUsd > 1_000_000) {
      return res.status(400).json({error: 'Enter a valid USD trade amount between $0.01 and $1,000,000.'});
    }

    const effectiveNotional = amountUsd * leverage;
    const tokenAmount = effectiveNotional / Math.max(0.0000001, coin.priceUsd);
    const impactRatio = Math.min(0.18, effectiveNotional / Math.max(10000, coin.marketCapUsd * 2.5));
    const nextMarketCap =
      side === 'buy'
        ? coin.marketCapUsd + effectiveNotional * 0.65
        : Math.max(2500, coin.marketCapUsd - effectiveNotional * 0.62);
    const nextPrice =
      side === 'buy'
        ? coin.priceUsd * (1 + impactRatio)
        : Math.max(0.000001, coin.priceUsd * (1 - impactRatio * 0.9));

    coin.marketCapUsd = Number(nextMarketCap.toFixed(2));
    coin.priceUsd = Number(nextPrice.toFixed(8));
    coin.volume24hUsd = Number((coin.volume24hUsd + effectiveNotional).toFixed(2));
    if (typeof coin.openInterestUsd === 'number') {
      coin.openInterestUsd = Number((coin.openInterestUsd + effectiveNotional * 0.4).toFixed(2));
    }
    coin.bondingProgress = Number(
      Math.min(100, Math.max(1, (coin.marketCapUsd / Math.max(1000, coin.targetCapUsd)) * 100)).toFixed(1)
    );
    if (side === 'buy') coin.holdersCount += 1;
    coin.updatedAt = new Date().toISOString();

    const trade: CoinTrade = {
      id: `tr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      coinId: coin.id,
      traderUid,
      traderHandle,
      side,
      amountUsd: Number(amountUsd.toFixed(2)),
      tokenAmount: Number(tokenAmount.toFixed(4)),
      priceUsd: coin.priceUsd,
      ...(leverage > 1 ? {leverage} : {}),
      createdAt: coin.updatedAt,
    };

    db.trades[coin.id] = [trade, ...(db.trades[coin.id] || [])].slice(0, 50);
    saveDb();

    return res.status(201).json({coin, trade, state: db});
  });

  // Update project details or official publish state
  app.patch('/api/projects/:id', (req, res) => {
    const {id} = req.params;
    const idx = db.projects.findIndex((p) => p.id === id);
    if (idx === -1) {
      return res.status(404).json({error: 'Project not found.'});
    }

    const name = sanitizeText(req.body?.name, 60);
    const tagline = sanitizeText(req.body?.tagline, 120);
    const description = sanitizeText(req.body?.description, 800);
    const creatorName = sanitizeText(req.body?.creatorName, 60);
    const creatorHandle = sanitizeText(req.body?.creatorHandle, 40);
    const officialPublished = req.body?.officialPublished;

    if (name && name.length < 2) {
      return res.status(400).json({error: 'Project name must be at least 2 characters.'});
    }

    db.projects[idx] = {
      ...db.projects[idx],
      ...(name ? {name} : {}),
      ...(tagline ? {tagline} : {}),
      ...(description ? {description} : {}),
      ...(creatorName ? {creatorName} : {}),
      ...(creatorHandle
        ? {creatorHandle: creatorHandle.startsWith('@') ? creatorHandle : `@${creatorHandle}`}
        : {}),
      ...(typeof officialPublished === 'boolean' ? {officialPublished} : {}),
      updatedAt: new Date().toISOString(),
    };
    saveDb();

    return res.json({project: db.projects[idx], state: db});
  });

  // Publish an official release note on a project
  app.post('/api/projects/:id/release', (req, res) => {
    const {id} = req.params;
    const project = db.projects.find((p) => p.id === id);
    if (!project) {
      return res.status(404).json({error: 'Project not found.'});
    }
    const version = sanitizeText(req.body?.version, 24) || `v1.${project.updates.length + 1}`;
    const note =
      sanitizeText(req.body?.note, 300) || 'Official production release verified on Klyro.';

    project.officialPublished = true;
    project.verified = true;
    project.updates = [{version, date: 'Just now', note}, ...(project.updates || [])].slice(0, 20);
    project.updatedAt = new Date().toISOString();
    saveDb();

    return res.status(201).json({project, state: db});
  });

  // Delete project from Studio My Projects
  app.delete('/api/projects/:id', (req, res) => {
    const {id} = req.params;
    const target = db.projects.find((p) => p.id === id);
    if (!target) {
      return res.status(404).json({error: 'Project not found.'});
    }
    db.projects = db.projects.filter((p) => p.id !== id);
    if (target.coinId) {
      db.coins = db.coins.filter((c) => c.id !== target.coinId);
      delete db.trades[target.coinId];
    }
    delete db.savedIds[id];
    delete db.likedIds[id];
    saveDb();
    return res.json({ok: true, state: db});
  });

  // Increment views on detail open
  app.post('/api/projects/:id/view', (req, res) => {
    const {id} = req.params;
    const project = db.projects.find((p) => p.id === id);
    if (!project) {
      return res.status(404).json({error: 'Project not found.'});
    }
    project.views += 1;
    saveDb();
    return res.json({views: project.views});
  });

  // Toggle save / like on a project
  app.post('/api/projects/:id/engage', (req, res) => {
    const {id} = req.params;
    const action = req.body?.action;
    const project = db.projects.find((p) => p.id === id);
    if (!project) {
      return res.status(404).json({error: 'Project not found.'});
    }
    if (action === 'save') {
      const next = !db.savedIds[id];
      db.savedIds[id] = next;
      saveDb();
      return res.json({saved: next, state: db});
    }
    if (action === 'like') {
      const next = !db.likedIds[id];
      db.likedIds[id] = next;
      project.likes = Math.max(0, project.likes + (next ? 1 : -1));
      saveDb();
      return res.json({liked: next, likes: project.likes, state: db});
    }
    return res.status(400).json({error: 'Invalid engagement action.'});
  });

  // Post a comment
  app.post('/api/projects/:id/comments', (req, res) => {
    const {id} = req.params;
    const project = db.projects.find((p) => p.id === id);
    if (!project) {
      return res.status(404).json({error: 'Project not found.'});
    }
    const body = sanitizeText(req.body?.body, 500);
    if (!body) {
      return res.status(400).json({error: 'Comment cannot be empty.'});
    }

    const comment = {
      id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      projectId: id,
      authorUid: sanitizeText(req.body?.authorUid, 128) || 'guest',
      author: sanitizeText(req.body?.author, 60) || db.settings.displayName || 'Klyro Member',
      handle: sanitizeText(req.body?.handle, 40) || db.settings.creatorHandle || '@klyro_member',
      timeAgo: 'Just now',
      body,
      createdAt: new Date().toISOString(),
    };
    project.comments = [comment, ...project.comments];
    saveDb();
    return res.status(201).json({comment, state: db});
  });

  // Follow / unfollow creator
  app.post('/api/creators/follow', (req, res) => {
    const handle = sanitizeText(req.body?.handle, 50);
    if (!handle) {
      return res.status(400).json({error: 'Creator handle is required.'});
    }
    db.followingHandles[handle] = !db.followingHandles[handle];
    saveDb();
    return res.json({following: db.followingHandles[handle], state: db});
  });

  // Join / leave community collective
  app.post('/api/communities/join', (req, res) => {
    const name = sanitizeText(req.body?.name, 80);
    if (!name) {
      return res.status(400).json({error: 'Community name is required.'});
    }
    db.joinedCommunities[name] = !db.joinedCommunities[name];
    saveDb();
    return res.json({joined: db.joinedCommunities[name], state: db});
  });

  // Mark learn guide read/unread
  app.post('/api/learn/toggle', (req, res) => {
    const guideNumber = sanitizeText(req.body?.number, 10);
    if (!guideNumber) {
      return res.status(400).json({error: 'Guide number is required.'});
    }
    db.completedGuides[guideNumber] = !db.completedGuides[guideNumber];
    saveDb();
    return res.json({completed: db.completedGuides[guideNumber], state: db});
  });

  // Update Studio & Profile settings
  app.patch('/api/settings', (req, res) => {
    const displayName = sanitizeText(req.body?.displayName, 60);
    const creatorHandle = sanitizeText(req.body?.creatorHandle, 40);
    const bio = sanitizeText(req.body?.bio, 240);
    const photoURL = sanitizeText(req.body?.photoURL, 500);
    const profileRim = req.body?.profileRim as ProfileRimId | undefined;
    const proEnabled = req.body?.proEnabled;
    const sandboxBalanceUsd = req.body?.sandboxBalanceUsd;
    const demoWalletConnected = req.body?.demoWalletConnected;
    const theme = req.body?.theme === 'dark' ? 'dark' : req.body?.theme === 'light' ? 'light' : undefined;

    if (req.body?.displayName !== undefined && displayName.length < 2) {
      return res.status(400).json({error: 'Display name must be at least 2 characters.'});
    }

    db.settings = {
      ...db.settings,
      ...(displayName ? {displayName} : {}),
      ...(creatorHandle
        ? {creatorHandle: creatorHandle.startsWith('@') ? creatorHandle : `@${creatorHandle}`}
        : {}),
      ...(req.body?.bio !== undefined ? {bio} : {}),
      ...(req.body?.photoURL !== undefined ? {photoURL} : {}),
      ...(profileRim && VALID_PROFILE_RIM_IDS.includes(profileRim) ? {profileRim} : {}),
      ...(theme ? {theme} : {}),
      ...(typeof proEnabled === 'boolean' ? {proEnabled} : {}),
      ...(typeof sandboxBalanceUsd === 'number' &&
      Number.isFinite(sandboxBalanceUsd) &&
      sandboxBalanceUsd >= 0 &&
      sandboxBalanceUsd <= 10_000_000
        ? {sandboxBalanceUsd}
        : {}),
      ...(typeof demoWalletConnected === 'boolean' ? {demoWalletConnected} : {}),
    };
    saveDb();
    return res.json({settings: db.settings, state: db});
  });

  if (process.env.NODE_ENV !== 'production') {
    const {createServer: createViteServer} = await import('vite');
    const vite = await createViteServer({
      server: {middlewareMode: true},
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`KLYRO server running on http://localhost:${port}`);
  });
}

void startServer();
