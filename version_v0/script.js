/* let showHistory = false; // Default: LiveOnly
const maxPoints = 15;    // Points to show in LiveOnly mode

document.addEventListener('DOMContentLoaded', () => {
  // Create charts
  createCPUChart();
  createRAMChart();

  // Load initial data
  loadData();

  // Toggle event
  document.getElementById('historyToggle').addEventListener('change', (e) => {
    showHistory = e.target.checked;
    loadData(); // reload to apply mode
  });

  // Periodically update
  setInterval(loadData, 5000);
});  */

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
        x: {
          ticks: {
            callback: function(value, index, ticks) {
              const label = this.getLabelForValue(value);
              const parts = label.split(', ');
              return parts; // Return array like ['30 Jul', '15:34:15']
            }
          }
        },
        y: {
          min: 0,
          max: 100,
          beginAtZero: true,
          ticks: {
            stepSize: 20,
            precision: 0,
            callback: function(value) {
              return value + '%'; // Add percentage sign to y-axis labels
            }
          }
        }
      }
    }
  });
}

let ramChart;
const ramData = {
  labels: [],
  datasets: [{
    label: 'Free RAM (%)',
    data: [],
    borderColor: 'rgb(255, 99, 132)',
    fill: false,
    tension: 0.1
  }]
};

function createRAMChart() {
  const ctx = document.getElementById('ramChart').getContext('2d');
  ramChart = new Chart(ctx, {
    type: 'line',
    data: ramData,
    options: {
      responsive: true,
      animation: false,
      scales: {
        x: {
          ticks: {
            callback: function(value, index, ticks) {
              const label = this.getLabelForValue(value);
              const parts = label.split(', ');
              return parts; // Return array like ['30 Jul', '15:34:15']
            }
          }
        },
        y: {
          min: 0,
          max: 100,
          beginAtZero: true,
          ticks: {
            stepSize: 20,
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
    const response = await fetch('./data.json');  // Adjust the path to your data source
    const fData = await response.json();          
    const data = fData[fData.length - 1];         // Assuming the data is an array and we want the first object
    console.log('fData:', fData);                 

    const maxPoints = 20;                         // Maximum number of points to display in the chart

    // CPU ----------------------------------------------------------------------------
    cpuData.labels = [];
    cpuData.datasets[0].data = [];

    // Fill with new points
    fData.slice(-maxPoints).forEach(point=> {
      const timestamp = point.Time ? 
        new Date(point.Time).toLocaleTimeString('en-GB', {
          day: '2-digit', month: 'short',
          hour: '2-digit', minute: '2-digit', second: '2-digit',
          hours12: false
        })
        : '';
      cpuData.labels.push(timestamp);
      cpuData.datasets[0].data.push(point.CPU);
    });
    //  Threshold check: latest CPU point
    const latestCPU = cpuData.datasets[0].data[cpuData.datasets[0].data.length - 1];
    const cpuThreshold = 80; // example: 80%
    const cpuStatus = document.getElementById('cpuStatus');

    if (latestCPU > cpuThreshold) {
      cpuStatus.innerHTML = `<span class="low-space">${latestCPU}% (High)</span>`;
      cpuChart.data.datasets[0].borderColor = 'red';
    } else {
      cpuStatus.innerHTML = `${latestCPU}%`;
      cpuChart.data.datasets[0].borderColor = 'rgb(75, 192, 192)';
    }

    // Apply changes
    cpuChart.update();

    // RAM ----------------------------------------------------------------------------
    // Clear RAM chart data
    ramData.labels = [];
    ramData.datasets[0].data = [];
    
    // Fill RAM chart with history
    fData.slice(-maxPoints).forEach(point => {
      const timestamp = point.Time ? 
      new Date(point.Time).toLocaleTimeString('en-GB', {
        day: '2-digit', month: 'short',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hours12: false
      })
      : '';
      ramData.labels.push(timestamp);
      const ramUsedPercent = (100-((point.RAMFreeGB / point.TotalRAMGB) * 100)).toFixed(2);
      ramData.datasets[0].data.push(parseFloat(ramUsedPercent));
    });

    ramChart.update();

    // --- RAM Status (Latest Point)
    const latestPoint = fData[fData.length - 1];
    const ramThreshold = 75; // Threshold for low RAM warning
    const ramStatus = document.getElementById('ramStatus');
    const ramUsedPercentLatest = (100 - ((data.RAMFreeGB / data.TotalRAMGB) * 100)).toFixed(2);
    const ramClass = ramUsedPercentLatest > ramThreshold ? 'low-space' : '';

    

    /* // RAM chart: push rolling free % history
    ramData.labels.push(cpuData.labels[cpuData.labels.length - 1]);
    ramData.datasets[0].data.push(parseFloat(ramUsedPercent));

    if (ramData.labels.length > maxPoints) {
      ramData.labels.shift();
      ramData.datasets[0].data.shift();
    } */
    

    ramStatus
    .innerHTML = `<div class="${ramClass}">
      ${data.RAMFreeGB} GB Free (${ramUsedPercentLatest}%) / ${data.TotalRAMGB} GB Total
    </div>`;
    
    // DISK ----------------------------------------------------------------------------
    const diskThreshold = 25; // Threshold for low disk space warning
    const disk = document.getElementById('disk');
    let diskHTML = '';

    data.Disk.forEach(d => {
      const freePercent = ((d.FreeGB / d.SizeGB) * 100).toFixed(2);
      const lowDisk = freePercent < diskThreshold ? 'low-space' : '';

      diskHTML += `<div class="disk-item ${lowDisk}">
        ${d.DeviceID}: ${d.FreeGB} GB Free (${freePercent}% / ${d.SizeGB} GB Total
      </div>`;
    });
    disk.innerHTML = diskHTML;

    // BOOT ----------------------------------------------------------------------------
    const boot = document.getElementById('boot');
    boot.innerText = new Date(data.LastBoot).toLocaleString();

  } catch (error) {
    console.error('Error:', error);
  }
}

document.addEventListener('DOMContentLoaded', () => {
    createCPUChart();
    createRAMChart();
    loadData();
    setInterval(loadData, 5000);
});
// Add your dynamic interval code here if needed!