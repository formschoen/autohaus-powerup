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
    status.style.marginTop = '12px';
    status.style.minHeight = '20px';
    status.style.fontWeight = '600';
    saveBtn.parentNode.parentNode.appendChild(status);

    function showStatus(kind, text) {
      status.textContent = text;
      status.style.color = kind === 'success' ? '#7ee2b8' : kind === 'saving' ? '#9fc5ff' : '#ff9c8f';
    }

    function selectedStandorte() {
      return Array.from(standorteCheckboxes).filter(cb => cb.checked).map(cb => cb.value);
    }

    function updateBadge(value) {
      const amount = Number(value) || 0;
      badge.textContent = `💰 Betrag pro Standort: ${amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
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

    async function loadData() {
      try {
        const data = await iframeT.get('card', 'shared');
        console.log('Von Trello geladene Card-Daten:', data);
        const values = data || {};
        if (Array.isArray(values.standorte)) standorteCheckboxes.forEach(cb => cb.checked = values.standorte.includes(cb.value));
        if (values.abrechnungstyp) {
          const radio = document.querySelector(`input[name="abrechnungstyp"][value="${values.abrechnungstyp}"]`);
          if (radio) radio.checked = true;
        }
        if (values.paket) paketSelect.value = values.paket;
        if (values.stunden !== undefined) stundenInput.value = values.stunden;
        if (values.gesamtbetrag !== undefined) gesamtbetragInput.value = values.gesamtbetrag;
        const type = document.querySelector('input[name="abrechnungstyp"]:checked')?.value;
        paketField.classList.toggle('hidden', type === 'stunden');
        stundenField.classList.toggle('hidden', type !== 'stunden');
        calculateAmount();
      } catch (error) {
        console.error('Fehler beim Laden:', error);
        showStatus('error', '✕ Laden fehlgeschlagen: ' + error.message);
      }
    }

    async function saveData() {
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

      console.log('Zu Trello gesendete Card-Daten:', values);

      // Kein await: In dieser Card-Back-Implementierung beendet Trello den RPC-Aufruf nicht zuverlässig.
      iframeT.set('card', 'shared', values)
        .then(function () {
          console.log('Trello set() erfolgreich abgeschlossen.');
          saveBtn.textContent = '✓ Gespeichert';
          showStatus('success', '✓ Erfolgreich auf der Karte gespeichert.');
        })
        .catch(function (error) {
          console.error('Fehler beim Speichern:', error);
          saveBtn.textContent = '✕ Nicht gespeichert';
          showStatus('error', '✕ Speichern fehlgeschlagen: ' + error.message);
        })
        .finally(function () {
          window.setTimeout(function () {
            saveBtn.disabled = false;
            saveBtn.textContent = '💾 Speichern';
          }, 3000);
        });
    }

    function switchType() {
      const hours = document.querySelector('input[name="abrechnungstyp"]:checked')?.value === 'stunden';
      paketField.classList.toggle('hidden', hours);
      stundenField.classList.toggle('hidden', !hours);
      calculateAmount();
    }

    radios.forEach(radio => radio.addEventListener('change', switchType));
    paketSelect.addEventListener('change', calculateAmount);
    stundenInput.addEventListener('input', calculateAmount);
    gesamtbetragInput.addEventListener('input', calculateAmount);
    standorteCheckboxes.forEach(cb => cb.addEventListener('change', calculateAmount));
    saveBtn.addEventListener('click', saveData);
    moveBtn.addEventListener('click', function () {
      saveData();
      alert('ℹ️ Die Board-ID für den Wechsel zur Abrechnung muss noch eingetragen werden.');
    });

    loadData();
  });
}