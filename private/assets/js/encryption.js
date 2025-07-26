// private/assets/js/encryption.js
(function() {
  // Ensure cryptoManager namespace
  window.cryptoManager = window.cryptoManager || {};

  /**
   * Get or generate a 256-bit AES-GCM key, stored in localStorage as JWK.
   * @returns {Promise<CryptoKey>} The AES-GCM CryptoKey.
   */
  window.cryptoManager.getKey = async function() {
    if (this._key) return this._key;
    const stored = localStorage.getItem('encryptionKey');
    let key;
    if (stored) {
      const jwk = JSON.parse(stored);
      key = await crypto.subtle.importKey(
        'jwk',
        jwk,
        { name: 'AES-GCM' },
        true,
        ['encrypt', 'decrypt']
      );
    } else {
      key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
      const jwk = await crypto.subtle.exportKey('jwk', key);
      localStorage.setItem('encryptionKey', JSON.stringify(jwk));
    }
    this._key = key;
    return key;
  };

  /**
   * Encrypt a File object using AES-GCM.
   * @param {File} file The file to encrypt.
   * @returns {Promise<{ciphertext: Uint8Array, iv: Uint8Array}>}
   */
  window.cryptoManager.encryptFile = async function(file) {
    const key = await this.getKey();
    // 96-bit IV recommended for AES-GCM
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await file.arrayBuffer();
    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );
    return {
      ciphertext: new Uint8Array(encryptedBuffer),
      iv
    };
  };
})(); 