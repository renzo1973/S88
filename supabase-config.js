// Configurazione centralizzata di Supabase
const SUPABASE_URL = "https://iaksgzrbewmxmuyuxgaa.supabase.co"; 
const SUPABASE_ANON_KEY = "INCOLLA_QUI_LA_CHIAVE_ANON_CORRETTA";

// Esportiamo l'istanza del client per poterla usare negli altri file .js
export const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Array di memoria per le estrazioni (condiviso tra i moduli)
export let databaseEstrazioni = { data: [] };