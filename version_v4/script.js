let cpuChart, ramChart;
let showHistory = false;

function createCPUChart() {
  const ctx = document.getElementById('cpuChart').getContext('2d');
  cpuChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'CPU Usage (%)',
        data: [],
        borderColor: '#3e95cd',
        fill: false,
        tension: 0.2,
        pointRadius: 2,
        pointHoverRadius: 6
      }]
    },
    options: getChartOptions()
  });
}

function createRAMChart() {
  const ctx = document.getElementById('ramChart').getContext('2d');
  ramChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'RAM Usage (%)',
        data: [],
        borderColor: '#8e5ea2',
        fill: false,
        tension: 0.2,
        pointRadius: 2,
        pointHoverRadius: 6
      }]
    },
    options: getChartOptions()
  });
}

function getChartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: { display: true },
      tooltip: {
        intersect: true,
        mode: 'nearest'
      }
    },
    scales: {
      x: {
        type: 'category',
        ticks: {
          autoSkip: false,
          maxRotation: 45,
          callback: function(value) {
            return this.getLabelForValue(value).split(', ');
          }
        },
        grid: { drawOnChartArea: true, color: 'rgba(0,0,0,0.1)', lineWidth: 1 }
      },
      y: {
        min: 0,
        max: 100,
        ticks: {
          stepSize: 20,
          callback: (val) => val + '%'
        },
        grid: { color: 'rgba(0,0,0,0.05)' }
      }
    }
  };
}

function updateChartWidth(enableWide) {
  const cpu = document.getElementById('cpuChartContainer');
  const ram = document.getElementById('ramChartContainer');

  if (enableWide) {
    cpu.classList.add('wide-chart');
    ram.classList.add('wide-chart');
  } else {
    cpu.classList.remove('wide-chart');
    ram.classList.remove('wide-chart');
  }
}

function loadData() {
  fetch('data.json')
    .then(res => res.json())
    .then(fData => {
      const maxPoints = 15;
      const dataPoints = showHistory ? fData : fData.slice(-maxPoints);

      // CPU Chart
      cpuChart.data.labels = [];
      cpuChart.data.datasets[0].data = [];
      dataPoints.forEach(point => {
        const ts = formatTime(point.Time);
        cpuChart.data.labels.push(ts);
        cpuChart.data.datasets[0].data.push(point.CPU);
      });
      cpuChart.update();

      // RAM Chart
      ramChart.data.labels = [];
      ramChart.data.datasets[0].data = [];
      dataPoints.forEach(point => {
        const ts = formatTime(point.Time);
        const used = 100 - (point.RAMFreeGB / point.TotalRAMGB) * 100;
        ramChart.data.labels.push(ts);
        ramChart.data.datasets[0].data.push(parseFloat(used.toFixed(2)));
      });
      ramChart.update();

      // Status values
      const latest = dataPoints[dataPoints.length - 1];
      document.getElementById('cpuStatus').textContent = `Current CPU: ${latest.CPU.toFixed(2)}%`;
      const ramUsed = 100 - (latest.RAMFreeGB / latest.TotalRAMGB) * 100;
      document.getElementById('ramStatus').textContent = `Current RAM: ${ramUsed.toFixed(2)}%`;

      // Disk
      const diskHtml = latest.Drives.map(d =>
        `${d.Name}: ${d.FreeGB.toFixed(1)} GB free of ${d.TotalGB.toFixed(1)} GB`
      ).join('<br>');
      document.getElementById('disk').innerHTML = diskHtml;

      // Boot time
      document.getElementById('boot').textContent = latest.Boot;
    });
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  }).replace(',', '');
}


document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('historyToggle').addEventListener('change', (e) => {
    showHistory = e.target.checked;
    updateChartWidth(showHistory);
    loadData(); // Refresh charts
  });

  createCPUChart();
  createRAMChart();
  loadData();
  setInterval(loadData, 5000);
});