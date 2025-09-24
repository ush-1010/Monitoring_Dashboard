/*function formatTime(timestamp) {
	const date = new Date(timestamp);
	return date.toLocaleString('en-GB', {
	  day: '2-digit', month: 'short', hour: '2-digit',
	  minute: '2-digit', second: '2-digit', hour12: false
	}).replace(',', '');
  }
*/

// ========================
// CONFIGURABLE THRESHOLDS
// ========================
const THRESHOLDS = {
	CPU_HIGH: 70,      // CPU usage above this % is considered high
	RAM_HIGH: 75,      // RAM usage above this % is considered high
	DISK_LOW: 20       // Disk free % below this is considered low
};

// preserve scroll position
let scrollPos = 0;
const scrollArea = document.getElementById('scrollArea');
scrollArea.addEventListener('scroll', () => {
  scrollPos = scrollArea.scrollTop;
});

// ----------------- TIME FORMAT -----------------
function formatTime(timestamp) {
	const date = new Date(timestamp);
	return `${String(date.getUTCDate()).padStart(2, '0')} `
	+ `${date.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' })} `
	+ `${String(date.getUTCHours()).padStart(2, '0')}:`
	+ `${String(date.getUTCMinutes()).padStart(2, '0')}:`
	+ `${String(date.getUTCSeconds()).padStart(2, '0')}`;
}
  
  // ----------------- DISK PANEL -----------------
function updateDiskPanel(data) {
	const diskSort = document.getElementById('diskSort').value;
	const diskList = document.getElementById('diskList');
	const latestByHost = {};
  
	data.forEach(entry => {
		if (!entry.Hostname || entry.Hostname.trim() === "") return; // skip null
		latestByHost[entry.Hostname] = entry;
	});
  
	const groupedDisks = Object.entries(latestByHost).map(([hostname, entry]) => {
	  const disks = Array.isArray(entry.Disk) ? entry.Disk : [entry.Disk];
	  const diskEntries = disks.map(disk => {
		const used = (disk.SizeGB - disk.FreeGB).toFixed(1);
		const usagePercent = ((used / disk.SizeGB) * 100).toFixed(2);
		return {
		  device: disk.DeviceID,
		  usagePercent: parseFloat(usagePercent),
		  used,
		  total: disk.SizeGB,
		  isLow: (100 - usagePercent) < THRESHOLDS.DISK_LOW   // dynamic
		};
	  });
  
	  diskEntries.sort((a, b) => diskSort === 'asc' ? a.usagePercent - b.usagePercent : b.usagePercent - a.usagePercent);
  
	  return { hostname, diskEntries };
	});
  
	groupedDisks.sort((a, b) => {
	  const aMax = Math.max(...a.diskEntries.map(d => d.usagePercent));
	  const bMax = Math.max(...b.diskEntries.map(d => d.usagePercent));
	  return diskSort === 'asc' ? aMax - bMax : bMax - aMax;
	});
  
	diskList.innerHTML = groupedDisks.map(group => {
	  const diskLines = group.diskEntries.map(d =>
		`<div class="${d.isLow ? 'low-space' : ''}">${d.device}: ${d.usagePercent}% used (${d.used} GB of ${d.total} GB)</div>`
	  ).join('');
	  return `<div class="disk-group"><strong>${group.hostname}</strong>${diskLines}</div>`;
	}).join('');
}
  
// ----------------- RAM PANEL -----------------
function updateRamPanel(data) {
	const ramSort = document.getElementById('ramSort').value;
	const ramList = document.getElementById('ramList');
	const latestByHost = {};
  
	data.forEach(entry => {
		if (!entry.Hostname || entry.Hostname.trim() === "") return; // skip null
		latestByHost[entry.Hostname] = entry;
	});
  
	const list = Object.values(latestByHost).map(e => {
	  const percent = ((1 - e.RAMFreeGB / e.TotalRAMGB) * 100).toFixed(2);
	  return {
			host: e.Hostname,
			percent,
			free: e.RAMFreeGB,
			total: e.TotalRAMGB,
			isHigh: percent > THRESHOLDS.RAM_HIGH   // dynamic
	  };
	});
  
	list.sort((a, b) => ramSort === 'asc' ? a.percent - b.percent : b.percent - a.percent);
  
	ramList.innerHTML = list.map(r =>
	  `<div class="ram-entry ${r.isHigh ? 'low-space' : ''}">${r.host}: ${r.percent}% used (${r.free} GB free of ${r.total} GB)</div>`
	).join('');
}
  
