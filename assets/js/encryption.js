// assets/js/encryption.js
window.cryptoManager = {
  key: null,
  async getKey() {
    if (!this.key) {
      this.key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt']
      );
    }
    return this.key;
  },
  async encryptFile(file) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const arrayBuffer = await file.arrayBuffer();
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.key,
      arrayBuffer
    );
    return { ciphertext: new Uint8Array(ciphertext), iv };
  }
};
console.log('Encryption module loaded and ready.'); 