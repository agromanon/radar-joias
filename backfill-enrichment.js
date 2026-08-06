#!/usr/bin/env node
/**
 * Backfill script: Find lots with poor-quality enrichment
 * (missing 'Descricao original' section) and mark them as 'pending'
 * so the running mode=enrich job re-processes them with the strict prompt.
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const { data: bad, error } = await supabase
  .from('lots')
  .select('id')
  .eq('enrichment_status', 'enriched')
  .not('description_enriched', 'is', null)
  .not('description_enriched', 'ilike', '%Descricao original%');

if (error) {
  console.error('Query error:', error.message);
  process.exit(1);
}
console.log('Found', bad?.length, 'bad lots to re-enrich');

const BATCH = 100;
let updated = 0;
for (let i = 0; i < (bad || []).length; i += BATCH) {
  const ids = bad.slice(i, i + BATCH).map(l => l.id);
  const { error: uerr } = await supabase.from('lots')
    .update({
      enrichment_status: 'pending',
      enrichment_confidence: null,
      enrichment_needs_review: false,
    })
    .in('id', ids);
  if (uerr) {
    console.error('Update err:', uerr.message);
    continue;
  }
  updated += ids.length;
}
console.log('Marked', updated, 'lots as pending for re-enrichment');
