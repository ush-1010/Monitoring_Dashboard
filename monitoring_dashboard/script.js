let cpuChart;
const cpuData = {
  labels: [],
  datasets: [{
    label: 'CPU Usage (%)',
    data: [],
    borderColor: 'rgb(75, 192, 192)',
    fill: false,
    tension: 0.1
  }]
};

function createCPUChart() {
  const ctx = document.getElementById('cpuChart').getContext('2d');
  cpuChart = new Chart(ctx, {
    type: 'line',
    data: cpuData,
    options: {
      responsive: true,
      animation: false,
      scales: {
        y: {
          min: 0,
          max: 100,
          beginAtZero: true,
          ticks: {
            stepSize: 10,
            precision: 0,
            callback: function(value) {
              return value + '%';
            }
          }
        }
      }
    }
  });
}

async function loadData() {
  try {
    const response = await fetch('./data.json');
    const cData = await response.json();
    const data = cData[cData.length - 1];
    const maxPoints = 10;

    cpuData.labels = [];
    cpuData.datasets[0].data = [];

    cData.slice(-maxPoints).forEach(point => {
      const timestamp = point.Time ? new Date(point.Time).toLocaleTimeString() : '';
      cpuData.labels.push(timestamp);
      cpuData.datasets[0].data.push(point.CPU);
    });

    cpuChart.update();

    const ram = document.getElementById('ram');
    const ramFreePercent = ((data.RAMFreeGB / data.TotalRAMGB) * 100).toFixed(2);
    const ramThreshold = 25;
    const ramClass = ramFreePercent < ramThreshold ? 'low-space' : '';

    ram.innerHTML = `<div class="\${ramClass}">
      \${data.RAMFreeGB} GB Free (\${ramFreePercent}%) / \${data.TotalRAMGB} GB Total
    </div>`;

    const disk = document.getElementById('disk');
    let diskHTML = '';
    data.Disk.forEach(d => {
      const freePercent = ((d.FreeGB / d.SizeGB) * 100).toFixed(2);
      const low = freePercent < 25 ? 'low-space' : '';
      diskHTML += `<div class="disk-item \${low}">
        \${d.DeviceID}: \${d.FreeGB} GB Free (\${freePercent}%) / \${d.SizeGB} GB Total
      </div>`;
    });
    disk.innerHTML = diskHTML;

    const boot = document.getElementById('boot');
    boot.innerText = new Date(data.LastBoot).toLocaleString();

  } catch (error) {
    console.error('Error:', error);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  createCPUChart();
  loadData();
  setInterval(loadData, 5000);
});
