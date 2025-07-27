// assets/js/encryption.js
window.cryptoManager = {
  /**
   * Generate or return a cached 256-bit AES-GCM key.
   * @returns {Promise<CryptoKey>}
   */
  async getKey() {
    if (!this._key) {
      this._key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
    }
    return this._key;
  },
  /**
   * Encrypt a File object using AES-GCM.
   * @param {File} file
   * @returns {{ciphertext: Uint8Array, iv: Uint8Array}}
   */
  async encryptFile(file) {
    console.log('Encrypt file called:', file.name);
    const key = await this.getKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const buffer = await file.arrayBuffer();
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      buffer
    );
    return { ciphertext: new Uint8Array(encrypted), iv };
  }
};
console.log('Encryption module loaded and ready.'); 