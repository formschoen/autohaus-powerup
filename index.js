// Trello Power-Up Client initialisieren
const t = window.TrelloPowerUp;

t.initialize({
  // Card Back Section (Formular direkt in der Karte - immer sichtbar!)
  'card-back-section': function (t) {
    return {
      title: '🚗 Autohaus Abrechnung',
      icon: 'https://cdn-icons-png.flaticon.com/512/2693/2693507.png',
      content: {
        type: 'iframe',
        url: window.location.origin + '/autohaus-powerup/index.html'
      }
    };
  },

  // Card Buttons anzeigen (optional, als Alternative)
  'card-buttons': function (t) {
    return [{
      icon: 'https://cdn-icons-png.flaticon.com/512/2693/2693507.png',
      text: 'Abrechnung öffnen',
      callback: function (t) {
        return t.popup({
          title: 'Autohaus Abrechnung',
          url: window.location.origin + '/autohaus-powerup/index.html'
        });
      }
    }];
  },

  // Card Badges (zeigt Gesamtbetrag auf der Karte)
  'card-badges': async function (t) {
    const data = await t.getData('card', ['gesamtbetrag', 'betrag_pro_standort']);

    if (data.gesamtbetrag) {
      return [{
        icon: 'https://cdn-icons-png.flaticon.com/512/2693/2693507.png',
        text: `${parseFloat(data.gesamtbetrag).toFixed(2)}€`,
        color: data.betrag_pro_standort ? 'blue' : 'gray'
      }];
    }
    return [];
  },

  // Card Detail Section (unser Formular)
  'card-detail-badges': async function (t) {
    return [];
  }
});

// Formular-Logik (nur wenn direkt im iframe geladen)
document.addEventListener('DOMContentLoaded', function () {
  const autohausSelect = document.getElementById('autohaus');
  const standorteInput = document.getElementById('standorte');
  const paketSelect = document.getElementById('paket');
  const stundenInput = document.getElementById('stunden');
  const gesamtbetragInput = document.getElementById('gesamtbetrag');
  const betragProStandortInput = document.getElementById('betrag_pro_standort');
  const berechnungBadge = document.getElementById('berechnung-badge');
  const saveBtn = document.getElementById('save-btn');
  const abrechnungBtn = document.getElementById('abrechnung-btn');

  // Nur wenn Formular-Elemente existieren (nicht im Power-Up Kontext)
  if (!autohausSelect) return;

  // Daten laden wenn Power-Up geöffnet wird
  loadData();

  // Berechnung bei Änderungen
  paketSelect.addEventListener('change', calculateAmount);
  stundenInput.addEventListener('input', calculateAmount);
  standorteInput.addEventListener('input', calculateAmount);
  gesamtbetragInput.addEventListener('input', calculateAmount);

  // Speichern Button
  saveBtn.addEventListener('click', saveData);

  // Zur Abrechnung Button
  abrechnungBtn.addEventListener('click', moveToAbrechnung);

  // Funktion: Daten aus Trello laden
  async function loadData() {
    try {
      const data = await t.getData('card', [
        'autohaus', 'standorte', 'paket', 'stunden',
        'gesamtbetrag', 'betrag_pro_standort'
      ]);

      if (data.autohaus) autohausSelect.value = data.autohaus;
      if (data.standorte) standorteInput.value = data.standorte;
      if (data.paket) paketSelect.value = data.paket;
      if (data.stunden) stundenInput.value = data.stunden;
      if (data.gesamtbetrag) gesamtbetragInput.value = data.gesamtbetrag;
      if (data.betrag_pro_standort) {
        betragProStandortInput.value = data.betrag_pro_standort;
        updateBadge(data.betrag_pro_standort);
      }

      // Berechnung aktualisieren
      calculateAmount();
    } catch (error) {
      console.error('Fehler beim Laden:', error);
    }
  }

  // Funktion: Betrag berechnen
  function calculateAmount() {
    const paketValue = paketSelect.value;
    const stunden = parseFloat(stundenInput.value) || 0;
    const standorte = parseInt(standorteInput.value) || 1;
    let gesamtbetrag = parseFloat(gesamtbetragInput.value) || 0;

    // Wenn Paket ausgewählt ist, Stunden und Betrag übernehmen
    if (paketValue) {
      const parts = paketValue.split('|');
      const paketStunden = parseFloat(parts[1]);
      const paketBetrag = parseFloat(parts[2]);

      // Nur aktualisieren wenn Gesamtbetrag noch 0 ist (manuelle Änderung respektieren)
      if (gesamtbetrag === 0) {
        gesamtbetrag = paketBetrag;
        gesamtbetragInput.value = paketBetrag;
      }
    } else {
      // Ohne Paket: Stunden × 85€
      if (gesamtbetrag === 0 && stunden > 0) {
        gesamtbetrag = stunden * 85;
        gesamtbetragInput.value = gesamtbetrag.toFixed(2);
      }
    }

    // Betrag pro Standort berechnen
    const betragProStandort = standorte > 0 ? gesamtbetrag / standorte : 0;
    betragProStandortInput.value = betragProStandort.toFixed(2);
    updateBadge(betragProStandort.toFixed(2));
  }

  // Funktion: Badge aktualisieren
  function updateBadge(betrag) {
    berechnungBadge.textContent = `💰 Betrag pro Standort: ${parseFloat(betrag).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  }

  // Funktion: Daten in Trello speichern
  async function saveData() {
    try {
      await t.setData('card', {
        autohaus: autohausSelect.value,
        standorte: standorteInput.value,
        paket: paketSelect.value,
        stunden: stundenInput.value,
        gesamtbetrag: gesamtbetragInput.value,
        betrag_pro_standort: betragProStandortInput.value
      });

      alert('✅ Daten gespeichert!');

      // Badge aktualisieren
      t.trigger('card-badges');
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      alert('❌ Fehler beim Speichern: ' + error.message);
    }
  }

  // Funktion: Karte zur Abrechnung bewegen
  async function moveToAbrechnung() {
    try {
      // Erst speichern
      await saveData();

      // Board-ID für "Abrechnung" Board (musst du anpassen!)
      const abrechnungBoardId = 'DEINE_ABRECHNUNG_BOARD_ID';

      // Karte bewegen
      await t.moveCard(abrechnungBoardId);

      alert('✅ Karte zur Abrechnung bewegt!');
    } catch (error) {
      console.error('Fehler beim Bewegen:', error);
      alert('❌ Fehler: ' + error.message);
    }
  }
});