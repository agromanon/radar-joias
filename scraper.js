#!/usr/bin/env node
/**
 * Vitrine de Joias Scraper
 * ========================
 * Usage:
 *   node scraper.js --mode=states-cities
 *   node scraper.js --mode=bid-periods
 *   node scraper.js --mode=active-lots
 *   node scraper.js --mode=results
 *   node scraper.js --mode=edital --auction-code="119/2026"
 *
 * Environment variables required in .env:
 *   SUPABASE_URL=https://your-project.supabase.co
 *   SUPABASE_SERVICE_KEY=your-service-role-key
 *   LLM_API_KEY=your-anthropic-or-openai-key
 *   LLM_PROVIDER=anthropic|openai  (default: anthropic)
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { proxiedFetch } from './http-proxy-utils.js';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { llmCall } from './llm-gateway.js';
import sharp from 'sharp';
import { Readable } from 'node:stream';

// Load .env
config();

// ============================================================
// CONFIG
// ============================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const LLM_API_KEY = process.env.LLM_API_KEY;
const LLM_PROVIDER = process.env.LLM_PROVIDER ?? 'anthropic';

const API_BASE = 'https://servicebus2.caixa.gov.br/vitrinedejoias/api';
const IMG_BASE = 'https://servicebus2.caixa.gov.br/vitrinearquivos/fotos';

const STANDARD_HEADERS = {
  accept: 'application/json, text/plain, */*',
  'accept-language': 'pt-BR,pt;q=0.9,en;q=0.8',
  origin: 'https://vitrinedejoias.caixa.gov.br',
  referer: 'https://vitrinedejoias.caixa.gov.br/',
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-site',
};

const BATCH_SIZE = 81; // API max items per page

// ============================================================
// INIT
// ============================================================

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

// ============================================================
// IMAGE DOWNLOAD + OPTIMIZE + UPLOAD
// ============================================================

const STORAGE_BUCKET = 'lot-images';

/**
 * Download image from CAIXA, optimize with sharp, upload to Supabase storage.
 * Returns the public URL of the uploaded image, or null on failure.
 * Retries up to 3 times on non-ok responses (404, 500, etc.) since CAIXA can be flaky.
 */
async function downloadOptimizeUpload(imgUrl, lotId, imageType) {
  if (!imgUrl) return null;
  // CAIXA changed image base from /vitrinedejoias to /vitrinearquivos/fotos
  if (imgUrl.includes('servicebus2.caixa.gov.br/vitrinedejoias/')) {
    imgUrl = imgUrl.replace('servicebus2.caixa.gov.br/vitrinedejoias/', 'servicebus2.caixa.gov.br/vitrinearquivos/fotos/');
  }

  const MAX_RETRIES = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await proxiedFetch(imgUrl, {
        headers: {
          ...STANDARD_HEADERS,
          referer: 'https://vitrinedejoias.caixa.gov.br/',
        },
      });

      if (!res.ok) {
        if (attempt < MAX_RETRIES) {
          console.warn(`  [img] HTTP ${res.status} for ${imgUrl}, retrying (${attempt}/${MAX_RETRIES})...`);
          await sleep(2000);
          continue;
        }
        console.warn(`  [img] HTTP ${res.status} for ${imgUrl} — giving up after ${MAX_RETRIES} attempts`);
        return null;
      }

      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Convert to WebP, resize max 800x800, quality 85 (better than JPEG at same size)
      const optimized = await sharp(buffer)
        .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();

      const path = `lots/${lotId}/${imageType}.webp`;

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, optimized, {
          contentType: 'image/webp',
          upsert: true,
        });

      if (uploadError) {
        console.warn(`  [img] upload failed for ${imageType}: ${uploadError.message}`);
        return null;
      }

      const { data: urlData } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(path);

      return urlData.publicUrl;
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES) {
        console.warn(`  [img] failed ${imgUrl} (attempt ${attempt}/${MAX_RETRIES}): ${err.message}, retrying...`);
        await sleep(2000);
      }
    }
  }

  console.warn(`  [img] giving up after ${MAX_RETRIES} attempts: ${lastError?.message}`);
  return null;
}

// ============================================================
// FETCH HELPERS
// ============================================================

