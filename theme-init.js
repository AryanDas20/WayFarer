// Set the saved theme before the main stylesheet paints.
try {
  const saved = localStorage.getItem('wayfarer.theme');
  if (saved === 'light' || saved === 'dark') document.documentElement.dataset.theme = saved;
  else if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) document.documentElement.dataset.theme = 'dark';
} catch (_) {
  // Private browsing or disabled storage: use the stylesheet's light default.
}
