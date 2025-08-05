let cpuChart;
let ramChart;

const cpuData = {
  labels: [],
  datasets: [{
    label: 'CPU Usage (%)',
    data: [],
    borderColor: 'rgb(75, 192, 192)',
    fill: false,
    tension: 0.1,
    pointRadius: 3,
    pointHoverRadius: 5
  }]
};

const ramData = {
  labels: [],
  datasets: [{
    label: 'Used RAM (%)',
    data: [],
    borderColor: 'rgb(255, 99, 132)',
    fill: false,
    tension: 0.1,
    pointRadius: 3,
    pointHoverRadius: 5
  }]
};

function createCPUChart() {
  const ctx = document.getElementById('cpuChart').getContext('2d');
  cpuChart = new Chart(ctx, {
    type: 'line',
    data: cpuData,
    options: getChartOptions()
  });
}

function createRAMChart() {
  const ctx = document.getElementById('ramChart').getContext('2d');
  ramChart = new Chart(ctx, {
    type: 'line',
    data: ramData,
    options: getChartOptions()
  });
}

function getChartOptions() {
  return {
    responsive: true,
    animation: false,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true },
      tooltip: {
        mode: 'nearest',
        intersect: true // Tooltip only when directly on point
      }
    },
    scales: {
      x: {
        type: 'category',
        ticks: {
          autoSkip: false,
          callback: function(value, index, ticks) {
            const label = this.getLabelForValue(value);
            const parts = label.split(', ');
            return parts;
          }
        },
        grid: {
          drawOnChartArea: true,
          color: 'rgba(0,0,0,0.1)',
          lineWidth: 1
        }
      },
      y: {
        min: 0,
        max: 100,
        ticks: {
          stepSize: 20,
          callback: (value) => `${value}%`
        },
        grid: {
          color: 'rgba(0,0,0,0.05)'
        }
      }
    }
  };
}

async function loadData() {
  try {
    const response = await fetch('./data.json');
    const fData = await response.json();
    const latest = fData[fData.length - 1];
    const maxPoints = 15;

    // ---- CPU ----
    cpuData.labels = [];
    cpuData.datasets[0].data = [];
    fData.slice(-maxPoints).forEach(point => {
      const ts = formatTime(point.Time);
      cpuData.labels.push(ts);
      cpuData.datasets[0].data.push(point.CPU);
    });

    const latestCPU = cpuData.datasets[0].data.at(-1);
    const cpuStatus = document.getElementById('cpuStatus');
    if (latestCPU > 80) {
      cpuStatus.innerHTML = `<span class="low-space">${latestCPU}% (High)</span>`;
      cpuChart.data.datasets[0].borderColor = 'red';
    } else {
      cpuStatus.innerHTML = `${latestCPU}%`;
      cpuChart.data.datasets[0].borderColor = 'rgb(75, 192, 192)';
    }

    cpuChart.update();

    // ---- RAM ----
    ramData.labels = [];
    ramData.datasets[0].data = [];
    fData.slice(-maxPoints).forEach(point => {
      const ts = formatTime(point.Time);
      ramData.labels.push(ts);
      const used = (100 - (point.RAMFreeGB / point.TotalRAMGB) * 100).toFixed(2);
      ramData.datasets[0].data.push(parseFloat(used));
    });

    const latestRAM = (100 - (latest.RAMFreeGB / latest.TotalRAMGB) * 100).toFixed(2);
    const ramStatus = document.getElementById('ramStatus');
    ramStatus.innerHTML = `<div class="${latestRAM > 75 ? 'low-space' : ''}">
      ${latest.RAMFreeGB} GB Free (${latestRAM}%) / ${latest.TotalRAMGB} GB Total
    </div>`;

    ramChart.update();

    // ---- DISK ----
    const disk = document.getElementById('disk');
    disk.innerHTML = latest.Disk.map(d => {
      const freePct = ((d.FreeGB / d.SizeGB) * 100).toFixed(2);
      return `<div class="disk-item ${freePct < 25 ? 'low-space' : ''}">
        ${d.DeviceID}: ${d.FreeGB} GB Free (${freePct}% / ${d.SizeGB} GB Total)
      </div>`;
    }).join('');

    // ---- BOOT ----
    document.getElementById('boot').innerText = new Date(latest.LastBoot).toLocaleString();

  } catch (err) {
    console.error('Failed to load data:', err);
  }
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  return new Date(timeStr).toLocaleTimeString('en-GB', {
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  });
}

document.addEventListener('DOMContentLoaded', () => {
  createCPUChart();
  createRAMChart();
  loadData();
  setInterval(loadData, 5000);
});