async function apiFetch(endpoint, params = {}) {
  const url = new URL(`${API_BASE}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  });

  let attempt = 0;
  while (attempt < 3) {
    const res = await proxiedFetch(url.toString(), { headers: STANDARD_HEADERS });
    if (res.status === 429) {
      attempt++;
      const wait = attempt * 60_000;
      console.warn(`  Rate limited, waiting ${wait}ms...`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`API ${res.status} for ${url}: ${body.slice(0, 200)}`);
    }
    return res.json();
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ============================================================
// PARSE HELPERS
// ============================================================

function parseMoney(str) {
  if (!str) return null;
  // "R$ 1.854,00" → 1854.00
  const cleaned = str.replace(/[R$\.\s]/g, '').replace(',', '.');
  return parseFloat(cleaned) || null;
}

function mapOutcomeStatus(situacao) {
  const map = {
    'Venda Direta': 'VENDIDO',
    '2ª Venda Direta': 'VENDIDO',
    'Encerrado': 'NÃO VENDIDO',
    'Suspenso': 'CANCELADO',
    'Lote Devolvido': 'DEVOLVIDO',
  };
  return map[situacao] ?? situacao;
}

function extractCategory(deContrato) {
  const text = (deContrato || '').toUpperCase();
  if (text.includes('RELOGIO') || text.includes('RELÓGIO')) return 'watch';
  if (text.includes('MOEDA') || text.includes('MOEDAS')) return 'coin';
  if (text.includes('COLAR') || text.includes('PULSEIRA') || text.includes('ANEL') ||
      text.includes('BRINCO') || text.includes('PENDENTE') || text.includes('ALIANÇA') ||
      text.includes('TERÇO') || text.includes('CORRENTE') || text.includes('BROCHE')) return 'jewelry';
  return 'other';
}

function extractLotFlags(deContrato) {
  const text = (deContrato || '').toUpperCase();
  const flags = [];
  const result = {
    has_enchimento: /ENCHIMENTO/i.test(text),
    has_low_karat: /OURO BAIXO/i.test(text) || /OURO 10K/i.test(text) || /OURO 12K/i.test(text),
    has_unvalued_stones: /NÃO PRECIFICAD/i.test(text) || /NAO PRECIFICAD/i.test(text) || /NÃO VALORIZAD/i.test(text),
    is_watch_stopped: /RELOGIO.*PARADO/i.test(text) || /RELÓGIO.*PARADO/i.test(text),
    is_broken: /PARTIDA|Partido/i.test(text),
    is_incomplete: /INCOMPLETA/i.test(text) || /FALTA\b/i.test(text),
    is_damaged: /AMASSADA/i.test(text) || /AMOLGADA/i.test(text) || /DEFEITO/i.test(text),
    has_mixed_metals: /METAL NÃO NOBRE/i.test(text) || /RESÍDUO COBRE/i.test(text) || /RESIDUO COBRE/i.test(text),
    is_folheado: /FOLHEADO/i.test(text),
    has_rhodium_plating: /OURO RODINADO/i.test(text),
    is_coin: /MOEDA/i.test(text),
    is_bar: /BARRA/i.test(text) && /OURO/i.test(text),
    is_watch: /RELOGIO/i.test(text) || /RELÓGIO/i.test(text),
    is_montblanc_pen: /MONTBLANC/i.test(text) || /CANETA.*BANC/i.test(text),
  };
  for (const [key, val] of Object.entries(result)) {
    if (val) flags.push(key.replace(/_/g, ' '));
  }
  result.flags_text = flags.length ? flags.join(', ') : null;
  return result;
}

function extractKarat(deContrato) {
  const text = (deContrato || '').toUpperCase();
  const karatMap = {
    'OURO 1,0': '24k', 'OURO 1,00': '24k',
    'OURO 0,750': '18k', 'OURO 0,75': '18k', 'OURO 18K': '18k', 'OURO 18K': '18k',
    'OURO 0,600': '14k', 'OURO 0,60': '14k', 'OURO 14K': '14k',
    'OURO 0,500': '12k', 'OURO 12K': '12k',
    'OURO 0,400': '10k', 'OURO 10K': '10k',
    'OURO BAIXO': '10k', 'OURO BAIXO,': '10k',
    'OURO BRANCO': null, // alloy, not a karat
    'PRATA 925': 'silver', 'PRATA': 'silver',
    'PALÁDIO': 'palladium', 'METAL NÃO NOBRE': 'base_metal',
  };
  for (const [keyword, karat] of Object.entries(karatMap)) {
    if (text.includes(keyword)) return karat;
  }
  return null;
}

// ============================================================
// PDF PARSING (Results PDF - plain text table)
// ============================================================

// Extract text from PDF buffer using pdfjs-dist
async function extractPdfText(pdfBuffer) {
  const data = new Uint8Array(pdfBuffer);
  const loadingTask = getDocument({
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true
  });
  const pdf = await loadingTask.promise;
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map(item => item.str).join(' ');
    fullText += pageText + '\n';
  }
  return fullText;
}

// Parse results PDF - extract lot numbers, winning bids, and buyer CPFs
// Handles two formats:
// 1. Results PDF (Relatório de Resultados por CPF/CNPJ): lot_number | value | tariff | total per buyer group
//    Example: "0061.000233-3   500,00   30,00   530,00"
// 2. Original local format: same pattern
function parseResultsPdfText(text, auctionCode) {
  const lots = [];

  // Pattern 1: standard table format (works for both formats)
  // lot_number followed by 3 values (lance, tarifa, total)
  // Example: "0061.000309-7   1.600,00   96,00   1.696,00"
  const lotPattern = /(\d{4}\.\d{6}-\d)\s+([\d\.]+,\d{2})\s+([\d\.]+,\d{2})\s+([\d\.]+,\d{2})/g;

  let match;
  const seenLots = new Set();
  while ((match = lotPattern.exec(text)) !== null) {
    const lot_number = match[1];
    // Avoid duplicates if same lot appears multiple times in PDF
    if (seenLots.has(lot_number)) continue;
    seenLots.add(lot_number);

    const lance = parseBrMoney(match[2]);
    const tarifa = parseBrMoney(match[3]);
    const total = parseBrMoney(match[4]);
    lots.push({
      lot_number,
      lance,
      tarifa,
      winning_bid: total,
      status: 'VENDIDO'
    });
  }

  return { auction_code: auctionCode, lots };
}

// Parse Brazilian money string "1.600,00" to number 1600.00
function parseBrMoney(str) {
  if (!str) return null;
  // Remove dots (thousands separator) and replace comma with decimal point
  const cleaned = str.replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned) || null;
}

function parseDate(str) {
  if (!str) return null;
  // DD/MM/YYYY → YYYY-MM-DD
  const m = str.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

function parseDeadlineDays(str) {
  if (!str) return null;
  // Extract first DD/MM/YYYY and return just the day count (difference from result date)
  // Or extract pure integer if it's just a number
  const intMatch = String(str).match(/^(\d+)$/);
  if (intMatch) return parseInt(intMatch[1]);
  // For date ranges like "18/06/2026 a 22/06/2026", extract first date
  const m = String(str).match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) {
    const start = new Date(`${m[3]}-${m[2]}-${m[1]}`);
    const end = new Date(`${m[3]}-${m[2]}-${m[1]}`);
    // For pickup deadline, just return the day from the first date
    return parseInt(m[1]);
  }
  return null;
}

// ============================================================
// DB UPSERTS
// ============================================================

async function upsertStates(statesList) {
  const rows = statesList.map(s => ({ uf: s.sigla ?? s.uf ?? s.sgUf, has_auctions: true }));
  const { error } = await supabase
    .from('states')
    .upsert(rows, { onConflict: 'uf', ignoreDuplicates: false });
  if (error) throw error;
  console.log(`  States upserted: ${rows.length}`);
}

async function getStateId(uf) {
  const { data } = await supabase.from('states').select('id').eq('uf', uf).single();
  return data?.id;
}

async function upsertCities(citiesList, stateId) {
  const rows = citiesList.map(c => ({
    state_id: stateId,
    name: c.nome ?? c.noCidade ?? c.nome,
    caixa_city_code: c.codigo ?? c.codigoCidade ?? c.coCidade,
  }));
  const { error } = await supabase
    .from('cities')
    .upsert(rows, { onConflict: 'caixa_city_code', ignoreDuplicates: false });
  if (error) throw error;
  console.log(`  Cities upserted: ${rows.length}`);
}

async function getAllCities() {
  const { data } = await supabase.from('cities').select('id, name, caixa_city_code, state_id').order('id');
  return data ?? [];
}

async function upsertBidPeriods(cityId, periods) {
  const today = new Date().toISOString().split('T')[0];
  const rows = periods.filter(p => p.inicioLance || p.dataInicio).map(p => ({
    city_id: cityId,
    start_date: p.inicioLance ?? p.dataInicio,
    end_date: p.fimLance ?? p.dataFim,
    is_active: (p.fimLance ?? p.dataFim) >= today,
  }));
  const { error } = await supabase
    .from('bid_periods')
    .upsert(rows, { onConflict: 'city_id,start_date', ignoreDuplicates: false });
  if (error) throw error;
  console.log(`  Bid periods upserted: ${rows.length}`);
}

async function getActiveBidPeriods() {
  // Fetch ALL periods (past and future) — results mode needs historical data too
  const { data } = await supabase
    .from('bid_periods')
    .select('id, city_id, start_date, end_date')
    .order('end_date', { ascending: false });
  return data ?? [];
}

async function getCityByCode(code) {
  const { data } = await supabase.from('cities').select('id, name').eq('caixa_city_code', code).single();
  return data;
}

// ============================================================
// MODE: STATES-CITIES
// ============================================================

async function modeStatesCities() {
  console.log('\n=== Mode: states-cities ===');
  const start = Date.now();

  // Step 1: States
  console.log('Fetching states...');
  const statesData = await apiFetch('/busca/ufs');
  const statesList = Array.isArray(statesData) ? statesData : (statesData.ufs ?? []);
  await upsertStates(statesList);

  // Step 2: Cities per state
  const states = await supabase.from('states').select('id, uf');
  for (const state of states.data ?? []) {
    console.log(`Fetching cities for ${state.uf}...`);
    await sleep(500); // be nice to the API
    const citiesData = await apiFetch(`/busca/cidades/${state.uf}`);
    const citiesList = Array.isArray(citiesData) ? citiesData : (citiesData?.cidades ?? []);
    await upsertCities(citiesList, state.id);
  }

  const ms = Date.now() - start;
  console.log(`Done in ${ms}ms`);
}

// ============================================================
// MODE: BID-PERIODS
// ============================================================

async function modeBidPeriods() {
  console.log('\n=== Mode: bid-periods ===');
  const start = Date.now();
  const cities = await getAllCities();

  for (const city of cities) {
    await sleep(300);
    try {
      const data = await apiFetch(`/busca/periodos/${city.caixa_city_code}`);
      const periods = Array.isArray(data) ? data : (data?.periodos ?? []);
      await upsertBidPeriods(city.id, periods);
    } catch (e) {
      console.error(`  Error for city ${city.caixa_city_code}: ${e.message}`);
    }
  }

  const ms = Date.now() - start;
  console.log(`Done in ${ms}ms`);
}

// ============================================================
// MODE: ACTIVE-LOTS
// ============================================================

async function scrapeLotsPage(cityCode, startDate, endDate, page) {
  return apiFetch('/busca/vitrine', {
    codigoDaCidade: cityCode,
    dataInicioLance: startDate,
    dataFimLance: endDate,
    pagina: page,
    quantidadeDeItens: BATCH_SIZE,
    valorMinimoVenda: 0,
    valorMaximoVenda: 0,
    numeroDoLoteOuContrato: '',
    campoDeOrdenacao: '',
    ordenacao: '',
  });
}

async function upsertLot(cityId, lot) {
  // Extract file IDs
  const arquivos = lot.arquivosPublicados ?? [];
  const editalFile = arquivos.find(a => a.tipoArquivo === 'Edital');
  const catalogoFile = arquivos.find(a => a.tipoArquivo === 'Catálogo Atualizado')
    ?? arquivos.find(a => a.tipoArquivo === 'Catálogo');

  // Image URLs — already stored with full CAIXA URL
  const row = {
    city_id: cityId,
    lot_number: lot.numeroDolote,
    contract_number: lot.nuContrato,
    co_leilao: lot.coLeilao,
    de_contrato: lot.deContrato,
    valor: parseMoney(lot.valor),
    sg_uf: lot.sgUf,
    pickup_location: lot.deLocalEndereco,
    url_imagem_capa: lot.urlImagemCapa || null,
    url_imagem_frente: lot.urlImagemFrente || null,
    url_imagem_verso: lot.urlImagemVerso || null,
    centralizer_code: lot.nuUnidade,
    centralizer_name: lot.noCentralizadora,
    api_id: lot.id,
    edital_id: editalFile?.nome ?? null,
    catalogo_id: catalogoFile?.nome ?? null,
    category: extractCategory(lot.deContrato),
    karat: extractKarat(lot.deContrato),
    last_seen_at: new Date().toISOString(),
    first_seen_at: new Date().toISOString(), // will not overwrite if exists due to upsert
  };

  // Add flags from description
  const flags = extractLotFlags(lot.deContrato);
  Object.assign(row, flags);

  // Check if lot already has stored images — skip re-download if already present
  const { data: existing } = await supabase
    .from('lots')
    .select('id, imagem_capa_url, imagem_frente_url, imagem_verso_url')
    .eq('city_id', cityId)
    .eq('lot_number', lot.numeroDolote)
    .maybeSingle();

  const lotId = existing?.id;

  const { error } = await supabase
    .from('lots')
    .upsert(row, { onConflict: 'city_id,lot_number', ignoreDuplicates: false });

  if (error) {
    console.error(`  Lot upsert error: ${error.message}`);
    return false;
  }

  // If lot is new (no existing record), download and upload images
  if (!lotId) {
    // Re-fetch to get the ID after insert
    const { data: inserted } = await supabase
      .from('lots')
      .select('id')
      .eq('city_id', cityId)
      .eq('lot_number', lot.numeroDolote)
      .maybeSingle();

    if (!inserted) return true;
    const newLotId = inserted.id;

    // Download, optimize and upload images in parallel
    const capaUrl = lot.urlImagemCapa ? `${IMG_BASE}${lot.urlImagemCapa}` : null;
    const frenteUrl = lot.urlImagemFrente ? `${IMG_BASE}${lot.urlImagemFrente}` : null;
    const versoUrl = lot.urlImagemVerso ? `${IMG_BASE}${lot.urlImagemVerso}` : null;

    const [imagemCapaUrl, imagemFrenteUrl, imagemVersoUrl] = await Promise.all([
      capaUrl ? downloadOptimizeUpload(capaUrl, newLotId, 'capa') : null,
      frenteUrl ? downloadOptimizeUpload(frenteUrl, newLotId, 'frente') : null,
      versoUrl ? downloadOptimizeUpload(versoUrl, newLotId, 'verso') : null,
    ]);

    // Update lot with storage URLs
    if (imagemCapaUrl || imagemFrenteUrl || imagemVersoUrl) {
      await supabase
        .from('lots')
        .update({
          imagem_capa_url: imagemCapaUrl,
          imagem_frente_url: imagemFrenteUrl,
          imagem_verso_url: imagemVersoUrl,
        })
        .eq('id', newLotId);
    }
  }

  return true;
}

async function modeActiveLots() {
  console.log('\n=== Mode: active-lots ===');
  const start = Date.now();
  const periods = await getActiveBidPeriods();
  const cities = await getAllCities();
  const cityMap = Object.fromEntries(cities.map(c => [c.id, c]));

  let totalNew = 0, totalUpdated = 0, totalErrors = 0;

  for (const period of periods) {
    const city = cityMap[period.city_id];
    if (!city) continue;

    console.log(`\n  City: ${city.name} (${city.caixa_city_code}), Period: ${period.start_date} → ${period.end_date}`);
    await sleep(300);

    let page = 1, totalItems = null, totalPages = null;

    while (true) {
      try {
        const data = await scrapeLotsPage(city.caixa_city_code, period.start_date, period.end_date, page);
        const lotes = Array.isArray(data?.lotes) ? data.lotes : [];
        const resTotal = data?.totalDeItens ?? data?.totalDeItensCatalogados ?? null;
        const resPages = data?.totalDePaginas ?? data?.quantidadeDePaginas ?? null;
        if (totalItems === null) {
          const rawPages = data.paginas ?? data.totalDePaginas;
          // paginas can be [1,2,3,4,5,6] (an array) or a number or a string "1,2,3,4,5,6"
          if (Array.isArray(rawPages)) {
            totalPages = rawPages.length;
          } else if (typeof rawPages === 'string' && rawPages.includes(',')) {
            totalPages = rawPages.split(',').length;
          } else {
            totalPages = parseInt(rawPages) || Math.ceil((data.totalRegistros ?? data.totalDeItens ?? lotes.length) / BATCH_SIZE);
          }
          totalItems = data.totalRegistros ?? data.totalDeItens ?? lotes.length;
          console.log(`    Total items: ${totalItems}, pages: ${totalPages}`);
        }

        if (lotes.length === 0) break;

        for (const lot of lotes) {
          const ok = await upsertLot(city.id, lot);
          if (ok) totalNew++;
          else totalErrors++;
        }

        totalUpdated += lotes.length;

        if (page >= totalPages || totalPages === 0) break;
        page++;
        await sleep(200);
      } catch (e) {
        console.error(`    Page error: ${e.message}`);
        totalErrors++;
        break;
      }
    }
  }

  const ms = Date.now() - start;
  console.log(`\nDone in ${ms}ms | new: ${totalNew}, updated: ${totalUpdated}, errors: ${totalErrors}`);
}

// ============================================================
// LLM PROVIDER CLIENT (from DB)
// ============================================================

let llmProviders = null;

async function loadLLMProviders() {
  if (llmProviders) return llmProviders;
  const { data } = await supabase
    .from('llm_providers')
    .select('*')
    .eq('is_active', true)
    .order('priority', { ascending: true });
  llmProviders = data ?? [];
  return llmProviders;
}

async function callLLMProvider(prompt, base64Pdf = null) {
  const providers = await loadLLMProviders();
  if (!providers.length) throw new Error('No active LLM providers configured');

  let lastError = new Error();
  for (const provider of providers) {
    try {
      const p = provider;
      if (p.provider_type === 'openai_compatible') {
        // Works for MiniMax and OpenAI-compatible endpoints
        const baseUrl = p.base_url || 'https://api.minimax.io/v1';
        const messages = base64Pdf
          ? [
              { role: 'user', content: [
                  { type: 'text', text: prompt },
                  { type: 'image_url', image_url: { url: `data:application/pdf;base64,${base64Pdf}` }}
                ]}
            ]
          : [{ role: 'user', content: prompt }];

        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${p.api_key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: p.model, messages, max_tokens: p.max_tokens || 4096, temperature: p.temperature || 0.7 })
        });
        if (!response.ok) throw new Error(`LLM API error ${response.status}: ${await response.text()}`);
        const data = await response.json();
        return data.choices?.[0]?.message?.content || '';
      } else {
        // Anthropic (using image_url for MiniMax compatibility)
        const baseUrl = p.base_url || 'https://api.anthropic.com';
        const messages = base64Pdf
          ? [
              { role: 'user', content: [
                  { type: 'image_url', image_url: { url: `data:application/pdf;base64,${base64Pdf}` }},
                  { type: 'text', text: prompt }
                ]}
            ]
          : [{ role: 'user', content: prompt }];
        const response = await fetch(`${baseUrl}/v1/messages`, {
          method: 'POST',
          headers: { 'x-api-key': p.api_key, 'content-type': 'application/json', 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: p.model, max_tokens: p.max_tokens || 4096, messages })
        });
        if (!response.ok) throw new Error(`Anthropic API error ${response.status}: ${await response.text()}`);
        const data = await response.json();
        // Handle MiniMax thinking blocks — find the text block
        const textBlock = data.content?.find(c => c.type === 'text');
        return textBlock?.text || '';
      }
    } catch (e) {
      lastError = e;
      if (!provider.is_fallback) break; // non-fallback: fail fast
    }
  }
  throw lastError;
}

// ============================================================
// MODE: RESULTS
// ============================================================

async function modeResults() {
  console.log('\n=== Mode: results ===');
  const start = Date.now();

  let totalUpdated = 0, totalErrors = 0;

  try {
    // Fetch results per-city using the per-city endpoint (codigoDaCidade)
    const cities = await getAllCities();

    for (const city of cities) {
      await sleep(300);
      try {
        // Per-city results API
        const data = await apiFetch('/busca/resultados-leiloes', {
          codigoDaCidade: city.caixa_city_code,
          dataFimLance: '',
          dataInicioLance: '',
          numeroDoLoteOuContrato: '',
        });

        const rows = Array.isArray(data) ? data : (data?.resultados ?? data?.items ?? []);

        if (!rows.length) continue;
        console.log(`  ${city.name} (${city.caixa_city_code}): ${rows.length} completed auction(s)`);

        for (const row of rows) {
          const coLeilao = row.coLeilao;
          const arquivos = row.arquivosPublicados ?? [];
          const relatorioFile = arquivos.find(a => a.tipoArquivo === 'Relatório de Resultados por CPF/CNPJ');
          const catAtualizadoFile = arquivos.find(a => a.tipoArquivo === 'Catálogo Atualizado');

          // Find all lots for this auction
          const { data: matchedLots } = await supabase
            .from('lots')
            .select('id, co_leilao, outcome_status, auction_id')
            .eq('co_leilao', coLeilao);

          if (!matchedLots?.length) {
            console.log(`    ${coLeilao}: no lots in DB`);
            continue;
          }

          const matchedLot = matchedLots[0];
          const outcomeStatus = mapOutcomeStatus(row.situacao);
          const winningBid = parseMoney(row.valorVenda);

          // Try PDF parsing if available (but handle 404 gracefully)
          let pdfExtracted = false;
          if (relatorioFile || catAtualizadoFile) {
            const fileToTry = relatorioFile || catAtualizadoFile;
            try {
              const pdfBuffer = await downloadPdf(fileToTry.nome, fileToTry.tipoArquivo);
              const text = await extractPdfText(pdfBuffer);
              const extracted = parseResultsPdfText(text, coLeilao);

              if (extracted.lots && Array.isArray(extracted.lots) && extracted.lots.length > 0) {
                for (const lotResult of extracted.lots) {
                  const { error } = await supabase
                    .from('lots')
                    .update({
                      outcome_status: 'VENDIDO',
                      winning_bid_value: lotResult.winning_bid,
                      tarifa_arrematacao: lotResult.tarifa,
                      valor_venda: lotResult.winning_bid,
                      was_sold: true,
                      outcome_scrape_date: new Date().toISOString(),
                    })
                    .eq('co_leilao', coLeilao)
                    .eq('lot_number', lotResult.lot_number || lotResult.numeroDolote);
                  if (!error) totalUpdated++;
                }
                // Update auction record
                if (matchedLot.auction_id) {
                  await supabase.from('auctions').update({
                    has_catalogo_atualizado: !!catAtualizadoFile,
                    catalogo_atualizado_url: catAtualizadoFile?.nome,
                    result_date: row.dtFim ? row.dtFim.split('/').reverse().join('-') : null,
                  }).eq('id', matchedLot.auction_id);
                }
                pdfExtracted = true;
                console.log(`    ${coLeilao}: PDF parsed ${extracted.lots.length} lots`);
              } else {
                console.log(`    ${coLeilao}: PDF parsed no lots, will use fallback`);
              }
            } catch (e) {
              // PDF 404 = expired/archive unavailable — skip, fall back to basic update
              if (e.message.includes('404')) {
                console.log(`    ${coLeilao}: result PDF expired/unavailable`);
              } else {
                console.log(`    ${coLeilao}: PDF parsing failed: ${e.message}`);
              }
            }
          }

          // Fallback: update all lots for this auction with basic info from results list
          if (!pdfExtracted) {
            for (const lot of matchedLots) {
              const { error } = await supabase
                .from('lots')
                .update({
                  outcome_status: outcomeStatus,
                  winning_bid_value: winningBid,
                  outcome_scrape_date: new Date().toISOString(),
                })
                .eq('id', lot.id);
              if (!error) totalUpdated++;
            }
          }

          // Upsert auction record
          if (matchedLot.auction_id) {
            await supabase.from('auctions').upsert({
              id: matchedLot.auction_id,
              auction_code: coLeilao,
              co_leilao: coLeilao,
              result_date: row.dtFim ? row.dtFim.split('/').reverse().join('-') : null,
              no_unidade: row.noUnidade,
              has_catalogo_atualizado: !!catAtualizadoFile,
              catalogo_atualizado_url: catAtualizadoFile?.nome || null,
            }, { onConflict: 'id', ignoreDuplicates: true });
          }
        }
      } catch (e) {
        console.error(`  City ${city.name} error: ${e.message}`);
        totalErrors++;
      }
    }
  } catch (e) {
    console.error(`  Results API error: ${e.message}`);
    totalErrors++;
  }

  const ms = Date.now() - start;
  console.log(`\nDone in ${ms}ms | updated: ${totalUpdated}, errors: ${totalErrors}`);
}

async function extractResultsWithLLM(base64, auctionCode) {
  const prompt = `Você está analisando um Relatório de Resultados de Leilão de Joias da CAIXA.
Para cada lote no relatório, extraia:
- numero do lote (lot_number)
- nome/descrição do item (se disponível)
- valor de venda (winning_bid) - valor pelo qual foi vendido, ou o lance mais alto
- status: "VENDIDO" se foi arrematado, "CANCELADO" se cancelado, "NÃO VENDIDO" se não teve lance

Retorne APENAS um JSON válido com este formato, sem texto adicional:
{
  "auction_code": "${auctionCode}",
  "lots": [
    {"lot_number": "001", "winning_bid": 5000, "status": "VENDIDO"},
    {"lot_number": "002", "winning_bid": 3500, "status": "VENDIDO"}
  ]
}`;

  const text = await callLLMProvider(prompt, base64);
  try {
    // Try to extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return {};
  } catch {
    throw new Error(`Failed to parse LLM response: ${text.substring(0, 200)}`);
  }
}

// ============================================================
// MODE: EDITAL (LLM Processing)
// ============================================================

async function downloadPdf(fileId, fileName, retries = 3) {
  const nome = encodeURIComponent(fileName || 'Relatório');
  const url = `${API_BASE}/cronograma/download?documento=${fileId}&nome=${nome}`;
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await proxiedFetch(url, { headers: { ...STANDARD_HEADERS, 'accept': '*/*', 'referer': 'https://vitrinedejoias.caixa.gov.br/' } });
      if (res.ok) return res.arrayBuffer();
      lastError = `HTTP ${res.status}`;
      // Only retry on 404 or 5xx
      if (res.status < 400 || res.status >= 600) break;
    } catch (e) {
      lastError = e.message;
    }
    if (attempt < retries) {
      await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
  throw new Error(`PDF download failed after ${retries} attempts: ${lastError}`);
}

async function extractEditalWithLLM(pdfBuffer, auctionCode) {
  // Extract plain text from PDF using pdfjs-dist
  const text = await extractPdfText(pdfBuffer);

  const prompt = `Você é um especialista em extrair informações de editais de leilão de joias da CAIXA.
Analise o texto do Edital abaixo e extraia os dados em JSON. Responda APENAS com JSON válido, sem texto adicional.

Campos necessários: payment_method, penalty_clause, pickup_deadline_days, payment_deadline_days, centralizer_unit, gilie_code, contact_email, bid_increment_rule, city_name, auction_code, result_date.

Texto do Edital:
${text.substring(0, 12000)}

Extração JSON:`;

  const result = await llmCall('edital', null, prompt);

  try {
    // Strip markdown code blocks if present
    let jsonStr = result.content.trim();
    // Handle ```json ... ``` or plain JSON
    const codeBlockMatch = jsonStr.match(/```json\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1];
    } else {
      // Strip any leading text before the first {
      const firstBrace = jsonStr.indexOf('{');
      if (firstBrace > 0) jsonStr = jsonStr.substring(firstBrace);
    }
    const parsed = JSON.parse(jsonStr);
    // Flatten: top-level fields OR nested inside .edital
    const flat = {};
    const src = parsed.payment_method ? parsed : (parsed.edital ?? parsed);
    for (const key of ['payment_method','penalty_clause','pickup_deadline_days','payment_deadline_days','centralizer_unit','gilie_code','contact_email','bid_increment_rule','city_name','auction_code','result_date','centralizadora']) {
      if (src[key] !== undefined) flat[key] = src[key];
    }
    return flat;
  } catch (e) {
    throw new Error(`Failed to parse LLM response as JSON: ${result.content.substring(0, 200)}`);
  }
}

