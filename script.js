function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('en-GB', {
      day: '2-digit', month: 'short', hour: '2-digit',
      minute: '2-digit', second: '2-digit', hour12: false
    }).replace(',', '');
  }
  
  function updateDiskPanel(data) {
		const diskSort = document.getElementById('diskSort').value;
		const diskList = document.getElementById('diskList');
		const latestByHost = {};
	
		data.forEach(entry => {
			latestByHost[entry.Hostname] = entry;
		});
	
		// Build grouped structure per host
		const groupedDisks = Object.entries(latestByHost).map(([hostname, entry]) => {
			const disks = Array.isArray(entry.Disk) ? entry.Disk : [entry.Disk];
	
			const diskEntries = disks.map(disk => {
				const used = (disk.SizeGB - disk.FreeGB).toFixed(1);
				const usagePercent = ((used / disk.SizeGB) * 100).toFixed(2);
				return {
					device: disk.DeviceID,
					usagePercent: parseFloat(usagePercent),
					used,
					total: disk.SizeGB
				};
			});
	
			// Sort disks within host if needed
			diskEntries.sort((a, b) =>
				diskSort === 'asc' ? a.usagePercent - b.usagePercent : b.usagePercent - a.usagePercent
			);
	
			return { hostname, diskEntries };
		});
	
		// Sort host blocks by highest disk usage inside them
		groupedDisks.sort((a, b) => {
			const aMax = Math.max(...a.diskEntries.map(d => d.usagePercent));
			const bMax = Math.max(...b.diskEntries.map(d => d.usagePercent));
			return diskSort === 'asc' ? aMax - bMax : bMax - aMax;
		});
	
		// Render
		diskList.innerHTML = groupedDisks.map(group => {
			const diskLines = group.diskEntries.map(d =>
				`<div class="disk-sub">${d.device}: ${d.usagePercent}% used (${d.used} GB of ${d.total} GB)</div>`
			).join('');
			return `<div class="disk-group"><strong>${group.hostname}</strong>${diskLines}</div>`;
		}).join('');
	}
	
  

  function updateRamPanel(data) {
    const ramSort = document.getElementById('ramSort').value;
    const ramList = document.getElementById('ramList');
    const latestByHost = {};
  
    data.forEach(entry => {
      latestByHost[entry.Hostname] = entry;
    });
  
    const list = Object.values(latestByHost).map(e => {
      const percent = ((1 - e.RAMFreeGB / e.TotalRAMGB) * 100).toFixed(2);
      return {
        host: e.Hostname,
        percent,
        free: e.RAMFreeGB,
        total: e.TotalRAMGB
      };
    });
  
    list.sort((a, b) =>
      ramSort === 'asc' ? a.percent - b.percent : b.percent - a.percent
    );
  
    ramList.innerHTML = list.map(r =>
      `<div class="ram-entry">${r.host}: ${r.percent}% used (${r.free} GB free of ${r.total} GB)</div>`
    ).join('');
  }

	const charts = {}; // Stores Chart.js instances per hostname
  const hostCards = {}; // Track if card already rendered
  
  function loadData() {
    fetch('data_1.json')
      .then(res => res.json())
      .then(fData => {
        const grouped = {};
        fData.forEach(entry => {
          if (!grouped[entry.Hostname]) grouped[entry.Hostname] = [];
          grouped[entry.Hostname].push(entry);
        });
  
        const container = document.getElementById('machineStatus');
        //container.innerHTML = '';
  
        Object.entries(grouped).forEach(([hostname, entries], index) => {
          const latest = entries.at(-1);
          const cpuVals = entries.map(e => e.CPU.toFixed(2));
          const ramVals = entries.map(e => ((1 - e.RAMFreeGB / e.TotalRAMGB) * 100).toFixed(2));
          const labels = entries.map(e => formatTime(e.Time));
  
          const isRamLow = ramVals.at(-1) > 75;
          const isCpuHigh = cpuVals.at(-1) > 70;
  				const ramPercent = ramVals.at(-1);

					const diskHTML = (Array.isArray(latest.Disk) ? latest.Disk : [latest.Disk]).map(disk => {
						const freePercent = ((disk.FreeGB / disk.SizeGB) * 100).toFixed(2);
						const isLow = freePercent < 20;
						return `
							<div class="${isLow ? 'low-space' : ''}">
								${disk.DeviceID} ${disk.FreeGB} GB Free (${freePercent}%) / ${disk.SizeGB} GB Total${isLow ? ' (Low)' : ''}
							</div>`;
					}).join('');
	
					const bootTime = new Date(latest.LastBoot).toLocaleString('en-GB', {
						day: '2-digit', month: 'short', year: 'numeric',
						hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
					});
	
					const cardId = `card-${hostname}`;
					const chartId = `combo-${hostname}`;
					const cpuId = `cpu-${hostname}`;
					const ramId = `ram-${hostname}`;
					const diskId = `disk-${hostname}`;
	
					if (!hostCards[hostname]) {
						const card = document.createElement('div');
						card.className = 'card';
						card.id = cardId;
						card.innerHTML = `
							<h2>${hostname}</h2>
							<div><strong>CPU:</strong> <span id="${cpuId}"></span></div>
							<div><strong>RAM:</strong> <span id="${ramId}"></span></div>
							<div class="chart-container"><canvas id="${chartId}"></canvas></div>
							<div style="margin-top: 0px;"><strong>Disk:</strong><div id="${diskId}">${diskHTML}</div></div>
							<div style="margin-top: 10px;"><strong>Last Boot:</strong> ${bootTime}</div>
						`;
						container.appendChild(card);
						hostCards[hostname] = true;
	
						// Chart creation (once)
						const ctx = document.getElementById(chartId).getContext('2d');
						charts[hostname] = new Chart(ctx, {
							type: 'line',
							data: {
								labels,
								datasets: [
									{
										label: 'CPU Usage (%)',
										data: cpuVals,
										borderColor: isCpuHigh ? 'red' : '#3e95cd',
										backgroundColor: 'transparent',
										tension: 0.2,
										pointRadius: 2,
										pointHoverRadius: 5,
									},
									{
										label: 'RAM Usage (%)',
										data: ramVals,
										borderColor: isRamLow ? 'darkred' : '#8e5ea2',
										backgroundColor: 'transparent',
										tension: 0.2,
										pointRadius: 2,
										pointHoverRadius: 5,
									}
								]
							},
							options: {
								responsive: true,
								animation: false,
								plugins: {
									legend: {
										display: true,
										labels: { usePointStyle: true },
										onClick: (e, legendItem, legend) => {
											const index = legendItem.datasetIndex;
											const ci = legend.chart;
											const meta = ci.getDatasetMeta(index);
											meta.hidden = meta.hidden === null ? !ci.data.datasets[index].hidden : null;
											ci.update();
										}
									},
									tooltip: {
										intersect: true,
										mode: 'nearest'
									}
								},
								scales: {
									y: {
										min: 0,
										max: 100,
										ticks: {
											callback: val => val + '%'
										}
									},
									x: {
										ticks: { maxRotation: 45, minRotation: 0 }
									}
								}
							}
						});
					} else {
						// Update existing chart data
						const chart = charts[hostname];
						chart.data.labels = labels;
						chart.data.datasets[0].data = cpuVals;
						chart.data.datasets[1].data = ramVals;
						chart.update();
					}
	
					// Update CPU/RAM text
					document.getElementById(cpuId).innerHTML = isCpuHigh
						? `<span class="low-space">${cpuVals.at(-1)}% (High)</span>`
						: `${cpuVals.at(-1)}%`;
	
					document.getElementById(ramId).innerHTML = isRamLow
						? `<span class="low-space">${latest.RAMFreeGB} GB Free (${ramPercent}%) / ${latest.TotalRAMGB} GB Total (High)</span>`
						: `${latest.RAMFreeGB} GB Free (${ramPercent}%) / ${latest.TotalRAMGB} GB Total`;
	
					// Update Disk section
					document.getElementById(diskId).innerHTML = diskHTML;
				});
        
        updateDiskPanel(fData);

        updateRamPanel(fData);
      });
  }
  
  document.addEventListener('DOMContentLoaded', () => {
    loadData();
    setInterval(loadData, 10000);
    
    document.getElementById('diskSort').addEventListener('change', () => {
        fetch('data_1.json').then(res => res.json()).then(updateDiskPanel);
    });
      
    
    document.getElementById('ramSort').addEventListener('change', () => {
      fetch('data_1.json').then(res => res.json()).then(updateRamPanel);
    });
  });