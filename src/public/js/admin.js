document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('adminForm');
  const statusMessage = document.getElementById('statusMessage');
  const generatedSection = document.getElementById('generatedPasskey');
  const newPasskeyCode = document.getElementById('newPasskeyCode');
  const expiresAt = document.getElementById('expiresAt');
  const generateBtn = document.getElementById('generateBtn');
  const copyBtn = document.getElementById('copyBtn');
  const passkeyList = document.getElementById('passkeyList');
  const passkeysContainer = document.getElementById('passkeysContainer');

  let currentSecret = '';

  function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
    statusMessage.style.display = 'block';
  }

  function hideStatus() {
    statusMessage.style.display = 'none';
  }

  function setLoading(loading) {
    generateBtn.disabled = loading;
    generateBtn.innerHTML = loading
      ? '<span class="spinner"></span> Generating...'
      : 'Generate New Passkey';
  }

  function copyPasskey() {
    const passkey = newPasskeyCode.textContent;
    navigator.clipboard
      .writeText(passkey)
      .then(() => {
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = `
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5"/>
                  </svg>
                  Copied!
              `;
        setTimeout(() => {
          copyBtn.innerHTML = originalText;
        }, 2000);
      })
      .catch(() => {
        showStatus('Failed to copy', 'error');
      });
  }

  function formatDate(timestamp) {
    const date = new Date(typeof timestamp === 'number' ? timestamp : timestamp);
    return date.toLocaleString();
  }

  function getPasskeyStatus(passkey) {
    const now = Date.now();
    if (passkey.used_by) return 'used';
    if (passkey.expires_at < now) return 'expired';
    return 'valid';
  }

  function getStatusLabel(status, passkey) {
    if (status === 'used') return `Used`;
    if (status === 'expired') return 'Expired';
    return 'Available';
  }

  async function loadPasskeys(secret) {
    try {
      const res = await fetch(`/api/admin/passkeys?adminSecret=${encodeURIComponent(secret)}`);
      const data = await res.json();

      if (data.error) {
        passkeyList.style.display = 'none';
        return;
      }

      if (data.passkeys && data.passkeys.length > 0) {
        passkeyList.style.display = 'block';
        passkeysContainer.innerHTML = data.passkeys
          .map((pk, index) => {
            const status = getPasskeyStatus(pk);
            const statusLabel = getStatusLabel(status, pk);
            return `
                          <div class="passkey-item" style="animation-delay: ${index * 0.05}s">
                              <div class="passkey-info">
                                  <div class="passkey-code" onclick="navigator.clipboard.writeText('${
                                    pk.passkey
                                  }').then(() => this.style.opacity = '0.5').then(() => setTimeout(() => this.style.opacity = '1', 200))" title="Click to copy">
                                      ${pk.passkey}
                                  </div>
                                  <div class="passkey-meta">
                                      Created: ${formatDate(pk.created_at)}
                                      ${pk.used_by ? ` • Used by: ${pk.used_by}` : ''}
                                  </div>
                              </div>
                              <span class="passkey-status ${status}">${statusLabel}</span>
                          </div>
                      `;
          })
          .join('');
      } else {
        passkeysContainer.innerHTML = `
                      <div class="passkeys-empty">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z"/>
                          </svg>
                          <p>No passkeys generated yet</p>
                      </div>
                  `;
        passkeyList.style.display = 'block';
      }
    } catch (error) {
      console.error('Failed to load passkeys:', error);
    }
  }

  copyBtn.addEventListener('click', copyPasskey);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideStatus();

    const adminSecret = document.getElementById('adminSecret').value.trim();
    currentSecret = adminSecret;

    if (!adminSecret) {
      showStatus('Please enter the admin secret', 'error');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/admin/generate-passkey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminSecret }),
      });

      const data = await res.json();

      if (data.error) {
        showStatus(data.error, 'error');
        setLoading(false);
        return;
      }

      newPasskeyCode.textContent = data.passkey;
      expiresAt.textContent = formatDate(data.expiresAt);
      generatedSection.classList.add('show');
      generatedSection.style.display = 'block';
      showStatus('Passkey generated successfully!', 'success');

      await loadPasskeys(adminSecret);
    } catch (error) {
      console.error('Error:', error);
      showStatus('Failed to generate passkey. Check your connection.', 'error');
    }

    setLoading(false);
  });
});
