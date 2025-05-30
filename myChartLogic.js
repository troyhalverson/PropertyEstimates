// commonChartLogic.js

const AVG = ' Average'; // label suffex for average reference lines

// Helper Functions (common to 'Scatter Estimates.htm' and 'Scatter Taxes.htm')

// Use 'K' for large values
function valueFormatter(value) {
	if (value > 20000) return '$' + (value / 1000).toFixed(0).toLocaleString() + 'K';
	else return '$' + value.toFixed(0).toLocaleString();
}

// Retrieve the set-specific display label if available.
function labelMap(set, sets) {
	return sets[set]?.label || sets.DEFAULT.label;
}

// Retrieve the set-specific rgba color if available.
function colorMap(set, sets) {
	return sets[set]?.color || sets.DEFAULT.color;
}

// Convert an RGBA color string to have full opacity (alpha = 1) for borders.
function getOpaqueBorderColor(rgbaColor) {
	if (typeof rgbaColor === 'string' && rgbaColor.startsWith('rgba(')) {
		return rgbaColor.replace(/, [\d\.]+([,\)])/, ', 1$1');
	} else return rgbaColor;
}

// Replace sqft placeholder string with given values
function updateLineSqft(placeholder, value, lines) {
	const sf = lines.sqft; // array index for sqft
	lines.records.forEach((r) => {
		if (placeholder === r[sf]) r[sf] = value;
	});
}

// Parse URL query string to get any initially selected sets.
//  @returns {Array<string>} An array of selected set values
function getInitialSelectedSetsFromUrl(ChartOptions) {
	const params = new URLSearchParams(window.location.search);
	const setsParam = params.get('sets');
	if (setsParam) {
		return setsParam.split(',');
	}
	return Array.from(document.querySelectorAll(ChartOptions + ':checked')).map((checkbox) => checkbox.value);
}

// create various pairs of line.records[]
function AddAssessmentReferenceLines(assessments, avgs, properties, lines, sets) {
	// Set a range for reasonable variances from an average or median value per square foot
	const Discount = 0.7; // 30% discount
	const Premium = 1.3; // 30% premium

	// Ensure there are averages to work with
	if (avgs.records.length > 0) {
		// Calculate average price per square foot (PPSF) from the avgs.records
		const avgTPSF = avgs.records[0][avgs.value] / avgs.records[0][avgs.sqft];
		const minRate = (Discount * avgTPSF).toFixed(0);
		const maxRate = (Premium * avgTPSF).toFixed(0);

		// create datapoints to define vertical reference lines at each assessment size
		assessments.forEach((a) => {
			const sf = a.sqft;
			const label = sets[a.set].label + ' at $';
			const minLabel = label + minRate + '/sf';
			const maxLabel = label + maxRate + '/sf';
			lines.records.push([sf, sf * minRate, sf + ' sf', a.set, minLabel]); // label this end of line
			lines.records.push([sf, sf * maxRate, '', a.set, maxLabel]); // no label on this end
		});
	}

	const allSfs = properties.records.map((record) => record[properties.sqft]);
	const minSf = parseFloat(Math.min(...allSfs).toPrecision(2));
	const maxSf = parseFloat(Math.max(...allSfs).toPrecision(2));
	updateLineSqft('minsf', minSf, lines);
	updateLineSqft('maxsf', maxSf, lines);

	// Create average-value line points (pair per assessement)
	avgs.records.forEach((record, index) => {
		let label = record[avgs.label];
		if ('' === label) {
			label = 'record ' & index;
		}

		const sqft = record[avgs.sqft];
		if (typeof sqft !== 'number' || sqft <= 0) {
			console.warn(`Invalid data, ${label} sqft ${sqft} must be greater than zero`);
			return;
		}

		const value = record[avgs.value];
		if (typeof value !== 'number') {
			console.warn(`Invalid data, ${label} value ${value} is not a number`);
			return;
		}

		// console.log(`${label}: $${VPSF} per sqft`);
		const vpsf = (value / sqft).toPrecision(3);
		lines.records.push([minSf, minSf * vpsf, '', label, vpsf]);
		lines.records.push([maxSf, maxSf * vpsf, label + AVG + ': $' + vpsf + '/sf', label, vpsf]);
	});
	console.log('Reference lines: ', lines.records);
}

function isOtherSet(set) {
	return set !== 'SET1' && set !== 'SET2';
}