// ----------------- STATUS PANEL -----------------
function updateStatusPanel(data) {
	const container = document.getElementById('statusList');
	container.innerHTML = '';
  
	const latestByHost = {};

	data.forEach(entry => {
		if (!entry.Hostname || entry.Hostname.trim() === "") return; // skip null host
		if (!entry.LastBoot) return; // skip null boot time	
		latestByHost[entry.Hostname] = entry;
	});
  
	const now = new Date();
	const allBoots = Object.values(latestByHost).filter(e => e.LastBoot).map(e => new Date(e.LastBoot));
	const maxDays = allBoots.length > 0
		? Math.max(...allBoots.map(bt => Math.floor((now - bt) / (1000 * 60 * 60 * 24)))) : 1;
  
	Object.values(latestByHost).forEach(entry => {
		// skip bad or incomplete rows
		if (!entry.Hostname || entry.Hostname.trim() === "") return;
		if (!entry.LastBoot) return;
		if (entry.CPU_Percent == null || entry.RAMFreeGB == null || entry.TotalRAMGB == null) return;
	  const cpu = entry.CPU_Percent.toFixed(2);
	  const ramUsed = ((1 - entry.RAMFreeGB / entry.TotalRAMGB) * 100).toFixed(2);
	  const disks = Array.isArray(entry.Disk) ? entry.Disk : [entry.Disk];
	  const maxDiskUsed = Math.max(...disks.map(d => ((d.SizeGB - d.FreeGB) / d.SizeGB * 100).toFixed(2)));
  
	  const bootDays = entry.LastBoot
	  	? Math.floor((now - new Date(entry.LastBoot)) / (1000 * 60 * 60 * 24)): 0;
	  const bootPercent = ((bootDays / maxDays) * 100).toFixed(2);
  
	  const makeBar = (val, color = '#3e95cd') => `
		<div class="bar">
		  <div class="bar-fill" style="width:${val}%; background:${color}">${val}%</div>
		</div>`;
  
	  container.innerHTML += `
		<div class="status-entry">
		  <div class="status-label">${entry.Hostname}</div>
		  <div>CPU Usage: ${makeBar(cpu, cpu > THRESHOLDS.CPU_HIGH ? 'red' : '#3e95cd')}</div>
		  <div>RAM Usage: ${makeBar(ramUsed, ramUsed > THRESHOLDS.RAM_HIGH ? 'darkred' : '#8e5ea2')}</div>
		  <div>Disk Usage: ${makeBar(maxDiskUsed, maxDiskUsed > (100 - THRESHOLDS.DISK_LOW) ? 'orangered' : '#4caf50')}</div>
		  <div>Last Boot: ${makeBar(bootPercent, '#9e9e9e')}</div>
		</div>`;
	});
}
  
// ----------------- MAIN DASHBOARD -----------------
const charts = {};
const hostCards = {};
  
