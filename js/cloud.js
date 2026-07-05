import { _supabase, databaseEstrazioni } from './supabase-config.js';
import { aggiornaDashboard, mostraSchermata, mostraErroreInserimento, formattaDataPerUomo, mesiIta } from './ui.js';

// Sincronizzazione a blocchi progressivi (No limiti di 1000 record)
export async function sincronizzaDalCloud() {
    try {
        document.getElementById('lbl-ultima-data').innerText = "Sincronizzazione...";
        
        let limiteSelezionato = parseInt(document.getElementById('txt-limite-record').value);
        if (isNaN(limiteSelezionato) || limiteSelezionato < 1) {
            limiteSelezionato = 1000;
            document.getElementById('txt-limite-record').value = 1000;
        }

        let tuttiIDati = [];
        let contatoreRange = 0;
        let continuaScaricamento = true;

        while (continuaScaricamento && tuttiIDati.length < limiteSelezionato) {
            let da = contatoreRange;
            let a = Math.min(contatoreRange + 999, limiteSelezionato - 1);

            let { data, error } = await _supabase
                .from('estrazioni')
                .select('*')
                .order('data', { ascending: false })
                .range(da, a);

            if (error) throw error;

            if (data && data.length > 0) {
                tuttiIDati = tuttiIDati.concat(data);
                contatoreRange += 1000;
                if (data.length < 1000) continuaScaricamento = false;
            } else {
                continuaScaricamento = false;
            }
        }

        databaseEstrazioni.data = tuttiIDati.reverse();
        aggiornaDashboard();
    } catch (err) {
        console.error(err);
        document.getElementById('lbl-ultima-data').innerText = "Errore Cloud";
    }
}

// Inserimento singolo record
export async function salvaEstrazione() {
    const errDiv = document.getElementById('ins-error');
    const btnSalva = document.getElementById('btn-salva-estrazione');
    errDiv.classList.add('hidden');

    const inputDataStr = document.getElementById('ins-data').value;
    if (!inputDataStr) { mostraErroreInserimento("Seleziona una data valida."); return; }

    if (databaseEstrazioni.data.length > 0) {
        const ultimaPresenteStr = databaseEstrazioni.data[databaseEstrazioni.data.length - 1].data;
        if (inputDataStr <= ultimaPresenteStr) {
            mostraErroreInserimento(`La data deve essere maggiore dell'ultima presente (${formattaDataPerUomo(ultimaPresenteStr)}).`);
            return;
        }
    }

    const numeri = [];
    for (let i = 1; i <= 6; i++) {
        const val = parseInt(document.getElementById(`n${i}`).value);
        if (isNaN(val) || val < 1 || val > 90) { mostraErroreInserimento("I numeri della sestina devono essere tra 1 e 90."); return; }
        numeri.push(val);
    }

    const duplicati = numeri.filter((item, index) => numeri.indexOf(item) !== index);
    if (duplicati.length > 0) { mostraErroreInserimento("Ci sono numeri duplicati nella sestina."); return; }

    const j = parseInt(document.getElementById('nj').value);
    const ss = parseInt(document.getElementById('nss').value);
    if (isNaN(j) || j < 1 || j > 90 || isNaN(ss) || ss < 1 || ss > 90) { mostraErroreInserimento("Jolly e SuperStar devono essere tra 1 e 90."); return; }

    btnSalva.disabled = true;
    btnSalva.innerText = "Salvataggio in corso...";

    const nuovoRecord = {
        data: inputDataStr, n1: numeri[0], n2: numeri[1], n3: numeri[2],
        n4: numeri[3], n5: numeri[4], n6: numeri[5], jolly: j, superstar: ss
    };

    try {
        const { error } = await _supabase.from('estrazioni').insert([nuovoRecord]);
        if (error) throw error;

        document.getElementById('ins-data').value = "";
        for (let i = 1; i <= 6; i++) document.getElementById(`n${i}`).value = "";
        document.getElementById('nj').value = ""; 
        document.getElementById('nss').value = "";

        alert("Estrazione salvata online sul Cloud con successo!");
        await sincronizzaDalCloud();
        mostraSchermata('screen-main');
    } catch (err) {
        console.error(err);
        alert("Errore durante il salvataggio sul cloud. Riprova.");
    } finally {
        btnSalva.disabled = false;
        btnSalva.innerText = "Salva nel Database Cloud";
    }
}

// Importazione massiva del file TXT
export function importaFileSuCloud(inputElement) {
    const file = inputElement.files[0];
    if (!file) return;

    if (!confirm("Attenzione: Questa operazione cancellerà la tabella online e caricherà tutte le estrazioni del file sul Cloud. Continuare?")) {
        inputElement.value = "";
        return;
    }

    const reader = new FileReader();
    reader.onload = async function(e) {
        const testo = e.target.result;
        const righe = testo.split(/\r?\n/);
        let recordDaCaricare = [];

        for (let idx = 0; idx < righe.length; idx++) {
            let riga = righe[idx].trim();
            if (!riga || riga.toLowerCase().startsWith('data')) continue;

            const campi = riga.split(/\s+/);
            if (campi.length >= 9) {
                const parti = campi[0].split('-');
                if (parti.length === 3) {
                    const giorno = parseInt(parti[0]);
                    const meseTesto = parti[1].toLowerCase().substring(0, 3);
                    let anno = parseInt(parti[2]);
                    if (anno < 100) anno += (anno > 50) ? 1900 : 2000;
                    const mese = mesiIta[meseTesto];

                    if (mese !== undefined && !isNaN(giorno) && !isNaN(anno)) {
                        const dataIsoStr = new Date(Date.UTC(anno, mese, giorno, 0, 0, 0)).toISOString().split('T')[0];
                        recordDaCaricare.push({
                            data: dataIsoStr, n1: parseInt(campi[1]), n2: parseInt(campi[2]), n3: parseInt(campi[3]),
                            n4: parseInt(campi[4]), n5: parseInt(campi[5]), n6: parseInt(campi[6]),
                            jolly: parseInt(campi[7]), superstar: parseInt(campi[8])
                        });
                    }
                }
            }
        }

        if (recordDaCaricare.length === 0) {
            alert("Errore: Nessun dato valido trovato nel file .txt.");
            inputElement.value = "";
            return;
        }

        document.getElementById('lbl-ultima-data').innerText = "Scrittura Cloud...";

        try {
            const { error: deleteError } = await _supabase.from('estrazioni').delete().neq('jolly', 0); 
            if (deleteError) throw deleteError;

            const dimensioneBlocco = 200;
            for (let i = 0; i < recordDaCaricare.length; i += dimensioneBlocco) {
                const blocco = recordDaCaricare.slice(i, i + dimensioneBlocco);
                const { error: insertError } = await _supabase.from('estrazioni').insert(blocco);
                if (insertError) throw insertError;
            }

            alert(`Successo! Sincronizzate sul Cloud ${recordDaCaricare.length} estrazioni corrette.`);
            await sincronizzaDalCloud();
        } catch (err) {
            console.error(err);
            alert("Errore durante il caricamento dei dati su Supabase.");
            await sincronizzaDalCloud();
        }
    };
    reader.readAsText(file);
    inputElement.value = ""; 
}