function findAllSetAverages(properties, series, sets, avgsData) {
	// series[] typically = [SET1, SET2, OTHER]
	if (series.length === 0 || !properties || !properties.records || properties.records.length === 0) {
		console.warn('Missing data to calculate averages');
		return;
	}
	series.forEach((set) => {
		let setRecords;
		if (set === OTHER) {
			//filteredData = properties.records.filter((record) => isOtherSet(record[properties.set]));
			//setRecords = properties.records.filter(
			//	(record) => record[properties.set] !== SET1 && record[properties.set] !== SET2
			setRecords = properties.records.filter((record) => isOtherSet(record[properties.set]));
		} else {
			setRecords = properties.records.filter((record) => record[properties.set] === set);
		}

		if (setRecords.length > 0) {
			let avgSqft = setRecords.reduce((sum, record) => sum + record[properties.sqft], 0);
			avgSqft = Math.round(avgSqft / setRecords.length);
			let avgValue = setRecords.reduce((sum, record) => sum + record[properties.value], 0);
			avgValue = Math.round(avgValue / setRecords.length);
			avgsData.records.push([avgSqft, avgValue, set, sets[set].label + AVG, '']);
		}
	});
	console.log('Set averages:', ...avgs.records);
}

function findAverages(checkmarks, properties, SET1, SET2, OTHER) {
	let metrics = { sqft: 0, value: 0, cnt: 0 };
	if (!properties || !properties.records || properties.records.length === 0) {
		return metrics;
	}

	for (const record of properties.records) {
		if (!record) {
			console.warn('Skipping undefined or null record in properties.records');
			continue;
		}

		if (checkmarks.includes(record[properties.set])) {
			metrics.sqft += record[properties.sqft];
			metrics.value += record[properties.value];
			metrics.cnt++;
		} else if (checkmarks.includes(OTHER) && record[properties.set] !== SET1 && record[properties.set] !== SET2) {
			metrics.sqft += record[properties.sqft];
			metrics.value += record[properties.value];
			metrics.cnt++;
		}
	}
	const averageSqft = metrics.cnt > 0 ? metrics.sqft / metrics.cnt : 0;
	const averageValue = metrics.cnt > 0 ? metrics.value / metrics.cnt : 0;
	metrics.sqft = parseFloat(averageSqft.toPrecision(3));
	metrics.value = parseFloat(averageValue.toPrecision(3));
	return metrics;
}

function createScatterDataset(series, properties, sets) {
	const filteredData = properties.records.filter((record) => record[properties.set] === series);
	console.log('Add', filteredData.length, sets[series].label);

	if (filteredData.length === 0) {
		console.warn('no data filtered for scatter', series);
		return null;
	}
	return {
		type: 'scatter',
		label: sets[series].label,
		data: filteredData.map((record) => ({
			x: record[properties.sqft],
			y: record[properties.value],
			label: record[properties.label],
			date: record[properties.date],
			notes: record[properties.note],
		})),
		backgroundColor: sets[series].color,
		borderColor: getOpaqueBorderColor(sets[series].color),
		pointRadius: 5,
		pointHoverRadius: 8,
		showLine: false, // no lines between scatter points
	};
}

function createLineDataset(set, linesData, properties, sets, SET1, SET2, RL_AM) {
	const filteredLineData = linesData.records.filter((record) => record[properties.set] === set);
	if (filteredLineData.length === 0) {
		console.warn('no data filtered for line', set);
		return null;
	}

	const recDataset = filteredLineData.map((record) => ({
		x: record[properties.sqft],
		y: record[properties.value],
		label: record[properties.label],
		date: record[properties.date],
		note: record[properties.note],
	}));

	// log specifcally for SET1, SET2, and RL_AM
	if (SET1 == set || SET2 == set) {
		const ppsf = 1.0 * (recDataset[0].y / recDataset[0].x).toPrecision(3);
		console.log('Add line:', sets[set].label, 'avg', ppsf, '$/sqft');
	} else {
		if (RL_AM == set) {
			console.log('Add line:', sets[set].label, '$', recDataset[0].y);
		} else {
			console.log('Add line:', sets[set].label, recDataset[0].x);
		}
	}

	return {
		type: 'line',
		label: labelMap(set, sets),
		data: recDataset,
		fill: false,
		borderColor: sets[set].color || sets.DEFAULT.color,
		backgroundColor: 'rgba(255, 255, 255, 0.1)',
		tension: 0,
		pointRadius: 1,
		borderWidth: 1,
		pointHoverRadius: 3,
		showLine: true,
	};
}

