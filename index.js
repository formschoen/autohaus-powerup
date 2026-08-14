const t = window.TrelloPowerUp;

if (!t) {
  console.error('Trello Power-Up SDK wurde nicht geladen.');
} else {
  t.initialize({
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
    'card-badges': async function (t) {
      const data = await t.getData('card', ['gesamtbetrag']);
      if (!data.gesamtbetrag) return [];
      return [{
        icon: 'https://cdn-icons-png.flaticon.com/512/2693/2693507.png',
        text: `${parseFloat(data.gesamtbetrag).toFixed(2)} €`,
        color: 'blue'
      }];
    }
  });

  document.addEventListener('DOMContentLoaded', function () {
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
        const parts = paketSelect.value.split('|');
        total = Number(parts[2]) || 0;
        gesamtbetragInput.value = total.toFixed(2);
      }

      if (type === 'stunden') {
        const hours = Number(stundenInput.value) || 0;
        total = hours * 85;
        gesamtbetragInput.value = total ? total.toFixed(2) : '';
      }

      const count = selectedStandorte().length;
      updateBadge(count ? total / count : 0);
    }

    async function loadData() {
      try {
        const data = await t.getData('card', ['standorte', 'paket', 'stunden', 'gesamtbetrag', 'betrag_pro_standort', 'abrechnungstyp']);
        if (Array.isArray(data.standorte)) {
          standorteCheckboxes.forEach(cb => cb.checked = data.standorte.includes(cb.value));
        }
        if (data.abrechnungstyp) {
          const radio = document.querySelector(`input[name="abrechnungstyp"][value="${data.abrechnungstyp}"]`);
          if (radio) radio.checked = true;
        }
        if (data.paket) paketSelect.value = data.paket;
        if (data.stunden) stundenInput.value = data.stunden;
        if (data.gesamtbetrag) gesamtbetragInput.value = data.gesamtbetrag;

        const type = document.querySelector('input[name="abrechnungstyp"]:checked')?.value;
        paketField.classList.toggle('hidden', type === 'stunden');
        stundenField.classList.toggle('hidden', type !== 'stunden');
        calculateAmount();
      } catch (error) {
        console.error('Fehler beim Laden:', error);
      }
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

    async function saveData() {
      try {
        const amountText = badge.textContent.replace('💰 Betrag pro Standort: ', '').replace(' €', '').replace('.', '').replace(',', '.');
        await t.setData('card', {
          standorte: selectedStandorte(),
          paket: paketSelect.value,
          stunden: stundenInput.value,
          gesamtbetrag: gesamtbetragInput.value,
          betrag_pro_standort: (Number(amountText) || 0).toFixed(2),
          abrechnungstyp: document.querySelector('input[name="abrechnungstyp"]:checked')?.value || 'paket'
        });
        alert('✅ Daten gespeichert!');
      } catch (error) {
        console.error('Fehler beim Speichern:', error);
        alert('❌ Fehler beim Speichern: ' + error.message);
      }
    }

    async function moveToAbrechnung() {
      await saveData();
      alert('ℹ️ Die Board-ID für den Wechsel zur Abrechnung muss noch eingetragen werden.');
    }

    saveBtn.addEventListener('click', saveData);
    moveBtn.addEventListener('click', moveToAbrechnung);
    loadData();
  });
}