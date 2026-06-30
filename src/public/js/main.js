document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('connectForm');
  const statusMessage = document.getElementById('statusMessage');
  const pairingCodeSection = document.getElementById('pairingCode');
  const codeDisplay = document.getElementById('codeDisplay');
  const connectBtn = document.getElementById('connectBtn');
  const adminContact = document.getElementById('adminContact');

  fetch('/api/health')
    .then(() => {
      adminContact.textContent = '+27 68 655 4670';
      adminContact.href = 'https://wa.me/27686554670';
    })
    .catch(console.error);

  function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
    statusMessage.style.display = 'block';
  }

  function hideStatus() {
    statusMessage.style.display = 'none';
  }

  function setLoading(loading) {
    connectBtn.disabled = loading;
    connectBtn.innerHTML = loading ? '<span class="spinner"></span> Connecting...' : 'Connect Bot';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideStatus();

    const passkey = document.getElementById('passkey').value.trim();
    const phoneNumber = document.getElementById('phoneNumber').value.trim();

    if (passkey.length !== 30) {
      showStatus('Passkey must be exactly 30 characters', 'error');
      return;
    }

    const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
    if (cleanNumber.length < 10) {
      showStatus('Please enter a valid phone number with country code', 'error');
      return;
    }

    setLoading(true);

    try {
      const validateRes = await fetch('/api/validate-passkey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passkey }),
      });

      const validateData = await validateRes.json();

      if (!validateData.valid) {
        showStatus('Invalid or expired passkey. Contact admin for a new one.', 'error');
        setLoading(false);
        return;
      }

      showStatus('Passkey valid! Generating pairing code...', 'info');

      const connectRes = await fetch('/api/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: cleanNumber,
          passkey,
        }),
      });

      const connectData = await connectRes.json();

      if (connectData.error) {
        showStatus(connectData.error, 'error');
        setLoading(false);
        return;
      }

      showStatus('Pairing code generated successfully!', 'success');
      codeDisplay.textContent = connectData.pairingCode;
      pairingCodeSection.style.display = 'block';
      form.style.display = 'none';
    } catch (error) {
      console.error('Connection error:', error);
      showStatus('Connection failed. Please try again.', 'error');
    }

    setLoading(false);
  });

  document.getElementById('passkey').addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase();
  });

  document.getElementById('phoneNumber').addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^0-9+]/g, '');
  });
});