function getChartConfig(YAXISLABEL, XAXISLABEL) {
	return {
		type: 'scatter',
		options: {
			responsive: true,
			maintainAspectRatio: true,
			scales: {
				x: {
					type: 'linear',
					position: 'bottom',
					title: {
						display: true,
						text: XAXISLABEL,
						font: { size: 16 },
						padding: 8,
					},
					ticks: { beginAtZero: true },
				},
				y: {
					type: 'linear',
					position: 'left',
					title: {
						display: true,
						text: YAXISLABEL,
						font: { size: 16 },
						padding: 8,
					},
					ticks: { beginAtZero: true, callback: valueFormatter },
				},
			},
			plugins: {
				title: {
					display: true,
					text: YAXISLABEL + ' by ' + XAXISLABEL,
					font: { size: 18 },
					padding: 10,
				},
				tooltip: {
					callbacks: {
						label: function (context) {
							let label = context.dataset.label || '';
							if (label) label += ': ';
							label += valueFormatter(context.parsed.y);
							if (context.raw && context.raw.date) label += ` ${context.raw.date}`;
							return label;
						},
						title: function (context) {
							if (context[0].dataset.type === 'scatter' && context[0].raw && context[0].raw.label) {
								let title = '';
								if (context[0].raw.date !== '') title += ` ${context[0].raw.label}`;
								if (context[0].raw && context[0].raw.x) title += `, ${context[0].raw.x} sqft`;
								if (context[0].raw && context[0].raw.notes) title += `, ${context[0].raw.notes}`;
								return title;
							}
							if (context[0].dataset.type === 'line') return `${context[0].dataset.label}`;
							return '';
						},
					},
					backgroundColor: 'rgba(0, 0, 0, 0.8)',
					titleFontColor: '#fff',
					bodyFontColor: '#eee',
					borderColor: '#333',
					borderWidth: 1,
					cornerRadius: 4,
					padding: 8,
				},
				legend: { display: true, position: 'top' },
				datalabels: { display: true },
			},
		},
		plugins: [ChartDataLabels],
	};
}

function updateChart(pushState = true) {
	const datasets = [];

	// Get all checked checkboxes
	const selectedSets = Array.from(document.querySelectorAll(ChartOptions + ':checked')).map(
		(checkbox) => checkbox.value
	);
	console.log('Checked: ', ...selectedSets);

	// Update URL with selected sets if pushState is true
	if (pushState) {
		const newUrl = new URL(window.location.href);
		if (selectedSets.length > 0) {
			newUrl.searchParams.set('sets', selectedSets.join(','));
		} else {
			newUrl.searchParams.delete('sets');
		}
		history.pushState({ sets: selectedSets }, '', newUrl.toString());
	}

	// Handle the main scatter points
	const scatterPointTypes = [SET1, SET2, OTHER]; // could add Redfin, etc.
	scatterPointTypes.forEach((set) => {
		if (selectedSets.includes(set)) {
			const scatterData = createScatterDataset(set, properties, sets); //  createScatterDataset(set);
			if (scatterData) {
				//console.log( 'scatterData', scatterData ); // TESTING
				datasets.push(scatterData);
			}

			// Display the set's reference line if RL checkbox is selected
			// IMPORTANT: reference line is added here so the RL legend appears next to its corresponding scatter set legend
			if (selectedSets.includes(RL)) {
				const lineDataset = createLineDataset(set, lines, properties, sets, SET1, SET2, RL_AM); // createLineDataset(set);
				if (lineDataset) datasets.push(lineDataset);
			}
		}
	});

	// Handle the other reference lines if RL checkbox is selected
	if (selectedSets.includes(RL)) {
		const lineReferenceTypes = [RL_AM, RL_NEW, RL_OLD, RL_REAL];
		lineReferenceTypes.forEach((set) => {
			const lineData = createLineDataset(set, lines, properties, sets, SET1, SET2, RL_AM); // createLineDataset(set);
			if (lineData) datasets.push(lineData);
		});
	}

	const config = {
		...getChartConfig(YAXISLABEL, XAXISLABEL),
		plugins: [ChartDataLabels], // ChartDataLabels requires src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.0.0"
		data: { datasets: datasets },
	};

	if (mixedChart) {
		mixedChart.destroy();
	}
	mixedChart = new Chart(chartElement, config);

	const fa = findAverages(selectedSets, properties, SET1, SET2, OTHER);
	console.log('Metrics for selections: ', fa);

	const vpsf = (fa.value / fa.sqft).toPrecision(3);
	statisticsElement.innerHTML = 'Average of ' + fa.cnt + ' properties: ';
	statisticsElement.innerHTML += '$' + vpsf + '/sq ft, ';
	statisticsElement.innerHTML += valueFormatter(fa.value) + ', ';
	statisticsElement.innerHTML += fa.sqft + ' sq ft';
} // end updateChart()
