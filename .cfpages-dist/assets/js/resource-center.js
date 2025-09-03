function copyURL(url){
  try {
    const full = window.location.origin + url;
    navigator.clipboard.writeText(full);
    alert("Copied: " + url);
  } catch (e) {
    console.error('Copy failed', e);
  }
}


