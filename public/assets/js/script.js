/**
 * @file Main application script for jgwalsh.com
 * @description Handles mobile menu toggling and Chart.js initialization.
 */

/**
 * Toggles the visibility of the mobile navigation menu.
 * Manages ARIA attributes for accessibility.
 */
function toggleMenu() {
    const menu = document.getElementById('mobile-menu');
    if (menu) {
      const isExpanded = menu.getAttribute('aria-expanded') === 'true';
      menu.classList.toggle('hidden');
      menu.setAttribute('aria-expanded', !isExpanded);
    }
  }
  
  // --- Event Listener for DOM Content Loaded ---
  document.addEventListener('DOMContentLoaded', () => {
    
    // --- Chart.js Initialization ---
    const ctx = document.getElementById('project-chart')?.getContext('2d');
    if (ctx) {
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['2021', '2022', '2023', '2024'],
          datasets: [{
            label: 'Total Part I Violent Crimes',
            data: [900, 966, 950, 920], // Approximate data
            backgroundColor: ['#1e3a8a', '#4b6e5d', '#1e3a8a', '#4b6e5d'],
            borderWidth: 1
          }]
        },
        options: {
          scales: {
            y: {
              beginAtZero: true,
              title: { display: true, text: 'Number of Incidents', font: { size: 14 } }
            },
            x: {
              title: { display: true, text: 'Year', font: { size: 14 } }
            }
          },
          plugins: {
            legend: { display: false },
            title: { display: true, text: 'Part I Violent Crimes in Albany', font: { size: 16 } }
          },
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 1000, easing: 'easeOutQuart' }
        }
      });
    }
  
    // Attach the toggleMenu function to the button if it exists
    const menuButton = document.querySelector('button[aria-controls="mobile-menu"]');
    if (menuButton) {
        menuButton.addEventListener('click', toggleMenu);
    }
  });