async function modeEdital(auctionCode) {
  if (!auctionCode) {
    console.error('ERROR: --auction-code required for edilal mode');
    process.exit(1);
  }

  console.log(`\n=== Mode: edilal for ${auctionCode} ===`);
  const start = Date.now();

  // Find any lot from this auction that has an edilal file
  const { data: lotsWithEdital } = await supabase
    .from('lots')
    .select('edital_id, city_id, co_leilao')
    .eq('co_leilao', auctionCode)
    .not('edital_id', 'is', null)
    .limit(1);

  let edilalId = lotsWithEdital?.[0]?.edital_id ?? null;
  let auctionCityId = null;

  // Fallback: fetch edilal_pdf_url directly from auctions table
  if (!edilalId) {
    const { data: auctionRow } = await supabase
      .from('auctions')
      .select('edital_pdf_url, city_id')
      .eq('auction_code', auctionCode)
      .single();
    edilalId = auctionRow?.edital_pdf_url ?? null;
    auctionCityId = auctionRow?.city_id ?? null;
  }

  if (!edilalId) {
    console.log('No edilal found for this auction. Run active-lots first.');
    return;
  }
  console.log(`Downloading edilal: ${edilalId}`);

  const pdfBuffer = await downloadPdf(edilalId, 'Edital');
  const extracted = await extractEditalWithLLM(pdfBuffer, auctionCode);
  console.log('LLM extracted:', JSON.stringify(extracted, null, 2));

  // Map cidade to city_id
  const cidadeMatch = extracted.city_name ?? extracted.centralizer_unit;
  let cityId = lotsWithEdital?.[0]?.city_id ?? auctionCityId ?? null;
  if (cidadeMatch) {
    const { data: cityRow } = await supabase
      .from('cities')
      .select('id')
      .ilike('name', `%${cidadeMatch}%`)
      .single();
    if (cityRow) cityId = cityRow.id;
  }

  // Upsert auction and get back the actual ID
  // First try to UPDATE existing row by auction_code (do NOT change auction_code)
  const { data: auctionRow2, error: auctionError } = await supabase
    .from('auctions')
    .update({
      city_id: cityId,
      co_leilao: auctionCode,
      result_date: extracted.result_date ? parseDate(extracted.result_date) : null,
      bid_increment_rule: extracted.bid_increment_rule,
      payment_method: extracted.payment_method,
      payment_deadline_days: parseDeadlineDays(extracted.payment_deadline_days),
      pickup_deadline_days: parseDeadlineDays(extracted.pickup_deadline_days),
      penalty_clause: extracted.penalty_clause,
      centralizer_unit: extracted.centralizer_unit,
      gilie_code: extracted.gilie_code,
      contact_email: extracted.contact_email,
      edilal_processed: true,
      edilal_processed_at: new Date().toISOString(),
    })
    .eq('auction_code', auctionCode)
    .select('id')
    .single();

  // If no existing row, insert new one
  if (auctionError || !auctionRow2) {
    const { data: newRow, error: insertError } = await supabase
      .from('auctions')
      .insert({
        auction_code: auctionCode,
        co_leilao: auctionCode,
        city_id: cityId,
        result_date: extracted.result_date ? parseDate(extracted.result_date) : null,
        bid_increment_rule: extracted.bid_increment_rule,
        payment_method: extracted.payment_method,
        payment_deadline_days: parseDeadlineDays(extracted.payment_deadline_days),
        pickup_deadline_days: parseDeadlineDays(extracted.pickup_deadline_days),
        penalty_clause: extracted.penalty_clause,
        centralizer_unit: extracted.centralizer_unit,
        gilie_code: extracted.gilie_code,
        contact_email: extracted.contact_email,
        edilal_processed: true,
        edilal_processed_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (insertError) throw insertError;
  }

  // Link all lots to this auction
  const auctionId = auctionRow2?.id ?? newRow?.id;
  if (auctionId) {
    await supabase
      .from('lots')
      .update({ auction_id: auctionId })
      .eq('co_leilao', auctionCode);
  }

  const ms = Date.now() - start;
  console.log(`Done in ${ms}ms`);
}

// Load .env
config();

async function modeDedup() {
  console.log('\n=== Mode: dedup ===');
  const start = Date.now();

  let fixedCoLeilao = 0;
  let deletedDupes = 0;

  // 1. Fix bad co_leilao format (XXX:2026/undefined → X/2026)
  const { data: badFormatLots } = await supabase
    .from('lots')
    .select('id, co_leilao')
    .like('co_leilao', '%:2026%');

  if (badFormatLots?.length) {
    console.log(`  Found ${badFormatLots.length} rows with bad co_leilao format`);
    for (const row of badFormatLots) {
      const match = row.co_leilao.match(/^(\d+):2026\/undefined$/);
      if (match) {
        const fixed = `${parseInt(match[1], 10)}/2026`;
        await supabase.from('lots').update({ co_leilao: fixed }).eq('id', row.id);
        fixedCoLeilao++;
      }
    }
    console.log(`  Fixed ${fixedCoLeilao} co_leilao values`);
  }

  // 2. Delete exact duplicates (same lot_number + co_leilao), keeping row with most non-null fields
  // Use paginated fetch to handle large datasets
  let page = 0;
  const PAGE_SIZE = 5000;
  const allLots = [];

  while (true) {
    const { data: batch } = await supabase
      .from('lots')
      .select('id, lot_number, co_leilao, de_contrato, valor, url_imagem_capa, outcome_status, winning_bid_value, created_at')
      .order('id')
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (!batch?.length) break;
    allLots.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    page++;
  }

  if (allLots.length) {
    const groups = new Map();
    for (const lot of allLots) {
      const key = `${lot.lot_number}::${lot.co_leilao}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(lot);
    }

    let dupeGroups = 0;
    for (const [, rows] of groups) {
      if (rows.length > 1) {
        dupeGroups++;
        const scored = rows.map(r => ({
          id: r.id,
          score: [r.de_contrato, r.valor, r.url_imagem_capa, r.outcome_status, r.winning_bid_value]
            .filter(Boolean).length,
          created_at: r.created_at,
        }));
        scored.sort((a, b) => b.score - a.score || new Date(a.created_at) - new Date(b.created_at));
        const keepId = scored[0].id;
        for (const s of scored) {
          if (s.id !== keepId) {
            await supabase.from('lots').delete().eq('id', s.id);
            deletedDupes++;
          }
        }
      }
    }
    console.log(`  Found ${dupeGroups} duplicate groups, deleted ${deletedDupes} duplicate rows`);
  }

  // 3. Fix orphaned lots: create auction records for co_leilao values not in auctions table
  const { data: auctionCodes } = await supabase.from('auctions').select('auction_code');
  const validCodes = new Set((auctionCodes || []).map(a => a.auction_code));

  const { data: allOrphanRows } = await supabase
    .from('lots')
    .select('id, lot_number, co_leilao')
    .not('co_leilao', 'is', null);

  const orphans = (allOrphanRows || []).filter(r => !validCodes.has(r.co_leilao));
  if (orphans.length) {
    console.log(`  WARNING: ${orphans.length} lots have co_leilao not in auctions table — creating auction stubs`);
    const orphanCodes = [...new Set(orphans.map(o => o.co_leilao))];
    let created = 0;
    for (const code of orphanCodes) {
      const { data: existing } = await supabase
        .from('auctions')
        .select('id')
        .eq('auction_code', code)
        .maybeSingle();
      if (!existing) {
        await supabase.from('auctions').insert({ auction_code: code, co_leilao: code });
        created++;
      }
    }
    console.log(`  Created ${created} missing auction records`);
  } else {
    console.log(`  All lots linked to valid auctions`);
  }

  const ms = Date.now() - start;
  console.log(`\nDone in ${ms}ms | co_leilao fixed: ${fixedCoLeilao}, duplicates deleted: ${deletedDupes}`);
}

// ============================================================
// MODE: DISCOVER
// Discovers all auction codes (completed + future) across all cities.
// Stores/updates auction records with metadata and file references.
// ============================================================

async function modeDiscover() {
  console.log('\n=== Mode: discover ===');
  const start = Date.now();

  const cities = await getAllCities();
  console.log(`  Discovering auctions across ${cities.length} cities...`);

  let totalAuctions = 0;
  let newAuctions = 0;

  for (const city of cities) {
    await sleep(300);

    // 1. Completed auctions from results endpoint
    try {
      const resultsData = await apiFetch('/busca/resultados-leiloes', {
        codigoDaCidade: city.caixa_city_code,
        dataFimLance: '',
        dataInicioLance: '',
        numeroDoLoteOuContrato: '',
      });

      const completedAuctions = Array.isArray(resultsData) ? resultsData : [];
      if (completedAuctions.length) {
        console.log(`  ${city.name} (${city.caixa_city_code}): ${completedAuctions.length} completed auction(s)`);
      }

      for (const auction of completedAuctions) {
        const coLeilao = auction.coLeilao;
        const resultDate = auction.dtFim ? auction.dtFim.split('/').reverse().join('-') : null;
        const arquivos = auction.arquivosPublicados ?? [];
        const relatorioFile = arquivos.find(a => a.tipoArquivo === 'Relatório de Resultados por CPF/CNPJ');
        const catFile = arquivos.find(a => a.tipoArquivo === 'Catálogo Atualizado');
        const editalFile = arquivos.find(a => a.tipoArquivo === 'Edital');

        const { data: existing } = await supabase
          .from('auctions')
          .select('id')
          .eq('auction_code', coLeilao)
          .maybeSingle();

        if (!existing) {
          const { error } = await supabase.from('auctions').insert({
            auction_code: coLeilao,
            co_leilao: coLeilao,
            city_id: city.id,
            result_date: resultDate,
            result_source: 'results_api',
            has_catalogo_atualizado: !!catFile,
            catalogo_atualizado_url: catFile?.nome ?? null,
            relatorio_url: relatorioFile?.nome ?? null,
            edital_pdf_url: editalFile?.nome ?? null,
            status: 'COMPLETED',
          });
          if (error) {
            console.error(`    Insert error for ${coLeilao}: ${error.message}`);
          } else {
            newAuctions++;
          }
        } else {
          const { error } = await supabase.from('auctions').update({
            city_id: city.id,
            result_date: resultDate,
            has_catalogo_atualizado: !!catFile,
            catalogo_atualizado_url: catFile?.nome ?? null,
            relatorio_url: relatorioFile?.nome ?? null,
            edital_pdf_url: editalFile?.nome ?? null,
            status: 'COMPLETED',
          }).eq('id', existing.id);
          if (error) console.error(`    Update error for ${coLeilao}: ${error.message}`);
        }
        totalAuctions++;
      }
    } catch (e) {
      console.error(`  ${city.name}: results error ${e.message}`);
    }

    // 2. Future auctions from bid periods
    try {
      const periodsData = await apiFetch(`/busca/periodos/${city.caixa_city_code}`);
      const periods = Array.isArray(periodsData) ? periodsData : (periodsData?.periodos ?? []);

      for (const period of periods) {
        const startDate = period.inicioLance ?? period.dataInicio;
        const endDate = period.fimLance ?? period.dataFim;
        if (!startDate) continue;

        // Look for auction codes in period data
        const coLeilao = period.coLeilao ?? period.co_leilao ?? null;
        if (coLeilao) {
          const { data: existing } = await supabase
            .from('auctions')
            .select('id')
            .eq('auction_code', coLeilao)
            .maybeSingle();

          if (!existing) {
            await supabase.from('auctions').insert({
              auction_code: coLeilao,
              co_leilao: coLeilao,
              city_id: city.id,
              bid_start_date: startDate,
              bid_end_date: endDate,
              status: 'FUTURE',
            });
            newAuctions++;
            totalAuctions++;
          }
        }
      }
    } catch (e) {
      // Periods may not exist for all cities - skip silently
    }
  }

  const ms = Date.now() - start;
  console.log(`\nDone in ${ms}ms | total auctions: ${totalAuctions}, new: ${newAuctions}`);
}

// ============================================================
// MODE: SCRAPE-LOTS
// Fetches lots for all discovered auctions.
// - Active/future: uses /busca/vitrine API
// - Completed: downloads and parses Catálogo Atualizado PDF
// ============================================================

async function scrapeLotsFromVitrine(cityCode, coLeilao, startDate, endDate) {
  let page = 1, totalItems = null;
  const allLots = [];

  while (true) {
    const data = await scrapeLotsPage(cityCode, startDate, endDate, page);
    const lotes = Array.isArray(data?.lotes) ? data.lotes : [];
    if (totalItems === null) {
      totalItems = data.totalRegistros ?? data.totalDeItens ?? 0;
    }

    if (lotes.length === 0) break;

    for (const lot of lotes) {
      allLots.push({ ...lot, _coLeilao: coLeilao ?? lot.coLeilao });
    }

    if (lotes.length < BATCH_SIZE) break;
    page++;
    await sleep(200);
  }

  return { lots: allLots, totalItems };
}

// Parse lot data from Catálogo Atualizado PDF (completed auction)
// Returns array of lot objects with lot_number, de_contrato, valor, peso_lote, sg_uf
function parseCatalogoPdfText(text) {
  const lots = [];

  // Catálogo format: "LOTE / CONTRATO   ANOTAÇÕES VALOR DESCRIÇÃO"
  // Example lines:
  // "0061.000003-9 / 0061.213.00002719-4 UM COLAR, UM PENDENTE... R$ 2.120,00"
  // Pattern: lot_number / contract_number description R$ valor

  // Split by lines that start with a lot number pattern
  const lines = text.split('\n');

  // Pattern to match lot line: LOTENUMBER / CONTRACT DESCRIPTION R$ X.XXX,XX
  // pdfjs-dist joins text items with spaces; text spans across page boundaries
  // Use [\s\S]*? (any char incl newlines) instead of .+? to handle multi-line descriptions
  // Lookahead (?=\s) ensures R$ price is at end of lot line without consuming trailing space
  const lotLinePattern = /(\d{4}\.\d{6}-\d)\s*\/\s*([\d\.]+[\d\-]*)\s+([\s\S]*?)\s+(R\$\s*\d{1,3}(?:\.\d{3})*,\d{2})(?=\s)/gm;

  let match;
  while ((match = lotLinePattern.exec(text)) !== null) {
    const lot_number = match[1];
    const contract = match[2];
    const description = match[3].trim();
    const valorStr = match[4];
    const valor = parseBrMoney(valorStr.replace('R$', '').trim());

    // Extract weight if present in description (e.g., "PESO LOTE: 4,70G" or "PESO LOTE: 4,70 G")
    // Handle formats: PESO LOTE: X,XXG, PESO: X,XXg, weight: X,XXgr, X,XX G
    const pesoMatch = description.match(/(?:PESO\s+LOTE[:\s]*|PESO[:\s]*|weight[:\s]*)([\d\.]+,\d{1,3})\s*(?:G(?:RAMAS?)?|GR)?/i)
      ?? description.match(/([\d\.]+,\d{1,3})\s*G(?:RAMAS?)?\b/i);

    lots.push({
      lot_number,
      contract_number: contract,
      de_contrato: description.substring(0, 200),
      valor,
      peso_lote: pesoMatch ? parseBrMoney(pesoMatch[1]) : null,
      category: extractCategory(description),
      karat: extractKarat(description),
    });
  }

  // Add flags to all parsed lots
  for (const lot of lots) {
    const f = extractLotFlags(lot.de_contrato);
    Object.assign(lot, f);
  }

  // Fallback: simple R$ pattern if above didn't work
  if (lots.length === 0) {
    const simplePattern = /(\d{4}\.\d{6}-\d)\s+([^\n]+?)(?:R\$\s*([\d\.]+,\d{2}))/g;
    while ((match = simplePattern.exec(text)) !== null) {
      const desc = match[2].trim();
      const f = extractLotFlags(desc);
      lots.push({
        lot_number: match[1],
        contract_number: null,
        de_contrato: desc.substring(0, 200),
        valor: parseBrMoney(match[3]),
        peso_lote: null,
        category: extractCategory(desc),
        karat: extractKarat(desc),
        ...f,
      });
    }
  }

  return lots;
}

async function modeScrapeLots() {
  console.log('\n=== Mode: scrape-lots ===');
  const start = Date.now();

  // Fetch all discovered auctions
  const { data: auctions } = await supabase
    .from('auctions')
    .select('id, auction_code, city_id, bid_start_date, bid_end_date, status, catalogo_atualizado_url')
    .order('status', { ascending: true });

  if (!auctions?.length) {
    console.log('  No auctions found. Run --mode=discover first.');
    return;
  }

  console.log(`  Found ${auctions.length} auctions to scrape`);

  const cities = await getAllCities();
  const cityMap = Object.fromEntries(cities.map(c => [c.id, c]));

  let totalNew = 0, totalUpdated = 0, totalPdfLots = 0;

  for (const auction of auctions) {
    const city = cityMap[auction.city_id];
    if (!city) continue;

    if (auction.status === 'COMPLETED' && auction.catalogo_atualizado_url) {
      // Download and parse Catálogo Atualizado PDF for completed auction
      console.log(`  ${auction.auction_code}: COMPLETED — parsing PDF`);
      try {
        const pdfBuffer = await downloadPdf(auction.catalogo_atualizado_url, 'Catalogo');
        const text = await extractPdfText(pdfBuffer);
        const pdfLots = parseCatalogoPdfText(text);

        if (pdfLots.length > 0) {
          console.log(`    PDF parsed ${pdfLots.length} lots from Catálogo`);
          totalPdfLots += pdfLots.length;

          // Upsert all lots from PDF
          const insertRows = pdfLots.map(l => ({
            lot_number: l.lot_number,
            contract_number: l.contract_number,
            co_leilao: auction.auction_code,
            de_contrato: l.de_contrato,
            valor: l.valor,
            peso_lote: l.peso_lote,
            category: l.category,
            karat: l.karat,
            city_id: city.id,
            sg_uf: city.name?.match(/\(([A-Z]{2})\)/)?.[1] ?? null,
            catalogo_id: auction.catalogo_atualizado_url,
            // Flags
            has_enchimento: l.has_enchimento ?? false,
            has_low_karat: l.has_low_karat ?? false,
            has_unvalued_stones: l.has_unvalued_stones ?? false,
            is_watch_stopped: l.is_watch_stopped ?? false,
            is_broken: l.is_broken ?? false,
            is_incomplete: l.is_incomplete ?? false,
            is_damaged: l.is_damaged ?? false,
            has_mixed_metals: l.has_mixed_metals ?? false,
            is_folheado: l.is_folheado ?? false,
            has_rhodium_plating: l.has_rhodium_plating ?? false,
            is_coin: l.is_coin ?? false,
            is_bar: l.is_bar ?? false,
            is_watch: l.is_watch ?? false,
            is_montblanc_pen: l.is_montblanc_pen ?? false,
            flags_text: l.flags_text ?? null,
          }));

          const { error } = await supabase.from('lots').upsert(insertRows, { onConflict: 'city_id,lot_number' });
          if (error) console.error(`  Upsert error: ${error.message}`);
          else totalNew += insertRows.length;
        }
      } catch (e) {
        console.log(`    PDF parse error: ${e.message}`);
      }
      await sleep(500);
    } else if (auction.status === 'FUTURE' || auction.status === 'ACTIVE') {
      // Fetch from vitrine API for active/future auctions
      const startDate = auction.bid_start_date ?? '';
      const endDate = auction.bid_end_date ?? '';

      if (!startDate) {
        console.log(`  ${auction.auction_code}: no bid dates, skipping`);
        continue;
      }

      console.log(`  ${auction.auction_code}: ${auction.status} — fetching from API`);
      await sleep(300);

      try {
        const { lots: apiLots, totalItems } = await scrapeLotsFromVitrine(
          city.caixa_city_code,
          auction.auction_code,
          startDate,
          endDate
        );

        let newCount = 0;
        for (const lot of apiLots) {
          const ok = await upsertLot(city.id, lot);
          if (ok) newCount++;
        }
        totalNew += newCount;
        totalUpdated += apiLots.length;
        console.log(`    ${apiLots.length} lots fetched (${newCount} new)`);
      } catch (e) {
        console.log(`    API error: ${e.message}`);
      }
    }
  }

  const ms = Date.now() - start;
  console.log(`\nDone in ${ms}ms | new: ${totalNew}, updated: ${totalUpdated}, from PDFs: ${totalPdfLots}`);
}

// ============================================================
// MODE: SCRAPE-RESULTS
// Downloads and parses result PDFs (Relatório de Resultados por CPF/CNPJ)
// for all completed auctions. Updates lots with winning bids and outcome status.
// ============================================================

async function modeScrapeResults() {
  console.log('\n=== Mode: scrape-results ===');
  const start = Date.now();

  // Get all auctions with relatorio_url that haven't been fully processed
  const { data: auctions } = await supabase
    .from('auctions')
    .select('id, auction_code, relatorio_url, status')
    .eq('status', 'COMPLETED')
    .not('relatorio_url', 'is', null)
    .order('result_date', { ascending: false });

  if (!auctions?.length) {
    console.log('  No completed auctions with result PDFs found. Run --mode=discover first.');
    return;
  }

  console.log(`  Found ${auctions.length} completed auctions to process`);

  let totalUpdated = 0;
  let totalPdfLots = 0;
  let totalErrors = 0;

  for (const auction of auctions) {
    if (!auction.relatorio_url) continue;

    console.log(`  Processing ${auction.auction_code}...`);
    await sleep(500);

    try {
      const pdfBuffer = await downloadPdf(auction.relatorio_url, 'Relatorio');
      const text = await extractPdfText(pdfBuffer);
      const extracted = parseResultsPdfText(text, auction.auction_code);

      if (extracted.lots && extracted.lots.length > 0) {
        console.log(`    PDF parsed ${extracted.lots.length} sold lots`);
        totalPdfLots += extracted.lots.length;

        for (const lotResult of extracted.lots) {
          const valor_venda = lotResult.winning_bid + (lotResult.tarifa || 0);
          const { error } = await supabase
            .from('lots')
            .update({
              outcome_status: 'VENDIDO',
              winning_bid_value: lotResult.winning_bid,
              tarifa_arrematacao: lotResult.tarifa || null,
              valor_venda,
              was_sold: true,
              result_source: 'relatorio_pdf',
            })
            .eq('co_leilao', auction.auction_code)
            .eq('lot_number', lotResult.lot_number);

          if (!error) totalUpdated++;
        }

        // Update auction processing date
        await supabase.from('auctions').update({
          results_scrape_date: new Date().toISOString(),
        }).eq('id', auction.id);
      } else {
        console.log(`    PDF parsed 0 lots — may be empty or different format`);
      }
    } catch (e) {
      totalErrors++;
      if (e.message.includes('404')) {
        console.log(`    PDF unavailable (expired)`);
      } else {
        console.log(`    Error: ${e.message}`);
      }
    }
  }

  const ms = Date.now() - start;
  console.log(`\nDone in ${ms}ms | lots updated: ${totalUpdated}, from PDFs: ${totalPdfLots}, errors: ${totalErrors}`);
}

// ============================================================
// MODE: INSIGHT
// Generates marketing intelligence: avg prices, suggested bid ranges for future auctions.
// Run after scrape-lots and scrape-results have populated data.
// ============================================================

async function modeInsight() {
  console.log('\n=== Mode: insight ===');
  const start = Date.now();

  // For each completed auction with sold lots, compute stats
  const { data: completedAuctions } = await supabase
    .from('auctions')
    .select('id, auction_code, city_id, result_date')
    .eq('status', 'COMPLETED')
    .order('result_date', { ascending: false })
    .limit(50);

  if (!completedAuctions?.length) {
    console.log('  No completed auctions found.');
    return;
  }

  const cities = await getAllCities();
  const cityMap = Object.fromEntries(cities.map(c => [c.id, c]));

  let insightsGenerated = 0;

  for (const auction of completedAuctions) {
    // Get all SOLD lots for this auction
    const { data: soldLots } = await supabase
      .from('lots')
      .select('id, lot_number, de_contrato, valor, winning_bid_value, tarifa_arrematacao, peso_lote')
      .eq('co_leilao', auction.auction_code)
      .eq('outcome_status', 'VENDIDO');

    if (!soldLots?.length) continue;

    // Compute stats per auction
    const bids = soldLots.map(l => l.winning_bid_value || 0).filter(Boolean);
    const avgBid = bids.reduce((a, b) => a + b, 0) / bids.length;
    const minBid = Math.min(...bids);
    const maxBid = Math.max(...bids);
    const totalRevenue = soldLots.reduce((sum, l) => sum + (l.winning_bid_value || 0), 0);

    // Extract category hints from descriptions
    const descriptions = soldLots.map(l => l.de_contrato).filter(Boolean);
    const ouroCount = descriptions.filter(d => /ouro|ouro\s/i.test(d)).length;
    const prataCount = descriptions.filter(d => /prata/i.test(d)).length;
    const pedrasCount = descriptions.filter(d => /pedra|diamante|esmeralda| safira|topazio/i.test(d)).length;

    console.log(`  ${auction.auction_code}: ${soldLots.length} sold, avg R$ ${avgBid.toFixed(0)}, range R$ ${minBid.toFixed(0)}–${maxBid.toFixed(0)}, revenue R$ ${totalRevenue.toFixed(0)}`);

    // Update auction with insight data
    await supabase.from('auctions').update({
      total_lots_sold: soldLots.length,
      avg_winning_bid: Math.round(avgBid),
      min_winning_bid: Math.round(minBid),
      max_winning_bid: Math.round(maxBid),
      total_revenue: Math.round(totalRevenue),
      ouro_lots: ouroCount,
      prata_lots: prataCount,
      pedras_lots: pedrasCount,
      insight_generated_at: new Date().toISOString(),
    }).eq('id', auction.id);

    insightsGenerated++;
  }

  // Generate suggested bids for FUTURE auctions based on similar past lots
  const { data: futureAuctions } = await supabase
    .from('auctions')
    .select('id, auction_code, city_id')
    .eq('status', 'FUTURE');

  if (futureAuctions?.length) {
    console.log(`\n  Future auctions (${futureAuctions.length}) — generating suggested bid ranges`);

    for (const future of futureAuctions) {
      const city = cityMap[future.city_id];
      if (!city) continue;

      // Get similar past auctions in same state/city
      const stateUf = city.name?.match(/\(([A-Z]{2})\)/)?.[1];
      const { data: pastAuctions } = await supabase
        .from('auctions')
        .select('id, auction_code, avg_winning_bid, min_winning_bid, max_winning_bid, total_lots_sold')
        .eq('status', 'COMPLETED')
        .gte('avg_winning_bid', 1)
        .limit(10);

      if (pastAuctions?.length) {
        const avgOfAvg = pastAuctions.reduce((s, a) => s + (a.avg_winning_bid || 0), 0) / pastAuctions.length;
        const avgCount = pastAuctions.reduce((s, a) => s + (a.total_lots_sold || 0), 0) / pastAuctions.length;

        await supabase.from('auctions').update({
          suggested_min_bid: Math.round(avgOfAvg * 0.6),
          suggested_max_bid: Math.round(avgOfAvg * 1.2),
          suggested_avg_bid: Math.round(avgOfAvg),
          based_on_auctions: pastAuctions.map(a => a.auction_code).join(','),
        }).eq('id', future.id);

        console.log(`  ${future.auction_code}: suggested R$ ${Math.round(avgOfAvg * 0.6)}–${Math.round(avgOfAvg * 1.2)} (avg R$ ${Math.round(avgOfAvg)}, based on ${pastAuctions.length} past auctions)`);
      }
    }
  }

  const ms = Date.now() - start;
  console.log(`\nDone in ${ms}ms | insights generated: ${insightsGenerated}`);
}

// ============================================================
// MODE: AUCTIONS (link lots to auctions table)
// ============================================================

async function modeAuctions() {
  console.log('\n=== Mode: auctions ===');
  const start = Date.now();

  // Process ALL auction codes in batches of unique co_leilao values
  const { data: allOrphanCodes } = await supabase
    .from('lots')
    .select('co_leilao')
    .not('co_leilao', 'is', null)
    .is('auction_id', null);

  if (!allOrphanCodes?.length) {
    console.log('  No orphan lots found — all lots already linked');
    return;
  }

  const coLeiloes = [...new Set(allOrphanCodes.map(l => l.co_leilao))];
  console.log(`  Found ${coLeiloes.length} auction codes to link`);

  let linked = 0;
  for (const coLeilao of coLeiloes) {
    // Find or create the auction
    const { data: existing } = await supabase
      .from('auctions')
      .select('id')
      .eq('auction_code', coLeilao)
      .maybeSingle();

    let auctionId = existing?.id;

    if (!auctionId) {
      // Create the auction stub (will be enriched later by edilal mode)
      const { data: newAuction } = await supabase
        .from('auctions')
        .insert({ auction_code: coLeilao })
        .select('id')
        .single();
      auctionId = newAuction?.id;
    }

    if (!auctionId) {
      console.error(`  Could not create auction for ${coLeilao}: ${err.message}`);
      continue;
    }

    // Link ALL lots with this co_leilao to the auction (not just 1)
    const { error } = await supabase
      .from('lots')
      .update({ auction_id: auctionId })
      .eq('co_leilao', coLeilao);

    if (error) {
      console.error(`  Link error for ${coLeilao}: ${error.message}`);
    } else {
      linked++;
    }
  }

  const ms = Date.now() - start;
  console.log(`\nDone in ${ms}ms | linked ${linked} auctions`);
}

// ============================================================
// MAIN
// ============================================================

function parseArgs() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    const [k, v] = arg.split('=');
    args[k.replace(/^--/, '')] = v;
  }
  return args;
}

async function main() {
  const { mode, 'auction-code': auctionCode } = parseArgs();

  if (!mode) {
    console.error('Usage: node scraper.js --mode=<mode> [--auction-code=<code>]');
    console.error('Modes: states-cities, bid-periods, active-lots, results, edilal, auctions, dedup');
    process.exit(1);
  }

  console.log(`Vitrine de Joias Scraper | Mode: ${mode} | ${new Date().toISOString()}`);

  switch (mode) {
    case 'states-cities':  await modeStatesCities(); break;
    case 'bid-periods':    await modeBidPeriods(); break;
    case 'active-lots':    await modeActiveLots(); break;
    case 'results':        await modeResults(); break;
    case 'edital':         await modeEdital(auctionCode); break;
    case 'auctions':       await modeAuctions(); break;
    case 'dedup':          await modeDedup(); break;
    case 'discover':       await modeDiscover(); break;
    case 'scrape-lots':    await modeScrapeLots(); break;
    case 'scrape-results': await modeScrapeResults(); break;
    case 'insight':        await modeInsight(); break;
    case 'download-images': await modeDownloadImages(); break;
    case 'health-check-images': await modeHealthCheckImages(); break;
    case 'refresh-images': await modeRefreshImages(); break;
    case 're-scrape-missing': await modeReScrapeMissing(); break;
    case 'reconstruct-urls': await modeReconstructUrls(); break;
    case 'enrich':            await modeEnrich(); break;
    case 'health-check-proxies': await modeHealthCheckProxies(); break;
    case 'scrape-with-pool':     await modeScrapeWithPool(); break;
    default:
      console.error(`Unknown mode: ${mode}`);
      process.exit(1);
  }
}

async function modeDownloadImages() {
  console.log('\n=== Mode: download-images ===');
  console.log('  Downloading + optimizing + uploading images for ACTIVE auction lots with CAIXA image URLs');

  const BATCH = 20;
  let processed = 0, success = 0, failed = 0, skipped = 0;

  let lastId = 0;

  while (true) {
    // Fetch lots with CAIXA URLs that are missing at least one stored image — all lots, sold or active
    const { data: lots } = await supabase
      .from('lots')
      .select('id, lot_number, url_imagem_capa, url_imagem_frente, url_imagem_verso, imagem_capa_url, imagem_frente_url, imagem_verso_url')
      .not('url_imagem_capa', 'is', null)
      .or('imagem_frente_url.is.null,imagem_verso_url.is.null')
      .gt('id', lastId)
      .order('id', { ascending: true })
      .limit(BATCH);

    if (!lots?.length) {
      // No more lots missing images — done
      break;
    }

    for (const lot of lots) {
      lastId = lot.id;

      // CAIXA changed image URL base from /vitrinedejoias/ to /vitrinearquivos/fotos/
      // Convert old stored URLs to new format
      const OLD_IMG_BASE = 'https://servicebus2.caixa.gov.br/vitrinedejoias';
      const capaUrl = lot.url_imagem_capa?.replace(OLD_IMG_BASE, IMG_BASE) || null;
      const frenteUrl = lot.url_imagem_frente?.replace(OLD_IMG_BASE, IMG_BASE) || null;
      const versoUrl = lot.url_imagem_verso?.replace(OLD_IMG_BASE, IMG_BASE) || null;

      const [imagemCapaUrl, imagemFrenteUrl, imagemVersoUrl] = await Promise.all([
        (capaUrl && (!lot.imagem_capa_url || lot.imagem_capa_url?.endsWith('.jpg'))) ? downloadOptimizeUpload(capaUrl, lot.id, 'capa') : lot.imagem_capa_url,
        (frenteUrl && (!lot.imagem_frente_url || lot.imagem_frente_url?.endsWith('.jpg'))) ? downloadOptimizeUpload(frenteUrl, lot.id, 'frente') : lot.imagem_frente_url,
        (versoUrl && (!lot.imagem_verso_url || lot.imagem_verso_url?.endsWith('.jpg'))) ? downloadOptimizeUpload(versoUrl, lot.id, 'verso') : lot.imagem_verso_url,
      ]);

      if (imagemCapaUrl || imagemFrenteUrl || imagemVersoUrl) {
        const { error } = await supabase
          .from('lots')
          .update({
            imagem_capa_url: imagemCapaUrl,
            imagem_frente_url: imagemFrenteUrl,
            imagem_verso_url: imagemVersoUrl,
          })
          .eq('id', lot.id);

        if (error) {
          console.error(`  [${lot.id}] update failed: ${error.message}`);
          failed++;
        } else {
          success++;
        }
      } else {
        // Mark as attempted so we don't re-process forever
        await supabase.from('lots').update({ imagem_capa_url: '' }).eq('id', lot.id);
        skipped++;
      }

      processed++;
      if (processed % 100 === 0) {
        console.log(`  Progress: ${processed} lots processed | success: ${success} | failed: ${failed} | skipped: ${skipped}`);
      }

      // Be nice to CAIXA servers
      await sleep(100);
    }

    if (lots.length < BATCH) break;
  }

  console.log(`\nDone! processed: ${processed}, success: ${success}, failed: ${failed}, skipped: ${skipped}`);
}

// ============================================================


// ============================================================
// MODE: HEALTH-CHECK-IMAGES
// Validates stored image URLs in Supabase storage.
// If an image URL returns 404, nullifies the storage URL field
// so the frontend falls back to a placeholder Gem icon.
// ============================================================
async function modeHealthCheckImages() {
  console.log("\n=== Mode: health-check-images ===");
  console.log("  Checking stored images for broken URLs...");

  const BATCH = 50;
  let checked = 0, fixed = 0, errors = 0;

  while (true) {
    const { data: lots } = await supabase
      .from("lots")
      .select("id, imagem_capa_url, imagem_frente_url, imagem_verso_url")
      .not("imagem_capa_url", "is", null)
      .not("imagem_capa_url", "eq", "")
      .limit(BATCH)
      .range(checked, checked + BATCH - 1);

    if (!lots?.length) break;

    for (const lot of lots) {
      const toCheck = [
        { field: "imagem_capa_url" },
        { field: "imagem_frente_url" },
        { field: "imagem_verso_url" },
      ].filter(x => lot[x.field]);

      let needsUpdate = false;
      const updates = {};

      for (const { field } of toCheck) {
        try {
          const res = await fetch(lot[field], { method: "HEAD", redirect: "follow" });
          if (res.status === 404) {
            updates[field] = null;
            needsUpdate = true;
          }
        } catch (e) {}
      }

      if (needsUpdate) {
        const { error } = await supabase.from("lots").update(updates).eq("id", lot.id);
        if (error) errors++;
        else fixed++;
      }
    }

    checked += lots.length;
    if (checked % 500 === 0) console.log("  Checked:", checked, "| Fixed:", fixed, "| Errors:", errors);
    if (lots.length < BATCH) break;
  }

  console.log("\nDone! Checked:", checked, "| Fixed:", fixed, "| Errors:", errors);
}

// ============================================================
// MODE: REFRESH-IMAGES
// Re-scrapes CAIXA pagination API to recover missing image URLs
// for lots that were scraped without images, then downloads all 3 images.
// Handles lots missing url_imagem_capa — groups by city to minimize API calls.
// ============================================================
async function modeRefreshImages() {
  console.log("\n=== Mode: refresh-images ===");
  console.log('  Recovering image URLs + downloading all 3 images for lots missing url_imagem_capa...');

  const IMG_BASE = 'https://servicebus2.caixa.gov.br/vitrinearquivos/fotos';
  const BATCH_SIZE = 100;
  let refreshed = 0, downloaded = 0, errors = 0, pages = 0;

  // Fetch all lots missing CAIXA image URLs (active auctions only)
  const { data: missingLots } = await supabase
    .from('lots')
    .select('id, city_id, co_leilao, lot_number, contract_number, url_imagem_capa, imagem_capa_url')
    .is('outcome_status', null)
    .is('url_imagem_capa', null);

  if (!missingLots?.length) {
    console.log('  No lots missing image URLs — nothing to do.');
    return;
  }

  console.log('  Lots needing image refresh:', missingLots.length);

  // Group by city
  const byCity = {};
  for (const lot of missingLots) {
    if (!byCity[lot.city_id]) byCity[lot.city_id] = [];
    byCity[lot.city_id].push(lot);
  }

  // Get city codes
  const { data: cities } = await supabase.from('cities').select('id, caixa_city_code');
  const cityMap = Object.fromEntries((cities || []).map(c => [c.id, c.caixa_city_code]));

  for (const [cityIdStr, lots] of Object.entries(byCity)) {
    const cityId = parseInt(cityIdStr);
    const cityCode = cityMap[cityId];
    if (!cityCode) { console.warn('  Unknown city_id:', cityId); continue; }

    // Get unique auctions for this city
    const auctionCodes = [...new Set(lots.map(l => l.co_leilao))];
    console.log('  City', cityId, '(code', cityCode, '):', lots.length, 'lots in', auctionCodes.length, 'auction(s)');

    for (const coLeilao of auctionCodes) {
      // Find match by scraping all pages and matching coLeilao
      let page = 1;

      outer:
      while (page <= 100) {
        pages++;
        let data;
        for (let attempt = 1; attempt <= 3; attempt++) {
          data = await scrapeLotsPage(cityCode, '', '', page);
          if (data && (data?.lotes?.length || data?.totalRegistros)) break;
          await sleep(2000 * attempt);
        }
        const allLots = data?.lotes || [];
        if (!allLots.length) break;

        const matching = allLots.filter(l => l.coLeilao === coLeilao);
        if (matching.length) {
          // For each lot in our missing list, find a match in the current page's results
          for (const lot of lots) {
            if (lot.co_leilao !== coLeilao) continue;
            const found = allLots.find(l =>
              l.numeroDolote === lot.lot_number || l.nuContrato === lot.contract_number
            );
            if (found) {
              // Update the lot with image URLs from CAIXA
              const capaUrl = found.urlImagemCapa ? IMG_BASE + found.urlImagemCapa : null;
              const frenteUrl = found.urlImagemFrente ? IMG_BASE + found.urlImagemFrente : null;
              const versoUrl = found.urlImagemVerso ? IMG_BASE + found.urlImagemVerso : null;

              // Download all 3 images in parallel
              const [capaStored, frenteStored, versoStored] = await Promise.all([
                capaUrl ? downloadOptimizeUpload(capaUrl, lot.id, 'capa') : null,
                frenteUrl ? downloadOptimizeUpload(frenteUrl, lot.id, 'frente') : null,
                versoUrl ? downloadOptimizeUpload(versoUrl, lot.id, 'verso') : null,
              ]);

              const updates = {};
              if (capaUrl) updates.url_imagem_capa = capaUrl;
              if (frenteUrl) updates.url_imagem_frente = frenteUrl;
              if (versoUrl) updates.url_imagem_verso = versoUrl;
              if (capaStored) updates.imagem_capa_url = capaStored;
              if (frenteStored) updates.imagem_frente_url = frenteStored;
              if (versoStored) updates.imagem_verso_url = versoStored;

              if (Object.keys(updates).length > 0) {
                const { error } = await supabase.from('lots').update(updates).eq('id', lot.id);
                if (error) { console.error('  Update error for lot', lot.id, error.message); errors++; }
                else {
                  refreshed++;
                  if (capaStored) downloaded++;
                  if (frenteStored) downloaded++;
                  if (versoStored) downloaded++;
                }
              }
            }
          }
        }
        page++;
        // Safety: if we went past totalRegistros pages, stop
        const totalPaginas = data?.paginas?.length ?? 0;
        if (totalPaginas > 0 && page > totalPaginas) break;
        await sleep(200);
      }
    }
  }

  console.log("\nDone! Pages scraped:", pages, "| Lots refreshed:", refreshed, "| Images downloaded:", downloaded, "| Errors:", errors);
}
// MODE: RE-SCRAPE-MISSING
// Re-scrapes all active auctions from CAIXA API to get image URLs
// for lots that were scraped before images were added, or lots
// that have no url_imagem_capa in the database.
// ============================================================
async function modeReScrapeMissing() {
  console.log('\n=== Mode: re-scrape-missing ===');
  console.log('  Re-scraping lots missing images via CAIXA contract search');

  const BATCH = 50;
  let processed = 0, updated = 0, imagesStored = 0, noData = 0, errors = 0;

  // Find lots missing images — try to re-fetch them from CAIXA by contract number
  while (true) {
    const { data: lots } = await supabase
      .from('lots')
      .select('id, contract_number, lot_number, city_id, url_imagem_capa, imagem_capa_url')
      .is('outcome_status', null)
      .or(`imagem_capa_url.is.null,url_imagem_capa.is.null`)
      .limit(BATCH)
      .range(processed, processed + BATCH - 1);

    if (!lots?.length) break;

    for (const lot of lots) {
      // Skip if already has storage image
      if (lot.imagem_capa_url) { processed++; continue; }

      // Try to find the lot on CAIXA by contract number
      if (!lot.contract_number) { noData++; processed++; continue; }

      try {
        // Search CAIXA by contract number
        const url = `https://servicebus2.caixa.gov.br/vitrinedejoias/api/busca/vitrine?codigoDaCidade=&dataInicioLance=&dataFimLance=&pagina=1&quantidadeDeItens=10&numeroDoLoteOuContrato=${encodeURIComponent(lot.contract_number)}`;
        const res = await proxiedFetch(url, { headers: { ...STANDARD_HEADERS, referer: 'https://vitrinedejoias.caixa.gov.br/' } });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        const lotes = Array.isArray(data?.lotes) ? data.lotes : [];
        const matched = lotes.find(l => l.nuContrato === lot.contract_number || l.numeroDolote === lot.lot_number);

        if (matched && matched.urlImagemCapa) {
          // Got new image URL from CAIXA — download and store
          const capaUrl = `${IMG_BASE}${matched.urlImagemCapa}`;
          const frenteUrl = matched.urlImagemFrente ? `${IMG_BASE}${matched.urlImagemFrente}` : null;
          const versoUrl = matched.urlImagemVerso ? `${IMG_BASE}${matched.urlImagemVerso}` : null;

          const [imagemCapaUrl, imagemFrenteUrl, imagemVersoUrl] = await Promise.all([
            lot.imagem_capa_url?.endsWith('.jpg') ? downloadOptimizeUpload(capaUrl, lot.id, 'capa') : (lot.imagem_capa_url || downloadOptimizeUpload(capaUrl, lot.id, 'capa')),
            frenteUrl && (lot.imagem_frente_url?.endsWith('.jpg') ? downloadOptimizeUpload(frenteUrl, lot.id, 'frente') : (lot.imagem_frente_url || downloadOptimizeUpload(frenteUrl, lot.id, 'frente'))),
            versoUrl && (lot.imagem_verso_url?.endsWith('.jpg') ? downloadOptimizeUpload(versoUrl, lot.id, 'verso') : (lot.imagem_verso_url || downloadOptimizeUpload(versoUrl, lot.id, 'verso'))),
          ]);

          const updateData = {
            url_imagem_capa: capaUrl,
            url_imagem_frente: frenteUrl,
            url_imagem_verso: versoUrl,
          };
          if (imagemCapaUrl) updateData.imagem_capa_url = imagemCapaUrl;
          if (imagemFrenteUrl) updateData.imagem_frente_url = imagemFrenteUrl;
          if (imagemVersoUrl) updateData.imagem_verso_url = imagemVersoUrl;

          await supabase.from('lots').update(updateData).eq('id', lot.id);
          if (imagemCapaUrl) imagesStored++;
          updated++;
        } else {
          noData++;
        }
      } catch (e) {
        errors++;
      }

      processed++;
      if (processed % 100 === 0) console.log(`  progress: ${processed} | updated: ${updated} | images: ${imagesStored} | no-data: ${noData} | errors: ${errors}`);
      await sleep(250);
    }

    if (lots.length < BATCH) break;
  }

  console.log(`\nDone! processed: ${processed}, updated: ${updated}, images stored: ${imagesStored}, no-data: ${noData}, errors: ${errors}`);
}

// ============================================================
// MODE: RECONSTRUCT-URLS
// Reconstructs image URLs for lots that have contract numbers but no url_imagem_capa.
// Pattern: contract_number like "0326.213.00055066-0" -> URL path /0326/0/0326213000550660/FRENTEP.JPG
// ============================================================
async function modeReconstructUrls() {
  console.log('\n=== Mode: reconstruct-urls ===');
  console.log('  Reconstructing + validating image URLs from contract numbers');

  const BATCH = 50;
  let processed = 0, updated = 0, skipped = 0, errors = 0, notFound = 0;
  let contractsExtracted = 0;

  // Phase 1: extract contract numbers from de_contrato for lots that don't have one
  console.log('  Phase 1: extracting contract numbers from descriptions...');
  let phase1Processed = 0;
  while (true) {
    const { data: lots } = await supabase
      .from('lots')
      .select('id, lot_number, contract_number, de_contrato')
      .is('outcome_status', null)
      .is('url_imagem_capa', null)
      .is('contract_number', null)
      .not('de_contrato', 'is', null)
      .range(phase1Processed, phase1Processed + BATCH - 1);

    if (!lots?.length) break;

    for (const lot of lots) {
      const fullContract = extractContractFromDescription(lot.de_contrato);
      if (fullContract) {
        await supabase
          .from('lots')
          .update({ contract_number: fullContract })
          .eq('id', lot.id);
        contractsExtracted++;
      }
      phase1Processed++;
    }
    if (lots.length < BATCH) break;
  }
  console.log(`  Phase 1: extracted ${contractsExtracted} contract numbers from descriptions`);

  // Phase 2: reconstruct URLs for all lots missing imagem_capa_url
  processed = 0;
  while (true) {
    const { data: lots } = await supabase
      .from('lots')
      .select('id, lot_number, contract_number, de_contrato')
      .is('outcome_status', null)
      .is('url_imagem_capa', null)
      .not('contract_number', 'is', null)
      .range(processed, processed + BATCH - 1);

    if (!lots?.length) break;

    for (const lot of lots) {
      try {
        // Use city4 from lot_number as fallback for URL construction
        const city4FromLot = getCity4FromLotNumber(lot.lot_number);
        const { url0, url1 } = reconstructImageUrlBoth(lot.contract_number, city4FromLot);
        if (!url0) { notFound++; processed++; continue; }

        // Try N=0 first, fall back to N=1 with retries
        let url = url0;
        let found = false;

        try {
          let res0ok = false;
          for (let attempt = 1; attempt <= 3; attempt++) {
            const res0 = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
            if (res0.ok) { res0ok = true; break; }
            if (attempt < 3) await sleep(2000);
          }

          if (res0ok) {
            found = true;
          } else {
            for (let attempt = 1; attempt <= 3; attempt++) {
              const res1 = await fetch(url1, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
              if (res1.ok) { url = url1; found = true; break; }
              if (attempt < 3) await sleep(2000);
            }
          }
        } catch {
          // Timeout or network error — skip
        }

        if (found) {
          await supabase.from('lots').update({ url_imagem_capa: url }).eq('id', lot.id);
          updated++;
        } else {
          notFound++;
        }
      } catch (e) {
        errors++;
      }
      processed++;

      if (processed % 100 === 0) {
        console.log(`  progress: ${processed} | updated: ${updated} | not-found: ${notFound} | errors: ${errors}`);
      }
      await sleep(100); // be nice to CAIXA
    }

    if (lots.length < BATCH) break;
  }

  console.log(`\nDone! processed: ${processed}, updated: ${updated}, not-found: ${notFound}, errors: ${errors}`);
  if (updated > 0) {
    console.log('  Run --mode=download-images next to download and store images.');
  }
}

// Reconstruct CAIXA image URL from contract number
// contract like "0326.213.00055066-0" -> "https://servicebus2.caixa.gov.br/vitrinearquivos/fotos/0326/0/0326213000550660/FRENTEP.JPG"
function reconstructImageUrl(contractNumber) {
  if (!contractNumber) return null;

  // Remove dots and dashes: "0326.213.00055066-0" -> "0326213000550660"
  const digits = contractNumber.replace(/[.\-]/g, '');
  if (digits.length < 16) return null; // Need at least 4 + 1 + 11 = 16 digits

  // Pattern: {city4}{213}{contract10digits}{check}
  // city4 = first 4 chars = "0326"
  // N = char at position 4 = "0" (the digit after city4, before 213)
  // contract10 = chars 6-15 = "00055066-0" stripped -> "000550660" but actually it's the full digits without check
  // Actually: "0326" + "2" + "13" + "000055066" + "0" -> city4="0326", N="2", rest="130000550660"
  // Wait: "0326213000550660" -> city4="0326", then we need the pattern after

  // The image path is: /{city4}/{N}/{city4}{all_digits_without_check}/{view}.JPG
  // where the middle digit N is position 4 of the stripped contract (after city4 prefix)
  // "0326213000550660" -> city4="0326", then char at idx4="1" -> N="1"?
  // But in the URL it's "0326/0/..." not "0326/1/..."

  // Let me figure out the pattern from known working URLs:
  // "0326.213.00055066-0" -> /0326/0/0326213000550660/FRENTEP.JPG
  // "0263.213.00072228-1" -> /0263/0/0263213000722281/FRENTEP.JPG
  // "1969.213.00010389-2" -> /1969/0/1969213000103892/FRENTEP.JPG
  // "1969.213.00010640-9" -> /1969/1/1969213000106409/FRENTEP.JPG

  // Pattern:
  // city4 = first 4: "0326", "0263", "1969"
  // N = position 4: "2", "2", "2" (from "03262...", "02632...", "19692...")
  // But in URL it's 0 or 1... hmm.

  // Actually looking more carefully:
  // "0326213000550660" - the digit at position 4 is "2" but URL shows "0"
  // "1969213000103892" - position 4 is "2" but URL shows "0"
  // "1969213000106409" - position 4 is "2" but URL shows "1"

  // Wait, maybe the "N" comes from somewhere else entirely. Let me look at the lot_number instead.
  // "0263.000996-8" from the lots that DO have urls... the URL path is /0263/1/...
  // Actually for the lot "0263.000996-8", the image URL might not be available since it was in the API response with urlImagemCapa: "/0263/1/0263213000722281/FRENTEP.JPG"

  // Actually I think the N is just a subfolder index (0 or 1) and the path reconstruction doesn't need to be perfect.
  // What matters is: {city4}/{N}/{contract_number_stripped_no_check}/{view}.JPG
  // Where contract_number_stripped_no_check = contract_number.replace(/[.\-]/g, '').slice(0, -1) (remove last char = check digit)

  const stripped = contractNumber.replace(/[.\-]/g, '');
  // Need 4 (city) + 1 (N subfolder) + 10 (contract) + 1 (check) = 16 digits
  if (stripped.length < 16) return null;
  const city4 = stripped.slice(0, 4);
  // Return N=0 URL (most common); the downloader will handle 404s
  return `${IMG_BASE}/${city4}/0/${stripped}/FRENTEP.JPG`;
}

// Try both N values (0 and 1) to find the right one
// Uses contract's city4 OR falls back to lot's city4 if contract city doesn't match lot city
function reconstructImageUrlBoth(contractNumber, lotNumber) {
  const stripped = contractNumber.replace(/[.\-]/g, '');
  if (stripped.length < 16) return null;
  // city4 from contract
  const city4FromContract = stripped.slice(0, 4);
  // city4 from lot_number (more reliable)
  const city4FromLot = getCity4FromLotNumber(lotNumber);
  // Prefer lot's city4 if contract's city matches lot's city, otherwise use lot's
  const city4 = city4FromLot || city4FromContract;
  // Replace first 4 digits of stripped with the correct city4
  const digitsWithCorrectCity = city4 + stripped.slice(4);
  return {
    url0: `${IMG_BASE}/${city4}/0/${digitsWithCorrectCity}/FRENTEP.JPG`,
    url1: `${IMG_BASE}/${city4}/1/${digitsWithCorrectCity}/FRENTEP.JPG`,
  };
}

// Extract contract number from de_contrato description when contract_number is null
// Pattern: "XXXX.213.DDDDDDDDDD-DD" at start of string (e.g. "0059.213.00076163-6")
// Returns the full contract including city code prefix (16 chars)
function extractContractFromDescription(deContrato) {
  if (!deContrato) return null;
  const match = deContrato.match(/^([0-9]{4}\.213\.[0-9]{8}-[0-9])/);
  return match ? match[1] : null;
}

// Get city4 from lot_number (format "XXXX.NNNNNN-X")
function getCity4FromLotNumber(lotNumber) {
  if (!lotNumber) return null;
  const match = lotNumber.match(/^([0-9]{4})\./);
  return match ? match[1] : null;
}

// ============================================================
// MODE: ENRICH
// Enriches lot descriptions using LLM — replaces regex-based extraction
// Produces: title_enriched, description_enriched, karat_enriched,
//           category_enriched, weight_enriched, tags
// ============================================================
async function modeEnrich() {
  console.log('\n=== Mode: enrich ===');
  console.log('  Enriching lot descriptions via LLM...');
  const BATCH = 50;
  const CONCURRENCY = 10;
  let processed = 0, updated = 0, failed = 0;

  while (true) {
    const { data: lots } = await supabase
      .from('lots')
      .select('id, de_contrato, lot_number, contract_number, karat, peso_lote')
      .or('enrichment_status.is.null,enrichment_status.eq.pending,enrichment_status.eq.failed')
      .limit(BATCH);

    if (!lots?.length) {
      console.log('  No lots to enrich.');
      break;
    }

    const chunk = lots.slice(0, CONCURRENCY);
    const results = await Promise.all(
      chunk.map(lot => enrichLot(lot).then(result => ({ lot, result })).catch(err => ({ lot, result: null, err })))
    );
    // Re-queue remaining lots for next iteration by not processing them here

    for (const { lot, result, err } of results) {
      processed++;
      if (result) {
        const { error } = await supabase
          .from('lots')
          .update({
            enrichment_status: 'enriched',
            title_enriched: result.title,
            description_enriched: result.description,
            karat_enriched: result.karat,
            category_enriched: result.category,
            weight_enriched: result.weight_g,
            tags: result.tags,
          })
          .eq('id', lot.id);
        if (error) {
          console.error(`  [${lot.id}] update failed: ${error.message}`);
          failed++;
        } else {
          updated++;
        }
      } else {
        // Keep as 'pending' so the next batch will retry it (max 3 attempts per run)
        await supabase.from('lots').update({ enrichment_status: 'pending' }).eq('id', lot.id);
        if (err) console.warn(`  [${lot.id}] enrichment failed: ${err.message}`);
        failed++;
      }
    }

    console.log(`  progress: ${processed} | updated: ${updated} | failed: ${failed}`);
    await sleep(200);
  }

  console.log(`\nDone! processed: ${processed}, updated: ${updated}, failed: ${failed}`);
}

const ENRICHMENT_PROMPT = `You extract structured data from Brazilian jewelry auction lots. Return ONLY valid JSON, no markdown, no explanation.

Fields:
- title: detailed title in Portuguese that includes piece counts (e.g. "Um anel e três brincos de ouro 18k - 28.25g", "Aliança, dois anéis e um colar de ouro - 15.5g"). Title Case, ALWAYS include weight_g at the end.
- description: rich 2-3 sentence natural description in Portuguese describing this specific lot. After the description, add factor sections ONLY for factors actually detected in the lot (alphabetical order within each section):
  LINEBREAK + "Fatores que podem afetar o valor:" (show this section header if ANY of these are detected: amassaduras, partiduras, baixo quilate, enchimento, folheado, incompleto, pedras não valorizadas)
  LINEBREAK + "• Amassado: peças com deformações visíveis." (if amassaduras/amolgaduras/dentes/iniciais detected)
  LINEBREAK + "• Baixo quilate: ouro de pureza inferior ao esperado." (if baixo quilate detected)
  LINEBREAK + "• Enchimento: interior preenchido com material menos valioso." (if ENCHIMENTO/hallow detected)
  LINEBREAK + "• Folheado: camada fina de ouro sobre metal base — valor significativamente menor." (if FOLHEADO/FUNDO FOLHEADO detected)
  LINEBREAK + "• Incompleto: peças com componentes faltando." (if incompleto/faltam componentes detected)
  LINEBREAK + "• Partido/Quebrado: peças partidas ou quebradas." (if partido/quebrado/partidas detected)
  LINEBREAK + "• Pedras não valorizadas: gemas declaradas sem valor de mercado formal." (if pedras without preço/precificado detected)
  LINEBREAK + "Fatores que podem agregar valor:" (show this section header if ANY of these are detected: diamantes, pedras preciosas, moedas, barras, ouro rodinado, prata/platina/paládio)
  LINEBREAK + "• Com diamantes / pedras preciosas: pedrarias que podem superar o valor do ouro." (if diamantes/CONTÉM PEDRAS detected)
  LINEBREAK + "• Moeda / barra: ouro trocável como commodity." (if moeda/barra detected)
  LINEBREAK + "• Ouro rodinado: ouro maciço com banho de ródio." (if OURO RODINADO detected)
  LINEBREAK + "• Prata / platina / paládio: metais preciosos com valor próprio." (if prata/platina/paládio detected)
  LINEBREAK + "Descricao original CAIXA:" LINEBREAK + [original de_contrato text]
  LINEBREAK + "As informacoes foram extraídas automaticamente e são fornecidas sem garantia. O valor estimado é baseado exclusivamente no peso e pureza do ouro, desconsiderando pedrarias e manufacture."
  LINEBREAK + "A decisao de lance é de exclusiva responsabilidade do licitante."
- karat: gold purity if identifiable (18k, 14k, 10k, 24k) or null
- category: one word (Aliança, Colar, Brinco, Anel, Pulseira, Relógio, Moeda, Barra, Corrente, Jóia)
- weight_g: estimated weight in grams as number, or null
- tags: lowercase descriptive tags that capture factors PRESENT in this SPECIFIC LOT DESCRIPTION only — do NOT invent tags that aren't in the lot description:
  ALWAYS add "peso-misto" tag when the lot contains MORE THAN ONE precious metal type (e.g. "OURO E PRATA", "OURO E PALÁDIO", "OURO E PLATINA", "OURO BRANCO E PRATA") — this flag indicates the total weight includes multiple metals and the gold-value calculation is CAPPED, not the total value.
  RISK: ouro, ouro-18k, ouro-14k, ouro-10k, alianca, brinco, anel, pulseira, colar, corrente, pendente, broche, moeda, barra, relogio, amassado, quebrado, partido, incompleto, com-defeito, faltam-componentes, folheado, ouro-rodinado, prata-rodinado, com-pedras, sem-pedras, com-diamantes, prata, ouro-branco, platina, prateado, enchimento, peso-misto
  VALUE INDICATORS: com-pedras, com-diamantes, com-rubi, com-esmeralda, com-safira, com-pedras-preciosas, prata, platina, moeda, barra — these increase estimated value and MUST be included when present

IMPORTANT rules:
• Always include piece counts in title: "um anel", "três brincos", "duas alianças" — never just "anel e brincos"
• When description says "CONTÉM: pedras" or mentions gems/stones → add both "com-pedras" AND the specific gem tag
• When description says "CONTÉM: diamantes" → add "com-diamantes" tag
• Metal plating rules: "OURO RODINADO" = "ouro-rodinado" (NOT folheado, solid gold), "FOLHEADO" = "folheado" (base metal)
• "OURO BRANCO" = "ouro-branco" (solid white gold, NOT folheado)
• Never use "folheado" on "OURO RODINADO" items — they are real gold
• Include tags ONLY when that material/condition is explicitly present in the lot description — never add tags just because they are in the value indicators list

Rules: title MUST be Title Case (never ALL CAPS), ALWAYS append weight when available as " - Xg", be conservative, do not invent info.

Return ONLY this JSON structure, no other text:
{"title":"...","description":"...","karat":"...","category":"...","weight_g":...,"tags":[...]}`;

async function enrichLot(lot) {
  const deContrato = lot.de_contrato || '';
  if (!deContrato.trim()) return null;

  const prompt = `de_contrato: "${deContrato}"\nlot_number: ${lot.lot_number || 'N/A'}\ncontrato: ${lot.contract_number || 'N/A'}`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await llmCall('enrich', ENRICHMENT_PROMPT, prompt, 'qwen2.5-7b-instruct');
      const content = result.content.trim();
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        if (attempt < 3) {
          console.warn(`  [${lot.id}] malformed JSON, retrying (${attempt}/3) after 10s...`);
          await sleep(10000);
          continue;
        }
        throw new Error('No JSON found in LLM response');
      }
      return JSON.parse(jsonMatch[0]);
    } catch (err) {
      const isRateLimit = err.message?.includes('429') || err.message?.includes('rate limit') || err.message?.includes('Too Many Requests');
      const isNetworkErr = err.message?.includes('EHOSTUNREACH') || err.message?.includes('ETIMEDOUT') || err.message?.includes('ENOTFOUND') || err.message?.includes('ECONNREFUSED');
      if ((isRateLimit || isNetworkErr) && attempt < 3) {
        const delay = isRateLimit ? 20000 : 5000;
        console.warn(`  [${lot.id}] ${isRateLimit ? 'rate limited' : 'network error'}, retrying (${attempt}/3) after ${delay/1000}s...`);
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
}

async function modeHealthCheckProxies() {
  console.log('\n=== Mode: health-check-proxies ===');
  const startTime = Date.now();

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const CAIXA_TEST_URL = `${API_BASE}/busca/ufs`;
  const BLOCKED_THRESHOLD = 3;

  // 1. Get active/pending proxies to test
  const { data: proxies } = await supabase
    .from('working_proxies')
    .select('id, proxy_address, port, username, password, status, failure_count')
    .in('status', ['active', 'pending'])
    .or(`caixa_tested_at.is.null,caixa_tested_at.lt.${new Date(Date.now() - 3600000).toISOString()}`); // re-test if older than 1 hour

  console.log(`  Found ${proxies?.length ?? 0} proxies to test`);

  let newlyBlocked = 0;
  for (const proxy of proxies ?? []) {
    const proxyUrl = proxy.username && proxy.password
      ? `http://${proxy.username}:${proxy.password}@${proxy.proxy_address}:${proxy.port}`
      : `http://${proxy.proxy_address}:${proxy.port}`;

    const result = await proxiedFetch(CAIXA_TEST_URL, {
      headers: { accept: 'application/json', 'accept-language': 'pt-BR,pt;q=0.9' },
    });

    const ok = result.ok && result.status === 200;
    let validJson = false;
    if (ok) {
      try {
        const json = await result.json();
        validJson = Array.isArray(json) && json.length > 0 && 'sigla' in (json[0] ?? {});
      } catch { validJson = false; }
    }

    if (validJson) {
      await supabase
        .from('working_proxies')
        .update({
          failure_count: 0,
          status: 'active',
          caixa_works: true,
          caixa_tested_at: new Date().toISOString(),
        })
        .eq('id', proxy.id);
    } else {
      const newCount = (proxy.failure_count ?? 0) + 1;
      const isNowBlocked = newCount >= BLOCKED_THRESHOLD;
      await supabase
        .from('working_proxies')
        .update({
          failure_count: newCount,
          status: isNowBlocked ? 'blocked' : 'active',
          caixa_works: false,
          caixa_tested_at: new Date().toISOString(),
        })
        .eq('id', proxy.id);
      if (isNowBlocked) newlyBlocked++;
    }

    await sleep(2000); // rate limit between tests
  }

  // 2. Auto-replace blocked proxies
  const { data: blocked } = await supabase
    .from('working_proxies')
    .select('id, proxy_address')
    .eq('status', 'blocked');

  if (blocked?.length) {
    console.log(`  ${blocked.length} proxies blocked — triggering replacement...`);
    // Note: replacement requires WEBSHARE_API_TOKEN which scraper may not have
    // The admin UI route handles this with full credentials
  }

  console.log(`\nDone in ${Date.now() - startTime}ms | tested: ${proxies?.length ?? 0}, newly blocked: ${newlyBlocked}`);
}

// ============================================================
// SCRAPE WITH DB PROXY POOL
// Loads working proxies from working_proxies table, rotates through them.
// Use this as default scraping mode instead of PROXY_URLS env var.
// ============================================================

async function loadProxyPoolFromDb() {
  const { data } = await supabase
    .from('working_proxies')
    .select('proxy_address, port, username, password')
    .eq('status', 'active')
    .eq('caixa_works', true)
    .order('last_used_at', { ascending: true, nullsFirst: true });

  if (!data || data.length === 0) {
    console.warn('[pool] No active working proxies in DB — will try direct connection');
    return [];
  }

  return data.map(p => {
    if (p.username && p.password) {
      return `http://${p.username}:${p.password}@${p.proxy_address}:${p.port}`;
    }
    return `http://${p.proxy_address}:${p.port}`;
  });
}

async function modeScrapeWithPool() {
  console.log('\n=== Mode: scrape-with-pool ===');
  const pool = await loadProxyPoolFromDb();

  if (pool.length === 0) {
    console.warn('[pool] No proxies available, scraping without proxy');
  }

  // Set the proxy pool for http-proxy-utils
  const { setProxyPool } = await import('./http-proxy-utils.js');
  setProxyPool(pool);

  console.log(`[pool] Loaded ${pool.length} working proxies`);

  // Now run active-lots scraping with this pool
  await modeActiveLots();

  // After scraping, mark proxies as used (optional: update last_used_at via API)
  console.log('[pool] Scrape complete');
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});