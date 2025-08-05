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
    layout: {
      padding: {
        top: 0,
        bottom: 1,
      }
    },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          boxWidth: 12,
          padding: 0,
          font: {
            size: 12
          }
        }
      },
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

function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  }).replace(',', '');
}

function loadData() {
  fetch('data.json')
    .then(res => res.json())
    .then(fData => {
      const maxPoints = 15;
      const dataPoints = showHistory ? fData : fData.slice(-maxPoints);

      
      //console.log("Disk array:", diskPoints?.Disk);

      // CPU Chart
      cpuChart.data.labels = [];
      cpuChart.data.datasets[0].data = [];
      dataPoints.forEach(point => {
        const ts = formatTime(point.Time);
        cpuChart.data.labels.push(ts);
        cpuChart.data.datasets[0].data.push(point.CPU);
      });

      // CPU Status values
      const cpuThreshold = 70; // example threshold
      const lastestCPU = cpuChart.data.datasets[0].data.at(-1);
      const cpuStatus = document.getElementById('cpuStatus');

      cpuStatus.innerHTML = lastestCPU > cpuThreshold ? 
      `<span class="low-space">${lastestCPU}% (High)</span>` : `${lastestCPU}%`;
  
      cpuChart.data.datasets[0].borderColor = lastestCPU > cpuThreshold ? 'red' : 'rgb(75, 192, 192)';

      // Update CPU chart 
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

      // RAM Status values
      const ramThreshold = 70; // example threshold
      const ramPoints = dataPoints.at(-1);
      const ramStatusPercentage = ((1 - (ramPoints.RAMFreeGB / ramPoints.TotalRAMGB)) * 100).toFixed(2);
      const ramStatusText = `${ramPoints.RAMFreeGB} GB Free (${ramStatusPercentage}%) / ${ramPoints.TotalRAMGB} GB Total`;

      if (ramStatusPercentage > ramThreshold) {
        document.getElementById('ramStatus').innerHTML = `<span class="low-space"> ${ramStatusText} </span>`;
      } else {
        document.getElementById('ramStatus').innerHTML = ramStatusText;
      }
      
      ramChart.data.datasets[0].borderColor = ramStatusPercentage > ramThreshold ? 'red' : 'rgb(142, 94, 162)';
      
      // RAM Status values
      ramChart.update();

      


      // Disk
      const diskPoints = dataPoints.at(-1);
      const diskThreshold = 20; // % threshold for low disk space
      //const diskStatus = document.getElementById('diskStatus');
      let diskStatusText = '';

      diskPoints.Disk.forEach(d => {
        const diskfreePercent = ((d.FreeGB / d.SizeGB) * 100).toFixed(2);

        diskStatusText += `
        <div class="${diskfreePercent < diskThreshold ? 'low-space' : ''}">
          ${d.DeviceID}: (${diskfreePercent})%  ${d.FreeGB.toFixed(2)} GB Free / ${d.SizeGB.toFixed(2)} GB Total
        </div>`;
      });
      
      document.getElementById('diskStatus').innerHTML = diskStatusText;

      // Last boot (latest record)
      const bootPoints = dataPoints.at(-1);
      const bootTime = new Date(bootPoints.LastBoot);
      const option = { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false };
      const newBootTime = bootTime.toLocaleTimeString('en-GB', option).replace(',', '');

      document.getElementById('bootStatus').innerHTML = newBootTime ;
  });
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