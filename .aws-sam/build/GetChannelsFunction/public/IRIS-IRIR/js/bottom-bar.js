// Show/hide bottom bar in sync with dashboard visibility
(function() {
  var bar = document.getElementById('irisBottomBar');
  if (!bar) return;
  var dash = document.getElementById('dashboard');
  if (!dash) return;

  function syncBar() {
    bar.style.display = dash.classList.contains('show') ? 'flex' : 'none';
  }

  // MutationObserver to watch dashboard class changes
  var obs = new MutationObserver(syncBar);
  obs.observe(dash, { attributes: true, attributeFilter: ['class'] });
  syncBar(); // initial check
})();
</script>
