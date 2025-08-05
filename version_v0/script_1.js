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

// Create chart FIRST — so it's ready
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
          beginAtZero: true,
          max: 100
        }
      }
    }
  });
}

async function loadData() {
  try {
    const response = await fetch('data.json');
    if (!response.ok) throw new Error('Network response was not ok');

    const data = await response.json();
    console.log('Loaded JSON:', data);

    // ✅ CPU Chart
    const now = new Date().toLocaleTimeString();
    cpuData.labels.push(now);
    cpuData.datasets[0].data.push(data.CPU);
    if (cpuData.labels.length > 20) {
      cpuData.labels.shift();
      cpuData.datasets[0].data.shift();
    }
    cpuChart.update();

    // ✅ RAM
    document.getElementById('ram').innerText = `${data.RAMFreeGB} GB Free / ${data.TotalRAMGB} GB Total`;

    // ✅ Disk
    let diskHTML = '';
    data.Disk.forEach(d => {
      const low = d.FreeGB < 20 ? 'low-space' : '';
      diskHTML += `<div class="disk-item ${low}">${d.DeviceID}: ${d.FreeGB} GB Free / ${d.SizeGB} GB Total</div>`;
    });
    document.getElementById('disk').innerHTML = diskHTML;

    // ✅ Boot
    document.getElementById('boot').innerText = new Date(data.LastBoot).toLocaleString();

  } catch (error) {
    console.error('Error loading data:', error);
  }
}

// ✅ VERY IMPORTANT: Chart must be created FIRST
createCPUChart();
loadData();
setInterval(loadData, 5000);