// Load data from API and render dashboard
function loadData() {
	fetch('http://localhost:3000/api/monitor')
	  .then(res => res.json())
	  .then(fData => {
			// --- ADDED SEARCH FILTER (case-insensitive) ---
			const searchTerm = (document.getElementById('searchHost').value || '').toLowerCase(); // <--- added
			const filteredData = fData.filter(entry =>
				entry.Hostname && entry.Hostname.toLowerCase().includes(searchTerm)
			); // <--- added
			// ------------------------------------------------

			const grouped = {};
			filteredData.forEach(entry => {
				if (!entry.Hostname || entry.Hostname.trim() === "") return; // skill null hostnames
					grouped[entry.Hostname] = grouped[entry.Hostname] || [];
					grouped[entry.Hostname].push(entry);
			});
  
			const container = document.getElementById('machineStatus');
			// container.innerHTML = ''; 											// --- added to clear previous on new search
			// hostCards = {}; 																// <--- added to reset cards on new search
			//Object.keys(hostCards).forEach(k => delete hostCards[k]); // reset cards <--- added

			// --- ADDED “No results” indicator ---
			const noResultsDiv = document.getElementById('noResults');
			if (noResultsDiv) {
				noResultsDiv.style.display = Object.keys(grouped).length === 0 ? 'block' : 'none';
			}
			// -----------------------------------
  
			Object.entries(grouped).forEach(([hostname, entries]) => {
				const latestEntries = entries.slice(-15);
				const latest = latestEntries.at(-1);
		
				const cpuVals = latestEntries.map(e => e.CPU_Percent.toFixed(2));
				const ramVals = latestEntries.map(e => ((1 - e.RAMFreeGB / e.TotalRAMGB) * 100).toFixed(2));
				const labels = latestEntries.map(e => formatTime(e.CaptureTime));
		
				const isRamLow = ramVals.at(-1) > THRESHOLDS.RAM_HIGH;
				const isCpuHigh = cpuVals.at(-1) > THRESHOLDS.CPU_HIGH;
				const ramPercent = ramVals.at(-1);
		
				const diskHTML = (Array.isArray(latest.Disk) ? latest.Disk : [latest.Disk]).map(disk => {
				const freePercent = ((disk.FreeGB / disk.SizeGB) * 100).toFixed(2);
				const isLow = freePercent < THRESHOLDS.DISK_LOW;
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
							labels: { usePointStyle: true }
						},
						tooltip: {
							intersect: true,
							mode: 'nearest'
						}
					},
					scales: {
						y: { min: 0, max: 100, ticks: { callback: val => val + '%' } },
						x: { ticks: { maxRotation: 45, minRotation: 0 } }
					}
				}
			});
			} else {
				const chart = charts[hostname];
				chart.data.labels = labels;
				chart.data.datasets[0].data = cpuVals;
				chart.data.datasets[1].data = ramVals;
				chart.update();
			}
			
			

			document.getElementById(cpuId).innerHTML = isCpuHigh
				? `<span class="low-space">${cpuVals.at(-1)}% (High)</span>`
				: `${cpuVals.at(-1)}%`;
		
			document.getElementById(ramId).innerHTML = isRamLow
				? `<span class="low-space">${latest.RAMFreeGB} GB Free (${ramPercent}%) / ${latest.TotalRAMGB} GB Total (High)</span>`
				: `${latest.RAMFreeGB} GB Free (${ramPercent}%) / ${latest.TotalRAMGB} GB Total`;
		
			document.getElementById(diskId).innerHTML = diskHTML;
		});
		
		// ------------------ CHANGED: restore scroll after rendering ------------------
		requestAnimationFrame(() => {
			scrollArea.scrollTop = scrollPos;				// <--- added to restore scroll position
		});

		updateDiskPanel(fData);
		updateRamPanel(fData);
		updateStatusPanel(fData);
	  });
}
  
// ----------------- INIT -----------------
document.addEventListener('DOMContentLoaded', () => {
	loadData();
	setInterval(loadData, 10000);
  
	document.getElementById('diskSort').addEventListener('change', () => {
	  fetch('http://localhost:3000/api/monitor').then(res => res.json()).then(updateDiskPanel);
	});
  
	document.getElementById('ramSort').addEventListener('change', () => {
	  fetch('http://localhost:3000/api/monitor').then(res => res.json()).then(updateRamPanel);
	});
	// --- ADDED live search listener ---
	document.getElementById('searchHost').addEventListener('input', () => {
		loadData();
	});
});  