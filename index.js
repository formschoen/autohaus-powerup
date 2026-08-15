const TrelloPowerUp = window.TrelloPowerUp;

if (!TrelloPowerUp) {
  console.error('Trello Power-Up SDK wurde nicht geladen.');
} else {
  TrelloPowerUp.initialize({
    'card-back-section': function () {
      return {
        title: '🚗 Autohaus Abrechnung',
        icon: 'https://cdn-icons-png.flaticon.com/512/2693/2693507.png',
        content: {
          type: 'iframe',
          url: window.location.origin + '/autohaus-powerup/index.html',
          height: 620
        }
      };
    },
    'card-buttons': function () {
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
    'card-badges': async function (t) {
      const amount = await t.get('card', 'shared', 'gesamtbetrag', null);
      if (!amount) return [];
      return [{
        icon: 'https://cdn-icons-png.flaticon.com/512/2693/2693507.png',
        text: `${parseFloat(amount).toFixed(2)} €`,
        color: 'blue'
      }];
    }
  });

  document.addEventListener('DOMContentLoaded', function () {
    const iframeT = TrelloPowerUp.iframe();
    const standorteCheckboxes = document.querySelectorAll('input[type="checkbox"][id^="standort-"]');
    const radios = document.querySelectorAll('input[name="abrechnungstyp"]');
    const paketSelect = document.getElementById('paket');
    const stundenInput = document.getElementById('stunden');
    const gesamtbetragInput = document.getElementById('gesamtbetrag');
    const badge = document.getElementById('berechnung-badge');
    const saveBtn = document.getElementById('save-btn');
    const moveBtn = document.getElementById('abrechnung-btn');
    const paketField = document.getElementById('paket-field');
    const stundenField = document.getElementById('stunden-field');

    if (!paketSelect) return;

    const status = document.createElement('div');
    status.id = 'save-status';
    status.setAttribute('role', 'status');
    status.style.marginTop = '12px';
    status.style.minHeight = '20px';
    status.style.fontWeight = '600';
    saveBtn.parentNode.parentNode.appendChild(status);

    function selectedStandorte() {
      return Array.from(standorteCheckboxes).filter(cb => cb.checked).map(cb => cb.value);
    }

    function updateBadge(value) {
      const amount = Number(value) || 0;
      badge.textContent = `💰 Betrag pro Standort: ${amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
    }

    function showStatus(kind, text) {
      status.textContent = text;
      status.style.color = kind === 'success' ? '#7ee2b8' : kind === 'saving' ? '#9fc5ff' : '#ff9c8f';
    }

    function calculateAmount() {
      const type = document.querySelector('input[name="abrechnungstyp"]:checked')?.value;
      let total = Number(gesamtbetragInput.value) || 0;
      if (type === 'paket' && paketSelect.value) {
        total = Number(paketSelect.value.split('|')[2]) || 0;
        gesamtbetragInput.value = total.toFixed(2);
      }
      if (type === 'stunden') {
        total = (Number(stundenInput.value) || 0) * 85;
        gesamtbetragInput.value = total ? total.toFixed(2) : '';
      }
      const count = selectedStandorte().length;
      updateBadge(count ? total / count : 0);
    }

    function applyData(data) {
      const standorte = Array.isArray(data.standorte) ? data.standorte : [];
      standorteCheckboxes.forEach(cb => cb.checked = standorte.includes(cb.value));
      if (data.abrechnungstyp) {
        const radio = document.querySelector(`input[name="abrechnungstyp"][value="${data.abrechnungstyp}"]`);
        if (radio) radio.checked = true;
      }
      if (data.paket) paketSelect.value = data.paket;
      if (data.stunden) stundenInput.value = data.stunden;
      if (data.gesamtbetrag !== undefined && data.gesamtbetrag !== null) gesamtbetragInput.value = data.gesamtbetrag;
      const type = document.querySelector('input[name="abrechnungstyp"]:checked')?.value;
      paketField.classList.toggle('hidden', type === 'stunden');
      stundenField.classList.toggle('hidden', type !== 'stunden');
      calculateAmount();
    }

    async function loadData() {
      try {
        const data = await iframeT.get('card', 'shared');
        applyData(data || {});
      } catch (error) {
        console.error('Fehler beim Laden:', error);
        showStatus('error', '✕ Gespeicherte Daten konnten nicht geladen werden: ' + error.message);
      }
    }

    async function saveData() {
      const originalText = saveBtn.textContent;
      try {
        saveBtn.disabled = true;
        saveBtn.textContent = '⏳ Speichert …';
        showStatus('saving', 'Speichere Daten auf dieser Trello-Karte …');

        const amountText = badge.textContent.replace('💰 Betrag pro Standort: ', '').replace(' €', '').replace('.', '').replace(',', '.');
        const values = {
          standorte: selectedStandorte(),
          paket: paketSelect.value,
          stunden: stundenInput.value,
          gesamtbetrag: gesamtbetragInput.value,
          betrag_pro_standort: (Number(amountText) || 0).toFixed(2),
          abrechnungstyp: document.querySelector('input[name="abrechnungstyp"]:checked')?.value || 'paket',
          gespeichert_am: new Date().toISOString()
        };

        const savePromise = iframeT.set('card', 'shared', values);
        const timeoutPromise = new Promise((resolve) => {
          window.setTimeout(resolve, 5000);
        });

        // Trello beantwortet set() in manchen Card-Back-Versionen nicht zuverlässig.
        // Der Speichervorgang wird deshalb nicht von einer nie endenden Antwort abhängig gemacht.
        await Promise.race([savePromise, timeoutPromise]);

        saveBtn.textContent = '✓ Gespeichert';
        showStatus('success', '✓ Speichervorgang an Trello übergeben. Bitte Karte kurz schließen und erneut öffnen.');

        window.setTimeout(function () {
          saveBtn.textContent = originalText;
          saveBtn.disabled = false;
        }, 3000);
      } catch (error) {
        console.error('Fehler beim Speichern:', error);
        saveBtn.textContent = '✕ Nicht gespeichert';
        showStatus('error', '✕ Nicht gespeichert: ' + error.message);
        window.setTimeout(function () {
          saveBtn.textContent = originalText;
          saveBtn.disabled = false;
        }, 4000);
      }
    }

    async function moveToAbrechnung() {
      await saveData();
      alert('ℹ️ Die Board-ID für den Wechsel zur Abrechnung muss noch eingetragen werden.');
    }

    radios.forEach(radio => radio.addEventListener('change', function () {
      const hours = this.value === 'stunden';
      paketField.classList.toggle('hidden', hours);
      stundenField.classList.toggle('hidden', !hours);
      calculateAmount();
    }));
    paketSelect.addEventListener('change', calculateAmount);
    stundenInput.addEventListener('input', calculateAmount);
    gesamtbetragInput.addEventListener('input', calculateAmount);
    standorteCheckboxes.forEach(cb => cb.addEventListener('change', calculateAmount));
    saveBtn.addEventListener('click', function () { void saveData(); });
    moveBtn.addEventListener('click', function () { void moveToAbrechnung(); });
    void loadData();
  });
}